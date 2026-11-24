/**
 * auth.js
 *
 * Sign-in with Auth0 (Authorization Code with PKCE through the Auth0 SPA SDK), the session and the
 * access token sent to the Precision Designer APIs. See MOBILE_WEB_APP_AUTH0.md.
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { Auth0Client } from '@auth0/auth0-spa-js';
// Prescient Devices imports
import { AUTH_CONFIG } from './authConfig';
import { clearBrowserData } from './clearBrowserData';

/**
 * @typedef {object} RigAccess
 * @property {boolean} all - true when the user may see every rig
 * @property {string[]} [countries] - countries the user may see
 * @property {number[]} [rigs] - rigs the user may see
 *
 * @typedef {object} SessionUser
 * @property {string} id - Auth0 user id (`sub`)
 * @property {string} login - user name
 * @property {string} email - e-mail address
 * @property {string} firstName - given name, or the whole name when Auth0 has no given name
 * @property {string} lastName - family name
 * @property {string} role - Viewer, Editor or Admin
 * @property {string[]} permissions - e.g. read:digital_twin, write:digital_twin
 * @property {RigAccess | null} rigAccess - rigs the user may see
 */

// Constants
// Errors from getTokenSilently() that mean the refresh token has ended: the user signs in again
// Permission in the access token that allows writes (MD section 4.4)
const WRITE_PERMISSION = 'write:digital_twin';
const SESSION_ENDED_ERRORS = ['login_required', 'missing_refresh_token', 'invalid_grant', 'consent_required'];
const EXPIRED_MESSAGE = 'Your session has ended. Please sign in again.';
// Development only: REACT_APP_AUTH_BYPASS=true in .env.local skips Auth0 so screens can be tested
// without a client id. Production builds ignore it.
const IS_AUTH_BYPASSED = process.env.NODE_ENV === 'development' && process.env.REACT_APP_AUTH_BYPASS === 'true';
/** @type {SessionUser} */
const BYPASS_USER = Object.freeze({
  id: 'dev|bypass',
  login: process.env.REACT_APP_USER_LOGIN || 'dev.user',
  email: process.env.REACT_APP_USER_EMAIL || 'dev.user@example.com',
  firstName: 'Dev',
  lastName: 'User',
  role: 'Editor',
  permissions: ['read:digital_twin', 'write:digital_twin'],
  rigAccess: { all: true },
});

let client = null;
let currentUser = null;
let initPromise = null;
const sessionEndedListeners = new Set();

/**
 * Error with a code the screens can act on
 */
