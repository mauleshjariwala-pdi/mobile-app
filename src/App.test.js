/**
 * App.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { onMessage } from 'firebase/messaging';
// Prescient Devices imports
import App from './App';
import { TEST_USER, initAuth, signIn, signOut } from './auth/auth';
import { clearActiveRig, setActiveRig } from './config/activeRig';
import { registerMessagingServiceWorker } from './notification/firebase';

jest.mock('firebase/messaging', () => ({
  onMessage: jest.fn(() => jest.fn()),
}));

jest.mock('./config/appConfig', () => ({
  APP_CONFIG: {
    digitalTwinID: 'TWIN',
    userToken: 'USER_TOKEN',
    mudPumps: ['1'],
    logbook: { baseUrl: 'https://designer.test/logbook', authKey: 'LOGBOOK_KEY' },
    ruleEngine: { baseUrl: 'https://designer.test/rules', authKey: 'RULE_KEY' },
  },
}));

jest.mock('./notification/firebase', () => ({
  registerMessagingServiceWorker: jest.fn(),
  messaging: {},
}));

const HISTORY_RECORD = {
  purpose: 'Repair',
  mudpump: '1',
  rigID: '703',
  dateOfRepair: Date.now() - 60 * 60 * 1000,
  uid: 'r1',
  componentChanged: 'Liner 1',
  KCF: 'Alarm',
  comments: 'test',
  valid: 1,
};

const SMART_ALERT = {
  Acknowledged: false,
  mudpumpID: '1',
  type: 'alarm',
  alertID: 'alert-1',
  moduleInfo: 'Check PE CH2 in MUDPUMP 3',
  additionalInfo: 'sensor disconnected for more than 30 minutes',
  startTime: Date.now() - 60 * 60 * 1000,
};

// Let requests started by the last step finish, so their updates land inside the test
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

// Render the app and wait for the start-up smart alert request to settle
const renderApp = async () => {
  render(<App />);
  await screen.findByRole('button', { name: 'Alerts, 1 new' });
};

beforeEach(() => {
  // The rig the user picked (first-time page or Switch Rigs)
  setActiveRig('703');
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
  registerMessagingServiceWorker.mockResolvedValue({
    showNotification: jest.fn().mockResolvedValue(undefined),
  });
  // Logbook history and smart alert requests get one record; anything else (test notification) just succeeds
  global.fetch = jest.fn(async (url) => {
    if (String(url).includes('/api/private/pump/logbook')) {
      return { ok: true, status: 200, json: async () => [HISTORY_RECORD] };
    }
    if (String(url).includes('/api/private/rigs/bycountry')) {
      const country = new URL(url).searchParams.get('country');
      const rigs = { US: [49, 575], CA: [101, 49] }[country] ?? [];
      return { ok: true, status: 200, text: async () => JSON.stringify(rigs) };
    }
    if (String(url).includes('/api/private/rig/layout')) {
      const rig = new URL(url).searchParams.get('rig');
      const layout = { rig, units: 'imperial', pumps: { present: true, count: 2, ids: [1, 2], model: null } };
      return { ok: true, status: 200, text: async () => JSON.stringify(layout) };
    }
    if (String(url).includes('/api/private/rig/smartAlert/v2')) {
      const isAcknowledged = new URL(url).searchParams.get('ack') === 'true';
      return { ok: true, status: 200, json: async () => (isAcknowledged ? [] : [SMART_ALERT]) };
    }
    return { ok: true };
  });
});

test('displays foreground FCM messages as browser notifications', async () => {
  let receiveMessage;
  const showNotification = jest.fn().mockResolvedValue(undefined);
  onMessage.mockImplementation((messaging, callback) => {
    receiveMessage = callback;
    return jest.fn();
  });
  registerMessagingServiceWorker.mockResolvedValue({ showNotification });
  await renderApp();
  await act(async () => {
    await receiveMessage({ notification: { title: 'Hello', body: 'Foreground test' } });
  });
  expect(showNotification).toHaveBeenCalledWith('Hello', {
    body: 'Foreground test',
    icon: '/logo192.png',
  });
});

test('tapping a bottom-nav tab resets that page to its default view', async () => {
  await renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  fireEvent.click(await screen.findByText('Liner 1'));
  expect(screen.getByRole('heading', { name: 'Entry Details' })).toBeInTheDocument();
  // Tap the already-active History tab again
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(screen.getByRole('heading', { name: 'Logbook History' })).toBeInTheDocument();
  // Logbook form returns to the purpose cards
  fireEvent.click(screen.getByRole('button', { name: 'Logbook' }));
  fireEvent.click(await screen.findByRole('radio', { name: 'Mud pump 1' }));
  fireEvent.click(screen.getByRole('radio', { name: /Repair/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Start Logging' }));
  expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Logbook' }));
  expect(screen.getByRole('heading', { name: 'Select equipment to begin' })).toBeInTheDocument();
  // The page refreshes the saved rig layout in the background
  await settle();
});

test('Settings switches the screen mode and remembers it', async () => {
  await renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  const screenMode = screen.getByRole('radiogroup', { name: 'Screen mode' });
  const light = within(screenMode).getByRole('radio', { name: 'Light' });
  const dark = within(screenMode).getByRole('radio', { name: 'Dark' });
  expect(light).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(dark);
  expect(dark).toHaveAttribute('aria-checked', 'true');
  expect(light).toHaveAttribute('aria-checked', 'false');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('theme')).toBe('dark');
  fireEvent.click(light);
  expect(document.documentElement.dataset.theme).toBe('light');
});

test('Settings has only the appearance and account sections and confirms before logging out', async () => {
  await renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Support' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Log out?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Log out' }));
  // Signs out of Auth0, which leaves the app for the Auth0 logout page
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
});

test('Settings shows the rig and the signed-in user', async () => {
  await renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByRole('heading', { name: 'Rig 703' })).toBeInTheDocument();
  const account = screen.getByRole('region', { name: 'Account' });
  expect(within(account).getByText('John Carter')).toBeInTheDocument();
});

test('the app opens on the Alerts tab', async () => {
  await renderApp();
  expect(screen.getByRole('heading', { name: 'Smart Alerts' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Alerts, 1 new' })).toHaveAttribute('aria-current', 'page');
});

test('Alerts tab lists the smart alerts and the nav shows the count', async () => {
  await renderApp();
  expect(screen.getByRole('button', { name: 'Alerts, 1 new' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Alerts, 1 new' }));
  expect(await screen.findByRole('article', { name: 'Check PE CH2 in MUDPUMP 3' })).toBeInTheDocument();
});

test('without a session the app goes straight to the Auth0 login page; there is no login form', async () => {
  initAuth.mockResolvedValueOnce(null);
  render(<App />);
  await waitFor(() => expect(signIn).toHaveBeenCalledWith({ forceLogin: false }));
  expect(screen.getByRole('status')).toHaveTextContent('Opening sign-in…');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
});

test('after an error (e.g. access denied) the app goes back to the Auth0 login form, not a loop', async () => {
  initAuth.mockRejectedValueOnce(
    Object.assign(new Error('Your account has no access to this app.'), { code: 'access_denied' })
  );
  render(<App />);
  // prompt=login: Auth0 shows its form instead of sending the same error straight back
  await waitFor(() => expect(signIn).toHaveBeenCalledWith({ forceLogin: true }));
});

test('when sign-in cannot run here (plain HTTP) the reason is shown instead of a redirect', async () => {
  initAuth.mockRejectedValueOnce(
    Object.assign(new Error('Sign-in needs HTTPS. Open the app over https://.'), { code: 'insecure_origin' })
  );
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in needs HTTPS. Open the app over https://.');
  expect(signIn).not.toHaveBeenCalled();
});

test('Switch Rigs shows the active rig, and Save switches every page and request to the new rig', async () => {
  initAuth.mockResolvedValueOnce({ ...TEST_USER, rigAccess: { all: false, rigs: [703, 575, 875] } });
  await renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Switch Rigs' }));
  expect(screen.getByRole('heading', { name: 'Select rig' })).toBeInTheDocument();
  const rigs = screen.getByRole('radiogroup', { name: 'Rigs' });
  // The active rig is selected when the page opens, so Save waits for another choice
  expect(within(rigs).getByRole('radio', { name: 'Rig 703 (active)' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.click(within(rigs).getByRole('radio', { name: 'Rig 575' }));
  global.fetch.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  // Back on Settings with the new rig, which is remembered on this device
  expect(screen.getByRole('heading', { name: 'Rig 575' })).toBeInTheDocument();
  expect(localStorage.getItem('activeRig')).toBe('575');
  // The alerts of the new rig are loaded
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const alertUrls = global.fetch.mock.calls
    .map(([url]) => new URL(url))
    .filter((u) => u.pathname.endsWith('/smartAlert/v2'));
  expect(alertUrls.length).toBeGreaterThan(0);
  alertUrls.forEach((u) => expect(u.searchParams.get('rig')).toBe('575'));
  // Reopening the page shows the new rig as active
  fireEvent.click(screen.getByRole('button', { name: 'Switch Rigs' }));
  expect(screen.getByRole('radio', { name: 'Rig 575 (active)' })).toBeChecked();
  act(() => setActiveRig('703'));
  localStorage.removeItem('activeRig');
  // Switching back reloads that rig's alerts
  await settle();
});

test('a read-only user (no write:digital_twin) sees no Acknowledge, cannot start an entry and cannot edit history', async () => {
  initAuth.mockResolvedValueOnce({ ...TEST_USER, permissions: ['read:digital_twin'] });
  await renderApp();
  expect(await screen.findByText('Check PE CH2 in MUDPUMP 3')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Acknowledge/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Logbook' }));
  fireEvent.click(await screen.findByRole('radio', { name: 'Mud pump 1' }));
  fireEvent.click(screen.getByRole('radio', { name: /Repair/ }));
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Next' })).toHaveAccessibleDescription(
    'Your account can view the logbook but cannot add entries.'
  );
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  await screen.findByText(/Submitted on/);
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
});

test('an account with no rig gets the "Rig Access Restricted" page and no API calls', async () => {
  initAuth.mockResolvedValueOnce({ ...TEST_USER, rigAccess: { all: false, countries: [], rigs: [] } });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Rig Access Restricted' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('jcarter is signed in, but has no rigs assigned yet.');
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
});

test('access by country alone reads the rigs of each country from the API and offers them', async () => {
  clearActiveRig();
  initAuth.mockResolvedValueOnce({ ...TEST_USER, rigAccess: { all: false, countries: ['us', 'CA'], rigs: [] } });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Select rig' })).toBeInTheDocument();
  const countries = global.fetch.mock.calls
    .map(([url]) => new URL(url))
    .filter((u) => u.pathname.endsWith('/api/private/rigs/bycountry'))
    .map((u) => u.searchParams.get('country'));
  expect(countries).toEqual(['US', 'CA']);
  // Merged without duplicates, in rig order
  const rigs = screen.getByRole('radiogroup', { name: 'Rigs' });
  expect(
    within(rigs)
      .getAllByRole('radio')
      .map((r) => r.value)
  ).toEqual(['49', '101', '575']);
});

test('access by country with no rigs there says no rigs are available', async () => {
  clearActiveRig();
  initAuth.mockResolvedValueOnce({ ...TEST_USER, rigAccess: { all: false, countries: ['AR'], rigs: [] } });
  render(<App />);
  expect(await screen.findByText('No rigs available.')).toBeInTheDocument();
});

test('access by country with one rig there picks it without asking', async () => {
  clearActiveRig();
  initAuth.mockResolvedValueOnce({ ...TEST_USER, rigAccess: { all: false, countries: ['ME'], rigs: [] } });
  global.fetch.mockImplementationOnce(async () => ({ ok: true, status: 200, text: async () => '[812]' }));
  await renderApp();
  expect(localStorage.getItem('activeRig')).toBe('812');
});

test('access by country with named rigs offers only those rigs', async () => {
  clearActiveRig();
  initAuth.mockResolvedValueOnce({ ...TEST_USER, rigAccess: { all: false, countries: ['US'], rigs: [575] } });
  await renderApp();
  expect(localStorage.getItem('activeRig')).toBe('575');
});

test('Switch Rigs search filters the rig tiles and Enter does not save', async () => {
  initAuth.mockResolvedValueOnce({ ...TEST_USER, rigAccess: { all: false, rigs: [703, 575, 875, 1575] } });
  await renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Switch Rigs' }));
  const search = screen.getByRole('searchbox', { name: 'Search rigs' });
  const shownRigs = () =>
    within(screen.getByRole('radiogroup', { name: 'Rigs' }))
      .getAllByRole('radio')
      .map((r) => r.value);
  fireEvent.change(search, { target: { value: ' 575 ' } });
  expect(shownRigs()).toEqual(['575', '1575']);
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(screen.getByRole('heading', { name: 'Switch Rigs' })).toBeInTheDocument();
  fireEvent.change(search, { target: { value: '42' } });
  expect(screen.getByRole('status')).toHaveTextContent('No rigs match "42".');
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(shownRigs()).toEqual(['703', '575', '875', '1575']);
});

test('first time: the rig must be picked before the app opens', async () => {
  clearActiveRig();
  initAuth.mockResolvedValueOnce({ ...TEST_USER, rigAccess: { all: false, rigs: [575, 875] } });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Select rig' })).toBeInTheDocument();
  // Nothing else is reachable and nothing is requested yet
  expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
  const save = screen.getByRole('button', { name: 'Save' });
  expect(save).toBeDisabled();
  expect(save).toHaveAccessibleDescription('Select a rig to continue.');
  fireEvent.click(screen.getByRole('radio', { name: 'Rig 875' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('button', { name: 'Alerts, 1 new' })).toBeInTheDocument();
  expect(localStorage.getItem('activeRig')).toBe('875');
  const alertUrl = global.fetch.mock.calls
    .map(([url]) => new URL(url))
    .find((u) => u.pathname.endsWith('/smartAlert/v2'));
  expect(alertUrl.searchParams.get('rig')).toBe('875');
});

test('first time with only one rig: it is picked without asking', async () => {
  clearActiveRig();
  initAuth.mockResolvedValueOnce({ ...TEST_USER, rigAccess: { all: false, rigs: [575] } });
  await renderApp();
  expect(localStorage.getItem('activeRig')).toBe('575');
});

test('a saved rig the user lost access to is dropped, so they pick again', async () => {
  setActiveRig('999');
  initAuth.mockResolvedValueOnce({ ...TEST_USER, rigAccess: { all: false, rigs: [575, 875] } });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Select rig' })).toBeInTheDocument();
});
