/**
 * AuthProvider.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
// Prescient Devices imports
import { ensureAllowedRig } from '../config/activeRig';
import { unregisterPushDevice } from '../notification/pushRegistration';
import { initAuth, onSessionEnded, signIn, signOut } from './auth';

/**
 * @typedef {object} AuthState
 * @property {'loading' | 'redirecting' | 'unavailable' | 'signedIn'} status - session state;
 *   unavailable when sign-in cannot run on this page (e.g. plain HTTP)
 * @property {import('./auth').SessionUser | null} user - signed-in user
 * @property {string} error - why sign-in is unavailable
 * @property {() => Promise<void>} signOut - signs out of Auth0
 */

// Constants
const AuthContext = createContext(/** @type {AuthState | null} */ (null));
// Errors that a redirect cannot fix: sign-in cannot start on this page
const UNRECOVERABLE = ['insecure_origin', 'not_configured'];

/**
 * Hold the session for the app: finish the sign-in on the callback and keep the user. Without a
 * session, after an error or when the refresh token ends, the browser goes to the Auth0 login page
 * @param {object} props - component props
 * @param {import('react').ReactNode} props.children - app
 * @returns {JSX.Element} provider
 */
function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  // Go to the Auth0 login page. Only when that cannot start (no HTTPS, sign-in not set up) does the
  // app stay and show why: there is no login page in the app
  const redirectToLogin = useCallback(async ({ forceLogin = false } = {}) => {
    setStatus('redirecting');
    try {
      await signIn({ forceLogin });
    } catch (signInError) {
      setError(signInError.message || 'Unable to open the sign-in page.');
      setStatus('unavailable');
    }
  }, []);
  useEffect(() => {
    let isActive = true;
    initAuth()
      .then(async (sessionUser) => {
        if (!isActive) return;
        if (!sessionUser) {
          redirectToLogin();
          return;
        }
        // Before the first request: drop a rig the user may not see, take the only one if just one.
        // Users with countries but no rigs in their token get their rigs from the API here
        await ensureAllowedRig(sessionUser);
        if (!isActive) return;
        setUser(sessionUser);
        setStatus('signedIn');
      })
      .catch((initError) => {
        if (!isActive) return;
        // Sign-in cannot run on this page at all: a redirect would fail the same way
        if (UNRECOVERABLE.includes(initError.code)) {
          setError(initError.message);
          setStatus('unavailable');
          return;
        }
        // Any other error (access denied, failed callback): back to the Auth0 login form
        redirectToLogin({ forceLogin: true });
      });
    // The refresh token ended during use (30 days unused, account blocked): sign in again
    const removeListener = onSessionEnded(() => {
      setUser(null);
      redirectToLogin();
    });
    return () => {
      isActive = false;
      removeListener();
    };
  }, [redirectToLogin]);
  const handleSignOut = useCallback(async () => {
    try {
      // Release this device first: DELETE needs the access token, which sign-out removes. Never fails
      await unregisterPushDevice();
      await signOut();
    } catch (signOutError) {
      setError(signOutError.message || 'Unable to sign out.');
    }
  }, []);
  const value = useMemo(() => ({ status, user, error, signOut: handleSignOut }), [status, user, error, handleSignOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Read the session
 * @returns {AuthState} session state and actions
 */
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export { AuthProvider, useAuth };
