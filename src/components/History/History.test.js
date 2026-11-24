/**
 * History.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
// Prescient Devices imports
import { setActiveRig } from '../../config/activeRig';
import History from './History';
import { formatSubmittedDate } from './historyData';

jest.mock('../../config/appConfig', () => ({
  APP_CONFIG: {
    digitalTwinID: 'TWIN',
    userToken: 'USER_TOKEN',
    mudPumps: ['1', '2'],
    logbook: { baseUrl: 'https://designer.test/logbook', authKey: 'LOGBOOK_KEY' },
    ruleEngine: { baseUrl: '', authKey: '' },
  },
}));

// Dates relative to now so the entries stay inside the 14-day window
const hoursAgo = (hours) => Date.now() - hours * 60 * 60 * 1000;

const REPAIR_RECORD = {
  purpose: 'Repair',
  mudpump: '1',
  rigID: '703',
  dateOfRepair: hoursAgo(2),
  timeEntered: 1793006010214,
  uid: '70311793006010214',
  username: 'john.doe',
  componentChanged: 'Liner 1,Disch. Valve 1',
  Liner_1_brand: 'Mission : Zirconia',
  Disch_Valve_1_brand: 'Forum : 3-WEB HT',
  linerSize: '4.5',
  reUseLiners: 'No',
  liner1Hours: 0,
  wearplateInspected: 'Yes',
  mudType: 'Water-based mud',
  mudWeight: 10.2,
  mudWeightUnits: 'ppg',
  lgsContent: 4,
  mudTemp: 110,
  mudTemperatureUnits: 'ºF',
  oilFilterChanged: 'Yes',
  KCF: 'Alarm',
  comments: 'test comment 2',
  valid: 1,
};
const INSPECTION_RECORD = {
  purpose: 'Inspection',
  mudpump: '2',
  rigID: '703',
  dateOfRepair: hoursAgo(5),
  timeEntered: 1793083290455,
  uid: '70321793083290455',
  username: 'john.doe',
  componentInspected: 'Module 1,Module 2',
  comments: 'No wash-out found',
  mudType: 'N/A',
  valid: 1,
};
const INVALID_RECORD = { ...INSPECTION_RECORD, uid: 'invalid', componentInspected: 'Module 3', valid: 0 };
// Cards are found by their component list, which is unique per entry
const REPAIR_TITLE = 'Liner 1, Disch. Valve 1';
const INSPECTION_TITLE = 'Module 1, Module 2';

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });
const pumpOf = (url) => new URL(url).searchParams.get('mudpump');
const card = (title) => screen.findByRole('button', { name: (name) => name.includes(title) });

beforeAll(() => {
  window.scrollTo = jest.fn();
});

beforeEach(() => {
  // The rig the user picked (first-time page or Switch Rigs)
  setActiveRig('703');
  global.fetch = jest.fn(async (url) =>
    jsonResponse(pumpOf(url) === '1' ? [REPAIR_RECORD] : [INSPECTION_RECORD, INVALID_RECORD])
  );
});

test('requests the last 14 days for every pump with the configured credentials', async () => {
  render(<History />);
  await card(REPAIR_TITLE);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  const [url, options] = global.fetch.mock.calls[0];
  const params = new URL(url).searchParams;
  expect(url).toMatch(/^https:\/\/designer\.test\/logbook\/api\/private\/pump\/logbook\?/);
  expect(Object.fromEntries(params)).toMatchObject({
    digitalTwinID: 'TWIN',
    rig: '703',
    mudpump: '1',
    userToken: 'USER_TOKEN',
  });
  const days = (new Date(params.get('to')) - new Date(params.get('from'))) / 86400000;
  expect(Math.round(days)).toBe(14);
  expect(options).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer test-access-token' } });
});

test('lists entries newest first with status and date, skipping invalid records', async () => {
  render(<History />);
  const repair = await card(REPAIR_TITLE);
  const inspection = await card(INSPECTION_TITLE);
  expect(within(repair).getByText('Repair')).toBeInTheDocument();
  expect(within(repair).getByText('Alarm')).toBeInTheDocument();
  expect(within(repair).getByText('RIG 703 • MUD PUMP 1')).toBeInTheDocument();
  expect(
    within(repair).getByText(`Submitted on ${formatSubmittedDate(REPAIR_RECORD.timeEntered)}`)
  ).toBeInTheDocument();
  expect(within(inspection).getByText('Inspection')).toBeInTheDocument();
  expect(within(inspection).getByText('No Alarm')).toBeInTheDocument();
  expect(within(inspection).getByText('RIG 703 • MUD PUMP 2')).toBeInTheDocument();
  expect(repair.compareDocumentPosition(inspection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByText(/Module 3/)).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Manage past entries' })).toBeInTheDocument();
});

test('details page shows the Repair values in the fixed order and goes back', async () => {
  render(<History />);
  fireEvent.click(await card(REPAIR_TITLE));
  expect(screen.getByRole('heading', { name: 'Entry Details' })).toBeInTheDocument();
  const labels = screen.getAllByRole('term').map((term) => term.textContent);
  expect(labels).toEqual([
    'LGS Content [%]',
    'Re-Use Liners',
    'Liner Size [in]',
    'Mud Type',
    'Mud Weight [ppg]',
    'Mud Temperature [ºF]',
    'Oil Filter Changed',
    'Comments',
  ]);
  expect(screen.getByText('Water-based mud')).toBeInTheDocument();
  expect(screen.getByText('10.2')).toBeInTheDocument();
  expect(screen.getByText('test comment 2')).toBeInTheDocument();
  // Brands and other dynamic Repair values are not part of the details screen
  expect(screen.queryByText('Mission : Zirconia')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('heading', { name: 'Logbook History' })).toBeInTheDocument();
});

test('shows an error with Retry when every pump fails', async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
  render(<History />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Logbook request failed (500).');
  global.fetch.mockImplementation(async (url) => jsonResponse(pumpOf(url) === '1' ? [REPAIR_RECORD] : []));
  fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
  expect(await card(REPAIR_TITLE)).toBeInTheDocument();
});

test('shows the loaded pumps and a notice when one pump fails', async () => {
  global.fetch.mockImplementation(async (url) =>
    pumpOf(url) === '1' ? jsonResponse([REPAIR_RECORD]) : { ok: false, status: 503, json: async () => ({}) }
  );
  render(<History />);
  expect(await card(REPAIR_TITLE)).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Could not load Pump 2.');
});

test('shows every entry the API returns, including older ones', async () => {
  const older = { ...INSPECTION_RECORD, uid: 'older', componentInspected: 'Module 3', dateOfRepair: hoursAgo(10 * 24) };
  global.fetch.mockImplementation(async (url) => jsonResponse(pumpOf(url) === '1' ? [REPAIR_RECORD] : [older]));
  render(<History />);
  expect(await card(REPAIR_TITLE)).toBeInTheDocument();
  expect(await card('Module 3')).toBeInTheDocument();
});

test('refresh fetches the entries again', async () => {
  render(<History />);
  await card(REPAIR_TITLE);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  // The request goes out once the access token is ready
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
  expect(await card(REPAIR_TITLE)).toBeInTheDocument();
});

test('the "No Data Available" placeholder is not shown as an entry', async () => {
  global.fetch.mockImplementation(async () => jsonResponse([{ componentChanged: 'No Data Available' }]));
  render(<History />);
  expect(await screen.findByText('No logbook entries')).toBeInTheDocument();
  expect(screen.getByText('No entries in the last 14 days.')).toBeInTheDocument();
});

test('shows skeleton cards while loading', async () => {
  render(<History />);
  expect(screen.getByRole('status', { name: 'Loading logbook history' })).toBeInTheDocument();
  await card(REPAIR_TITLE);
  expect(screen.queryByRole('status', { name: 'Loading logbook history' })).not.toBeInTheDocument();
});

test('Edit mode: selecting a card reveals Delete, which asks for confirmation and hides the entry', async () => {
  const deleteButton = () => screen.queryByRole('button', { name: 'Delete RIG 703 • MUD PUMP 2' });
  render(<History />);
  const inspection = await card(INSPECTION_TITLE);
  expect(deleteButton()).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(screen.getByRole('heading', { name: 'Select to delete' })).toBeInTheDocument();
  // In the edit mode a tap selects the card instead of opening it
  fireEvent.click(inspection);
  expect(inspection).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('heading', { name: 'Entry Details' })).not.toBeInTheDocument();
  fireEvent.click(deleteButton());
  expect(within(screen.getByRole('alertdialog')).getByText(/Module 1, Module 2/)).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText(INSPECTION_TITLE)).toBeInTheDocument();
  fireEvent.click(deleteButton());
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
  expect(screen.queryByText(INSPECTION_TITLE)).not.toBeInTheDocument();
});

test('Stop editing hides the delete action and cards open again', async () => {
  render(<History />);
  const repair = await card(REPAIR_TITLE);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.click(repair);
  expect(screen.getByRole('button', { name: 'Delete RIG 703 • MUD PUMP 1' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Stop editing' }));
  expect(screen.queryByRole('button', { name: /^Delete RIG/ })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Manage past entries' })).toBeInTheDocument();
  fireEvent.click(repair);
  expect(screen.getByRole('heading', { name: 'Entry Details' })).toBeInTheDocument();
});
