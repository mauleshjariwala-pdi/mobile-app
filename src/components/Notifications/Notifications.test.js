/**
 * Notifications.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
// Prescient Devices imports
import { setActiveRig } from '../../config/activeRig';
import { acknowledgeSmartAlert } from '../../api/smartAlertApi';
import Notifications from './Notifications';
import { formatDuration } from './notificationsData';
import { useSmartAlerts } from './useSmartAlerts';

jest.mock('../../config/appConfig', () => ({
  APP_CONFIG: {
    digitalTwinID: 'TWIN',
    userToken: 'USER_TOKEN',
    user: { login: 'john.doe', userId: '42', email: 'john.doe@example.com' },
    mudPumps: ['1'],
    logbook: { baseUrl: '', authKey: '' },
    ruleEngine: { baseUrl: 'https://designer.test/rules', authKey: 'RULE_KEY' },
  },
}));

const HOUR_MS = 60 * 60 * 1000;
// Shape returned by the live service: type "alarm" and the key spelled "componenet"
const ALARM = {
  Acknowledged: false,
  mudpumpID: '1',
  rigID: '001',
  rule: 'rule2',
  type: 'alarm',
  additionalInfo: 'sensor disconnected for more than 30 minutes',
  alertID: 'alarmTest234',
  componenet: 'Fluid End Hole 1',
  moduleInfo: 'Check PE CH2 in MUDPUMP 3',
  startTime: Date.now() - (25 * 60 + 21) * 60 * 1000,
  pumpHoursInfo: 'Pump on time since alert started: 108hr',
  priority: 5,
};
// Documented rule2 warning
const WARNING = {
  Acknowledged: false,
  component: 'PE H3',
  mudpumpID: '2',
  rigID: '001',
  rule: 'rule2',
  type: 'warning',
  additionalInfo: 'in warning for more than 1 hour',
  alertID: '7032PEH31789944000000',
  moduleInfo: 'Check Power End 3 in MUDPUMP 2',
  startTime: Date.now() - 2 * HOUR_MS,
  pumpHoursInfo: '',
  priority: 5,
};

// Acknowledged alert, as returned with ack=true
const ACKNOWLEDGED = {
  Acknowledged: true,
  mudpumpID: '1',
  rigID: '001',
  rule: 'rule2',
  type: 'warning',
  additionalInfo: 'in warning for more than 1 hour',
  alertID: 'ack-1',
  component: 'PE H1',
  moduleInfo: 'Check Power End 1 in MUDPUMP 1',
  startTime: Date.now() - 5 * HOUR_MS,
  acknowledgedTime: Date.now() - HOUR_MS,
};

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });
const isAcknowledgedRequest = (url) => new URL(url).searchParams.get('ack') === 'true';
const smartAlertsResponse = (open, acknowledged) => async (url) =>
  jsonResponse(isAcknowledgedRequest(url) ? acknowledged : open);
const card = (title) => screen.findByRole('article', { name: title });

/**
 * Wire the page to the hook the same way App does
 * @returns {JSX.Element} notifications page
 */
function Harness() {
  const { status, alerts, error, reload } = useSmartAlerts();
  const handleAcknowledge = async (alertID) => {
    try {
      await acknowledgeSmartAlert(alertID);
    } finally {
      reload({ silent: true });
    }
  };
  return (
    <Notifications
      notifications={alerts}
      status={status}
      error={error}
      onReload={reload}
      onAcknowledge={handleAcknowledge}
    />
  );
}

beforeEach(() => {
  // The rig the user picked (first-time page or Switch Rigs)
  setActiveRig('001');
  global.fetch = jest.fn(smartAlertsResponse([ALARM, WARNING], []));
});

test('formats alert durations', () => {
  expect(formatDuration((25 * 60 + 21) * 60 * 1000)).toBe('25h 21m');
  expect(formatDuration(45 * 60 * 1000)).toBe('45m');
  expect(formatDuration(10 * 1000)).toBe('Just now');
});

test('requests unacknowledged and acknowledged alerts for the configured rig', async () => {
  render(<Harness />);
  await card('Check PE CH2 in MUDPUMP 3');
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(isAcknowledgedRequest(global.fetch.mock.calls[1][0])).toBe(true);
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toMatch(/^https:\/\/designer\.test\/rules\/api\/private\/rig\/smartAlert\/v2\?/);
  expect(Object.fromEntries(new URL(url).searchParams)).toEqual({
    digitalTwinID: 'TWIN',
    rig: '001',
    ack: 'false',
    type: 'aro',
    userToken: 'USER_TOKEN',
  });
  expect(options).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer test-access-token' } });
});

test('shows skeleton cards while loading', async () => {
  render(<Harness />);
  expect(screen.getByRole('status', { name: 'Loading notifications' })).toBeInTheDocument();
  await card('Check PE CH2 in MUDPUMP 3');
  expect(screen.queryByRole('status', { name: 'Loading notifications' })).not.toBeInTheDocument();
});