class AuthError extends Error {
  /**
   * @param {string} code - e.g. not_configured, insecure_origin, access_denied, session_ended
   * @param {string} message - message for the user
   */
  constructor(code, message) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/**
 * Get the one Auth0 client of the app, created on first use
 * @returns {Auth0Client} Auth0 client
 * @throws {AuthError} when the client id is missing or the page is not served over HTTPS
 */
function getClient() {
  if (client) return client;
  if (!AUTH_CONFIG.clientId) {
    throw new AuthError('not_configured', 'Sign-in is not configured. Set REACT_APP_AUTH0_CLIENT_ID.');
  }
  // PKCE needs the Web Crypto API, which browsers only give to HTTPS pages and localhost
  if (!window.isSecureContext || !window.crypto?.subtle) {
    throw new AuthError('insecure_origin', 'Sign-in needs HTTPS. Open the app over https://.');
  }
  client = new Auth0Client({
    domain: AUTH_CONFIG.domain,
    clientId: AUTH_CONFIG.clientId,
    authorizationParams: {
      audience: AUTH_CONFIG.audience,
      scope: AUTH_CONFIG.scope,
      redirect_uri: AUTH_CONFIG.redirectUri,
    },
    // Rotating refresh tokens renew the 1-hour access token without the user seeing it
    useRefreshTokens: true,
    // Keeps the user signed in after a reload or when the phone closes the tab (MD section 3.6)
    cacheLocation: 'localstorage',
  });
  return client;
}

/**
 * Decode the claims of a JWT; for display only, the Designers check the token on every call
 * @param {string} token - access token
 * @returns {object} claims, or an empty object when the token cannot be read
 */
function decodeClaims(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      Array.from(atob(part), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Build the signed-in user from the ID token profile and the access token claims
 * @param {object} profile - Auth0 user profile
 * @param {string} token - access token
 * @returns {SessionUser} user
 */
function toSessionUser(profile, token) {
  const claims = decodeClaims(token);
  const ns = AUTH_CONFIG.claimNamespace;
  const login = claims[`${ns}username`] || profile?.nickname || '';
  const email = claims[`${ns}email`] || profile?.email || '';
  const firstName = profile?.given_name || (profile?.name && profile.name !== email ? profile.name : '') || login;
  return {
    id: profile?.sub || claims.sub || '',
    login,
    email,
    firstName,
    lastName: profile?.given_name ? profile?.family_name || '' : '',
    role: claims[`${ns}role`] || '',
    permissions: Array.isArray(claims.permissions) ? claims.permissions : [],
    rigAccess: claims[`${ns}rig_access`] || null,
  };
}

/**
 * True when Auth0 has sent the browser back to the app with a code or an error
 * @returns {boolean} true on the callback
 */
function isCallback() {
  const params = new URLSearchParams(window.location.search);
  return (params.has('code') || params.has('error')) && params.has('state');
}

/**
 * Finish the sign-in on the callback URL and go back to the page the user started from
 * @returns {Promise<void>} resolves when the tokens are stored
 * @throws {AuthError} access_denied when the account has no access
 */
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('error')) {
    // Leave the callback URL so a reload does not show the error again; never loop to Auth0 here
    window.history.replaceState({}, '', '/');
    throw new AuthError(
      params.get('error'),
      params.get('error_description') || 'Your account has no access to this app.'
    );
  }
  try {
    const { appState } = await getClient().handleRedirectCallback();
    window.history.replaceState({}, '', appState?.returnTo || '/');
  } catch (error) {
    window.history.replaceState({}, '', '/');
    throw new AuthError(error.error || 'callback_failed', error.error_description || error.message);
  }
}

/**
 * Start the session when the app loads: finish a sign-in on the callback, then check for a session.
 * Runs once, so a second call (React StrictMode) reuses the first result.
 * @returns {Promise<SessionUser | null>} signed-in user, or null when the user must sign in
 * @throws {AuthError} when sign-in cannot work here or the callback carried an error
 */
function initAuth() {
  if (IS_AUTH_BYPASSED) {
    currentUser = BYPASS_USER;
    console.warn('Sign-in is bypassed (REACT_APP_AUTH_BYPASS). Development only.');
    return Promise.resolve(currentUser);
  }
  if (!initPromise) {
    initPromise = (async () => {
      const auth0 = getClient();
      if (isCallback()) await handleCallback();
      if (!(await auth0.isAuthenticated())) return null;
      try {
        // Also proves the refresh token still works: an ended session goes straight to sign-in
        const token = await getToken();
        currentUser = toSessionUser(await auth0.getUser(), token);
        return currentUser;
      } catch (error) {
        if (error.code === 'session_ended') return null;
        throw error;
      }
    })();
    // A failed start can be tried again (e.g. after the network comes back)
    initPromise.catch(() => {
      initPromise = null;
    });
  }
  return initPromise;
}

/**
 * Send the browser to the Auth0 login page (a redirect: mobile browsers block popups)
 * @param {object} [options] - sign-in options
 * @param {boolean} [options.forceLogin] - show the Auth0 login form even when Auth0 still has a
 *   session. Used after an error (e.g. access denied), so Auth0 does not send the same error
 *   straight back and the browser does not bounce between the app and Auth0
 * @param {string} [options.returnTo] - page to open after the sign-in
 * @returns {Promise<void>} resolves as the browser leaves the app
 */
async function signIn({ forceLogin = false, returnTo = window.location.pathname } = {}) {
  await getClient().loginWithRedirect({
    appState: { returnTo: returnTo === '/callback' ? '/' : returnTo },
    authorizationParams: forceLogin ? { prompt: 'login' } : undefined,
  });
}

/**
 * Sign out of Auth0 and remove everything the app keeps in the browser: localStorage (tokens,
 * active rig, theme), sessionStorage and cookies
 * @returns {Promise<void>} resolves as the browser leaves the app
 */
async function signOut() {
  if (IS_AUTH_BYPASSED) {
    clearBrowserData();
    window.location.reload();
    return;
  }
  currentUser = null;
  initPromise = null;
  await getClient().logout({
    logoutParams: { returnTo: window.location.origin },
    // Auth0 has removed its own tokens by now; clear the rest, then end the Auth0 session too
    openUrl: (url) => {
      clearBrowserData();
      window.location.assign(url);
    },
  });
}

/**
 * Get a valid access token: the cached one, or a new one from the refresh token near expiry.
 * Call it before every API call and do not keep the token.
 * @param {object} [options] - token options
 * @param {boolean} [options.forceRefresh] - skip the cache, e.g. after a 401
 * @returns {Promise<string | null>} access token, or null when sign-in is bypassed in development
 * @throws {AuthError} session_ended when the refresh token has ended; the app shows the sign-in page
 */
async function getToken({ forceRefresh = false } = {}) {
  if (IS_AUTH_BYPASSED) return null;
  try {
    return await getClient().getTokenSilently({
      authorizationParams: { audience: AUTH_CONFIG.audience },
      cacheMode: forceRefresh ? 'off' : 'on',
    });
  } catch (error) {
    if (error instanceof AuthError) throw error;
    if (SESSION_ENDED_ERRORS.includes(error.error)) {
      currentUser = null;
      sessionEndedListeners.forEach((listener) => listener());
      throw new AuthError('session_ended', EXPIRED_MESSAGE);
    }
    throw new AuthError(error.error || 'token_failed', error.error_description || error.message);
  }
}

/**
 * Get the signed-in user without waiting
 * @returns {SessionUser | null} user, or null before sign-in
 */
function getSessionUser() {
  return currentUser;
}

/**
 * Be told when the refresh token ends and the user must sign in again
 * @param {() => void} listener - called once per ended session
 * @returns {() => void} removes the listener
 */
function onSessionEnded(listener) {
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
}

/**
 * True when the user may write: submit logbook entries and acknowledge alerts. For the screen only;
 * the Designer refuses a write without the permission anyway (401)
 * @param {SessionUser | null} user - signed-in user
 * @returns {boolean} true with the write:digital_twin permission
 */
function canWrite(user) {
  return Boolean(user?.permissions?.includes(WRITE_PERMISSION));
}

export { AuthError, canWrite, EXPIRED_MESSAGE, getSessionUser, getToken, initAuth, onSessionEnded, signIn, signOut };
