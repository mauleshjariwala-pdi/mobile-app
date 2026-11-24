/**
 * auth.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Constants
const mockClient = {
  isAuthenticated: jest.fn(),
  getUser: jest.fn(),
  getTokenSilently: jest.fn(),
  handleRedirectCallback: jest.fn(),
  loginWithRedirect: jest.fn(),
  logout: jest.fn(),
};

jest.mock('@auth0/auth0-spa-js', () => ({ Auth0Client: jest.fn(() => mockClient) }));
jest.mock('./authConfig', () => ({
  AUTH_CONFIG: {
    domain: 'tenant.test',
    clientId: 'client-id',
    audience: 'https://aud.test',
    scope: 'openid profile email offline_access',
    redirectUri: 'http://localhost/callback',
    claimNamespace: 'https://aud.test/',
  },
}));

// A JWT whose payload holds the given claims (the app does not check the signature)
const jwt = (claims) => `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.s`;

/**
 * Load a fresh copy of the real auth module (setupTests mocks it for the other tests)
 * @returns {object} auth module
 */
function loadAuth() {
  let auth;
  jest.isolateModules(() => {
    auth = jest.requireActual('./auth');
  });
  return auth;
}

beforeEach(() => {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(window, 'crypto', { value: { subtle: {} }, configurable: true });
  window.history.replaceState({}, '', '/');
  mockClient.isAuthenticated.mockResolvedValue(true);
  mockClient.getUser.mockResolvedValue({ sub: 'auth0|1', name: 'Jane Doe', given_name: 'Jane', family_name: 'Doe' });
  mockClient.getTokenSilently.mockResolvedValue(
    jwt({
      permissions: ['read:designer'],
      'https://aud.test/role': 'Viewer',
      'https://aud.test/username': 'jdoe',
      'https://aud.test/email': 'jdoe@example.com',
      'https://aud.test/rig_access': { all: false, rigs: [118] },
    })
  );
  mockClient.handleRedirectCallback.mockResolvedValue({});
  mockClient.loginWithRedirect.mockResolvedValue(undefined);
});

test('starts a session from the stored tokens and reads the claims', async () => {
  const user = await loadAuth().initAuth();
  expect(user).toEqual({
    id: 'auth0|1',
    login: 'jdoe',
    email: 'jdoe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'Viewer',
    permissions: ['read:designer'],
    rigAccess: { all: false, rigs: [118] },
  });
  expect(mockClient.getTokenSilently).toHaveBeenCalledWith({
    authorizationParams: { audience: 'https://aud.test' },
    cacheMode: 'on',
  });
});

test('no session means sign-in', async () => {
  mockClient.isAuthenticated.mockResolvedValue(false);
  expect(await loadAuth().initAuth()).toBeNull();
});

test('an ended refresh token means sign-in, and listeners are told', async () => {
  const auth = loadAuth();
  const listener = jest.fn();
  auth.onSessionEnded(listener);
  mockClient.getTokenSilently.mockRejectedValue(Object.assign(new Error('x'), { error: 'missing_refresh_token' }));
  expect(await auth.initAuth()).toBeNull();
  expect(listener).toHaveBeenCalledTimes(1);
});

test('finishes the callback and returns to the starting page', async () => {
  window.history.replaceState({}, '', '/callback?code=abc&state=xyz');
  mockClient.handleRedirectCallback.mockResolvedValue({ appState: { returnTo: '/history' } });
  await loadAuth().initAuth();
  expect(mockClient.handleRedirectCallback).toHaveBeenCalledTimes(1);
  expect(window.location.pathname).toBe('/history');
});

test('access_denied on the callback is shown, not sent back to Auth0', async () => {
  window.history.replaceState({}, '', '/callback?error=access_denied&error_description=No%20access&state=xyz');
  await expect(loadAuth().initAuth()).rejects.toMatchObject({ code: 'access_denied', message: 'No access' });
  expect(mockClient.loginWithRedirect).not.toHaveBeenCalled();
  expect(window.location.search).toBe('');
});

test('signs in with a redirect; after an error it asks Auth0 for the login form', async () => {
  const auth = loadAuth();
  await auth.signIn({ returnTo: '/' });
  expect(mockClient.loginWithRedirect).toHaveBeenLastCalledWith({
    appState: { returnTo: '/' },
    authorizationParams: undefined,
  });
  await auth.signIn({ forceLogin: true, returnTo: '/callback' });
  expect(mockClient.loginWithRedirect).toHaveBeenLastCalledWith({
    appState: { returnTo: '/' },
    authorizationParams: { prompt: 'login' },
  });
});

test('needs HTTPS', async () => {
  Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
  await expect(loadAuth().initAuth()).rejects.toMatchObject({ code: 'insecure_origin' });
});

test('signing out ends the Auth0 session and clears localStorage, sessionStorage and cookies first', async () => {
  const auth = loadAuth();
  localStorage.setItem('activeRig', '575');
  localStorage.setItem('theme', 'dark');
  sessionStorage.setItem('draft', '1');
  document.cookie = 'tracking=abc; path=/';
  await auth.signOut();
  const [{ logoutParams, openUrl }] = mockClient.logout.mock.calls.at(-1);
  expect(logoutParams).toEqual({ returnTo: window.location.origin });
  // Auth0 calls openUrl with its logout URL after removing its own tokens. jsdom cannot navigate
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  openUrl('https://tenant.test/v2/logout');
  consoleError.mockRestore();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
  expect(document.cookie).toBe('');
});