test('maps API alerts to cards with priority, reason and details', async () => {
  render(<Harness />);
  const alarm = await card('Check PE CH2 in MUDPUMP 3');
  expect(alarm).toHaveClass('nt-card--critical');
  expect(screen.queryByText('New')).not.toBeInTheDocument();
  expect(within(alarm).getByText('Sensor disconnected for more than 30 minutes.')).toBeInTheDocument();
  expect(within(alarm).getByText('25h 21m')).toBeInTheDocument();
  expect(within(alarm).getByText('Fluid End Hole 1')).toBeInTheDocument();
  expect(within(alarm).getByText(/Pump on time since alert started/)).toHaveTextContent('108hr');
  const warning = await card('Check Power End 3 in MUDPUMP 2');
  expect(warning).toHaveClass('nt-card--warning');
  expect(within(warning).getByText('PE H3')).toBeInTheDocument();
  // Critical alerts are listed before warnings
  expect(alarm.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('acknowledged alerts are listed under Acknowledged with their acknowledge time', async () => {
  global.fetch.mockImplementation(smartAlertsResponse([ALARM], [ACKNOWLEDGED]));
  render(<Harness />);
  const acknowledged = await card('Check Power End 1 in MUDPUMP 1');
  expect(acknowledged).toHaveClass('nt-card--acknowledged');
  expect(within(acknowledged).queryByRole('button', { name: /Acknowledge/ })).not.toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Acknowledged' })).getAllByRole('article')).toHaveLength(1);
  expect(within(screen.getByRole('region', { name: 'Active' })).getByRole('article')).toHaveAccessibleName(
    'Check PE CH2 in MUDPUMP 3'
  );
  // The Unacknowledged filter hides acknowledged alerts
  fireEvent.click(screen.getByRole('tab', { name: 'Unacknowledged' }));
  expect(screen.queryByText('Check Power End 1 in MUDPUMP 1')).not.toBeInTheDocument();
});

test('active alerts still show when the acknowledged request fails', async () => {
  global.fetch.mockImplementation(async (url) =>
    isAcknowledgedRequest(url) ? { ok: false, status: 500, json: async () => ({}) } : jsonResponse([ALARM])
  );
  render(<Harness />);
  expect(await card('Check PE CH2 in MUDPUMP 3')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('the "unavailable" placeholder shows the empty state', async () => {
  global.fetch.mockResolvedValue(jsonResponse({ table: [{ Acknowledged: false, type: 'unavailable' }] }));
  render(<Harness />);
  expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  expect(screen.getByText('There are no unacknowledged alerts.')).toBeInTheDocument();
});

test('shows an error with Retry, and Refresh fetches again', async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
  render(<Harness />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Smart alert request failed (500).');
  global.fetch.mockImplementation(smartAlertsResponse([WARNING], []));
  fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
  expect(await card('Check Power End 3 in MUDPUMP 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  // Each load requests the unacknowledged and the acknowledged alerts
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(6));
  expect(await card('Check Power End 3 in MUDPUMP 2')).toBeInTheDocument();
});

test('filters by priority', async () => {
  render(<Harness />);
  await card('Check PE CH2 in MUDPUMP 3');
  fireEvent.click(screen.getByRole('tab', { name: 'Warning' }));
  expect(screen.queryByText('Check PE CH2 in MUDPUMP 3')).not.toBeInTheDocument();
  expect(screen.getByText('Check Power End 3 in MUDPUMP 2')).toBeInTheDocument();
});

test('Acknowledge sends a POST for the alert, confirms and reloads the list', async () => {
  // GET returns both alerts first; after the POST only the warning is still unacknowledged
  let alerts = [ALARM, WARNING];
  global.fetch.mockImplementation(async (url, options) => {
    if (options.method === 'POST') {
      alerts = [WARNING];
      return jsonResponse({});
    }
    return jsonResponse(isAcknowledgedRequest(url) ? [] : alerts);
  });
  render(<Harness />);
  const alarm = await card('Check PE CH2 in MUDPUMP 3');
  fireEvent.click(within(alarm).getByRole('button', { name: /Acknowledge/ }));
  // Every Acknowledge button is locked while the request runs
  expect(within(alarm).getByRole('button', { name: /Acknowledging/ })).toBeDisabled();
  expect(screen.getAllByRole('button', { name: /Acknowledge/ }).every((b) => b.disabled)).toBe(true);
  expect(await screen.findByRole('status')).toHaveTextContent('Acknowledged!');
  const [url, options] = global.fetch.mock.calls.find(([, o]) => o.method === 'POST');
  expect(url).toMatch(/^https:\/\/designer\.test\/rules\/api\/private\/rig\/smartAlert\/v2\?/);
  expect(Object.fromEntries(new URL(url).searchParams)).toEqual({
    userlogin: 'john.doe',
    useremail: 'john.doe@example.com',
    userid: '42',
    alertid: 'alarmTest234',
    ackType: '1',
  });
  expect(url).toContain('useremail=john.doe%40example.com');
  expect(options).toMatchObject({
    method: 'POST',
    headers: { Authorization: 'Bearer test-access-token', 'Content-Type': 'application/json' },
  });
  expect(JSON.parse(options.body)).toEqual({ digitalTwinID: 'TWIN', userToken: 'USER_TOKEN', rig: '001' });
  // The list reloads without the skeleton and the acknowledged alert is gone
  await waitFor(() => expect(screen.queryByText('Check PE CH2 in MUDPUMP 3')).not.toBeInTheDocument());
  expect(global.fetch).toHaveBeenCalledTimes(5);
  expect(screen.queryByRole('status', { name: 'Loading notifications' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Acknowledge/ })).toBeEnabled();
});

test('a failed acknowledge shows an error and still reloads the list', async () => {
  global.fetch.mockImplementation(async (url, options) =>
    options.method === 'POST'
      ? { ok: false, status: 500, json: async () => ({}) }
      : jsonResponse(isAcknowledgedRequest(url) ? [] : [ALARM])
  );
  render(<Harness />);
  const alarm = await card('Check PE CH2 in MUDPUMP 3');
  fireEvent.click(within(alarm).getByRole('button', { name: /Acknowledge/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Error acknowledging the alert (500).');
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(5));
  expect(await card('Check PE CH2 in MUDPUMP 3')).toBeInTheDocument();
});
