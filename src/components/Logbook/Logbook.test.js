/**
 * Logbook.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
// Prescient Devices imports
import { setActiveRig } from '../../config/activeRig';
import Logbook from './Logbook';
import { useRigLayout } from './useRigLayout';

jest.mock('../../config/appConfig', () => ({
  APP_CONFIG: {
    digitalTwinID: 'TWIN',
    userToken: 'USER_TOKEN',
    user: { login: 'john.doe', userId: '42', email: 'john.doe@example.com' },
    mudPumps: ['1', '2'],
    logbook: { baseUrl: 'https://designer.test/logbook', authKey: 'LOGBOOK_KEY' },
    ruleEngine: { baseUrl: '', authKey: '' },
  },
}));

// Mud pumps come from the rig layout (GET /rig/layout); tested in rigApi.test.js
jest.mock('./useRigLayout', () => ({ useRigLayout: jest.fn() }));
const rigLayout = (overrides = {}) => ({
  status: 'ready',
  layout: null,
  pumps: ['1', '2'],
  error: '',
  reload: jest.fn(),
  ...overrides,
});

const SUCCESS_TEXT = 'Your logbook entry has been added!';
const textResponse = (status, text = '') => ({ ok: status < 300, status, text: async () => text });
// Request of the n-th fetch call: query parameters and parsed JSON body
const sentRequest = (n = 0) => {
  const [url, options] = global.fetch.mock.calls[n];
  return { url, params: Object.fromEntries(new URL(url).searchParams), options, body: JSON.parse(options.body) };
};
const reviewButton = () => screen.getByRole('button', { name: 'Review & Submit' });
// Open the review page, then submit from it
const reviewAndSubmit = () => {
  fireEvent.click(reviewButton());
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
};
// Pick a pump and a purpose on the start step, then open the form
const PURPOSE_NAMES = [/Inspection/, /Repair/, /Dampener/];
const begin = (purpose = /Inspection/, pump = '1') => {
  fireEvent.click(screen.getByRole('radio', { name: `Mud pump ${pump}` }));
  fireEvent.click(screen.getByRole('radio', { name: purpose }));
  fireEvent.click(screen.getByRole('button', { name: 'Start Logging' }));
};
// Toggle components by their number buttons, e.g. "Liner 1"
const pickComponents = (...names) =>
  names.forEach((name) => fireEvent.click(screen.getByRole('button', { name, pressed: false })));
const openSelected = () => {
  fireEvent.click(screen.getByRole('button', { name: /selected/ }));
  return screen.getByRole('dialog', { name: /^Selected/ });
};

beforeAll(() => {
  window.scrollTo = jest.fn();
});

beforeEach(() => {
  // The rig the user picked (first-time page or Switch Rigs)
  setActiveRig('001');
  useRigLayout.mockReturnValue(rigLayout());
  global.fetch = jest.fn(async () => textResponse(200, '{"bucket":"dev","data":[]}'));
});

test('start step begins with nothing picked and Next disabled until a pump and a purpose are chosen', () => {
  render(<Logbook />);
  expect(screen.getByRole('heading', { name: 'Select equipment to begin' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Mud pump 1' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: 'Mud pump 2' })).not.toBeChecked();
  PURPOSE_NAMES.forEach((name) => expect(screen.getByRole('radio', { name })).not.toBeChecked());
  // jsdom drops ":00" seconds from datetime-local values, so seconds are optional here
  expect(screen.getByLabelText('Date & Time').value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: 'Mud pump 2' }));
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: /Inspection/ }));
  const startButton = screen.getByRole('button', { name: 'Start Logging' });
  expect(startButton).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  fireEvent.click(startButton);
  expect(screen.getByRole('heading', { name: 'Fill Logbook Form' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  // The pump and date are chosen on the start step only; the context line shows them
  expect(screen.queryByLabelText('Date & Time')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Mud Pump')).not.toBeInTheDocument();
  expect(screen.getByText('Rig 001 • Mud Pump 2 • Inspection')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Select components inspected' })).toBeInTheDocument();
  expect(screen.getByLabelText('Comments')).toBeInTheDocument();
  expect(screen.queryByLabelText('Mud Type')).not.toBeInTheDocument();
});

test('mud pumps come from the rig layout of the active rig', () => {
  useRigLayout.mockReturnValue(rigLayout({ pumps: ['1', '2', '3'] }));
  render(<Logbook />);
  expect(useRigLayout).toHaveBeenCalledWith('001');
  const pumps = screen.getByRole('radiogroup', { name: 'Mud pumps' });
  expect(
    within(pumps)
      .getAllByRole('radio')
      .map((r) => r.value)
  ).toEqual(['1', '2', '3']);
});

test('a rig without mud pumps says so and keeps Next disabled', () => {
  useRigLayout.mockReturnValue(rigLayout({ pumps: [] }));
  render(<Logbook />);
  expect(screen.queryByRole('radiogroup', { name: 'Mud pumps' })).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('There are no mud pumps on rig 001');
  fireEvent.click(screen.getByRole('radio', { name: /Inspection/ }));
  const next = screen.getByRole('button', { name: 'Next' });
  expect(next).toBeDisabled();
  expect(next).toHaveAccessibleDescription(/no mud pumps/);
});

test('loading and failed rig layouts show no pumps; Try again reloads', () => {
  useRigLayout.mockReturnValue(rigLayout({ status: 'loading', pumps: [] }));
  const { rerender } = render(<Logbook />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading mud pumps');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  const reload = jest.fn();
  useRigLayout.mockReturnValue(rigLayout({ status: 'error', pumps: [], error: 'This rig was not found.', reload }));
  rerender(<Logbook />);
  expect(screen.getByRole('alert')).toHaveTextContent('This rig was not found.');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(reload).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('shows repair fields when Repair is selected', () => {
  render(<Logbook />);
  begin(/Repair/);
  expect(screen.getByRole('heading', { name: 'Select components being changed' })).toBeInTheDocument();
  ['Mud Type', 'Mud Weight', 'LGS Content', 'Mud Temperature', /^Alarm Status/].forEach((label) =>
    expect(screen.getByLabelText(label)).toBeInTheDocument()
  );
  expect(screen.getByRole('radiogroup', { name: 'Oil Filter Changed' })).toBeInTheDocument();
});

test('back arrow returns to the purpose cards', () => {
  render(<Logbook />);
  begin(/Dampener/);
  expect(screen.getByLabelText('Pressure')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('radio', { name: /Dampener/ })).toBeChecked();
});

test('posts a pre-charge entry with the user, rig and pump in the query', async () => {
  render(<Logbook />);
  begin(/Dampener/, '2');
  // The pump picked on the start step is carried to the form
  expect(screen.getByText(/Mud Pump 2/)).toBeInTheDocument();
  expect(reviewButton()).toHaveAccessibleDescription('1 field missing: Pressure');
  fireEvent.change(screen.getByLabelText('Pressure'), { target: { value: '750' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
  reviewAndSubmit();
  expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS_TEXT);
  const { url, params, options, body } = sentRequest();
  // No trailing slash: the Designers refuse a token on a route that ends in / (Auth0 guide 4.3)
  expect(url).toMatch(/^https:\/\/designer\.test\/logbook\/api\/private\/pump\/logbook\?/);
  expect(params).toEqual({
    rig: '001',
    mudpump: '2',
    login: 'john.doe',
    userid: '42',
    email: 'john.doe@example.com',
    digitalTwinID: 'TWIN',
    userToken: 'USER_TOKEN',
  });
  expect(options).toMatchObject({
    method: 'POST',
    headers: { Authorization: 'Bearer test-access-token', 'Content-Type': 'application/json' },
  });
  expect(body).toEqual({
    dateOfRepair: expect.stringMatching(/Z$/),
    purpose: 'Precharge',
    precharge_pressure: 750,
    precharge_inspected: 1,
  });
});

test('posts an Inspection entry with the chosen modules after the review', async () => {
  render(<Logbook />);
  begin();
  // Review & Submit stays disabled while required fields are missing
  expect(reviewButton()).toBeDisabled();
  expect(reviewButton()).toHaveAccessibleDescription('1 field missing: Components inspected');
  pickComponents('Module 1', 'Module 2');
  expect(reviewButton()).not.toHaveAccessibleDescription();
  fireEvent.change(screen.getByLabelText('Comments'), { target: { value: '  no wash-out  ' } });
  fireEvent.click(reviewButton());
  // The review lists the entry before anything is sent
  expect(screen.getByRole('heading', { name: 'Review Logbook' })).toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Basic Information' })).getByText('Module 1, Module 2')
  ).toBeInTheDocument();
  const basic = screen.getByRole('region', { name: 'Basic Information' });
  expect(within(basic).getByText('Mud Pump 1')).toBeInTheDocument();
  expect(within(basic).getByText('Inspection')).toBeInTheDocument();
  expect(within(basic).getByText(/^\d{4}-\d{2}-\d{2} \| \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Comments' })).getByText('no wash-out')).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  expect(sentRequest().body).toEqual({
    dateOfRepair: expect.any(String),
    purpose: 'Inspection',
    componentInspected: ['Module 1', 'Module 2'],
    comments: 'no wash-out',
  });
  expect(sentRequest().params.mudpump).toBe('1');
  expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS_TEXT);
  expect(screen.getByText('Complete')).toBeInTheDocument();
});

test('Back on the review returns to the form with the values kept', () => {
  render(<Logbook />);
  begin();
  pickComponents('Module 3');
  fireEvent.click(reviewButton());
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('heading', { name: 'Fill Logbook Form' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Module 3' })).toHaveAttribute('aria-pressed', 'true');
});

test('Back to Alerts calls onDone after a successful submit', async () => {
  const onDone = jest.fn();
  render(<Logbook onDone={onDone} />);
  begin();
  pickComponents('Module 1');
  reviewAndSubmit();
  expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS_TEXT);
  fireEvent.click(screen.getByRole('button', { name: 'Back to Alerts' }));
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('future dates are rejected on the start step before the form opens', () => {
  render(<Logbook />);
  fireEvent.change(screen.getByLabelText('Date & Time'), { target: { value: '2999-01-01T00:00:00' } });
  begin();
  expect(screen.getByRole('alert')).toHaveTextContent('Future entries are not allowed.');
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('the date chosen on the start step is sent with the entry', async () => {
  render(<Logbook />);
  fireEvent.change(screen.getByLabelText('Date & Time'), { target: { value: '2026-01-15T08:30:00' } });
  begin();
  pickComponents('Module 1');
  reviewAndSubmit();
  expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS_TEXT);
  expect(sentRequest().body.dateOfRepair).toBe(new Date('2026-01-15T08:30:00').toISOString());
});

const openRepair = (props) => {
  render(<Logbook {...props} />);
  begin(/Repair/);
};

const pickOption = (fieldName, optionName) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(fieldName) }));
  fireEvent.click(within(screen.getByRole('dialog', { name: fieldName })).getByRole('option', { name: optionName }));
};

test('component selector searches, toggles numbers and lists the selection with Remove and Clear all', () => {
  openRepair();
  expect(screen.getByText('Browse and select')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /0 selected/ })).toBeInTheDocument();
  // Case-insensitive search over part names, group names and option labels
  const search = screen.getByRole('searchbox', { name: 'Search components' });
  fireEvent.change(search, { target: { value: 'liner lock' } });
  expect(screen.getByText('Search results (2 matches)')).toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'LINER 2' } });
  expect(screen.getByText('Search results (1 match)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Liner 2' }));
  expect(screen.getByRole('button', { name: 'Liner 2' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByText('Browse and select')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /1 selected/ })).toHaveTextContent('Liner 2');
  // Picking a liner reveals its dependent fields, exactly as before
  expect(screen.getByRole('button', { name: /Liner 2 Type/ })).toBeInTheDocument();
  expect(screen.queryByLabelText('Liner Size [in]')).not.toBeInTheDocument();
  pickOption('Liner 2 Type', 'Forum : Ceramic');
  expect(screen.getByLabelText('Liner Size [in]')).toBeInTheDocument();
  fireEvent.click(
    within(screen.getByRole('radiogroup', { name: 'Re-Use Liners' })).getByRole('radio', { name: 'Yes' })
  );
  expect(screen.getByLabelText(/^Liner 2 Hours/)).toBeInTheDocument();
  // Remove from the selected list
  let sheet = openSelected();
  expect(sheet).toHaveAccessibleName('Selected (1)');
  fireEvent.click(within(sheet).getByRole('button', { name: 'Remove Liner 2' }));
  expect(within(sheet).getByText('Nothing selected yet.')).toBeInTheDocument();
  fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Liner 2 Type/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/^Liner 2 Hours/)).not.toBeInTheDocument();
  // Clear all empties the selection
  pickComponents('Liner 1', 'Disch. Valve 3');
  sheet = openSelected();
  expect(sheet).toHaveAccessibleName('Selected (2)');
  fireEvent.click(within(sheet).getByRole('button', { name: 'Clear all' }));
  expect(sheet).toHaveAccessibleName('Selected (0)');
  expect(within(sheet).getByRole('button', { name: 'Clear all' })).toBeDisabled();
});

test('Repair lists every missing required field and keeps Review & Submit disabled', () => {
  openRepair();
  expect(reviewButton()).toBeDisabled();
  expect(reviewButton()).toHaveAccessibleDescription('3 fields missing: Components, Alarm Status, Comments');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('Alarm Status is marked required and blocks the review until chosen', () => {
  openRepair();
  pickComponents('Oil Change');
  fireEvent.change(screen.getByLabelText('Comments'), { target: { value: 'Oil changed' } });
  expect(screen.getByLabelText(/^Alarm Status/)).toHaveAttribute('aria-required', 'true');
  expect(reviewButton()).toHaveAccessibleDescription('1 field missing: Alarm Status');
  expect(reviewButton()).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/^Alarm Status/), { target: { value: 'Alarm' } });
  expect(reviewButton()).toBeEnabled();
});

test('hours shown for Re-Use Liners = Yes are required', () => {
  openRepair();
  pickComponents('Liner 1');
  pickOption('Liner 1 Type', 'Forum : Ceramic');
  fireEvent.change(screen.getByLabelText('Liner Size [in]'), { target: { value: '6.5' } });
  fireEvent.click(
    within(screen.getByRole('radiogroup', { name: 'Re-Use Liners' })).getByRole('radio', { name: 'Yes' })
  );
  expect(screen.getByLabelText(/^Liner 1 Hours/)).toHaveAttribute('aria-required', 'true');
  fireEvent.change(screen.getByLabelText(/^Alarm Status/), { target: { value: 'Alarm' } });
  fireEvent.change(screen.getByLabelText('Comments'), { target: { value: 'Liner 1 replaced' } });
  expect(reviewButton()).toHaveAccessibleDescription('1 field missing: Liner 1 Hours');
  expect(reviewButton()).toBeDisabled();
  expect(global.fetch).not.toHaveBeenCalled();
});

// Many picker interactions; allow extra time when the suites run in parallel
test('Repair reviews and posts only the visible fields with numeric types', async () => {
  openRepair();
  pickComponents('Liner 1', 'Disch. Valve 1');
  pickOption('Liner 1 Type', 'Forum : Ceramic');
  pickOption('Disch. Valve 1 Brand', 'Forum : FO HT');
  fireEvent.change(screen.getByLabelText('Liner Size [in]'), { target: { value: '6.5' } });
  fireEvent.click(
    within(screen.getByRole('radiogroup', { name: 'Re-Use Liners' })).getByRole('radio', { name: 'Yes' })
  );
  fireEvent.change(screen.getByLabelText(/^Liner 1 Hours/), { target: { value: '120' } });
  fireEvent.change(screen.getByLabelText('Mud Weight'), { target: { value: '10.2' } });
  fireEvent.change(screen.getByLabelText(/^Alarm Status/), { target: { value: 'No Alarm' } });
  expect(reviewButton()).toHaveAccessibleDescription('1 field missing: Comments');
  fireEvent.change(screen.getByLabelText('Comments'), { target: { value: 'Liner 1 replaced' } });
  fireEvent.click(reviewButton());
  const mud = screen.getByRole('region', { name: 'Mud & Oil Information' });
  expect(within(mud).getByText('10.2 ppg')).toBeInTheDocument();
  expect(within(mud).getByText('Not changed')).toBeInTheDocument();
  const alarm = screen.getByRole('region', { name: 'Alarm & Comments' });
  expect(within(alarm).getByText('No Alarm')).toBeInTheDocument();
  expect(within(alarm).getByText('Liner 1 replaced')).toBeInTheDocument();
  const basic = screen.getByRole('region', { name: 'Basic Information' });
  expect(within(basic).getByText('Liner 1, Disch. Valve 1')).toBeInTheDocument();
  expect(within(basic).getByText('6.5')).toBeInTheDocument();
  const reuse = screen.getByRole('region', { name: 'Inspection and Re-use' });
  expect(within(reuse).getByText(/^120/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  expect(sentRequest().body).toEqual({
    dateOfRepair: expect.any(String),
    purpose: 'Repair',
    componentChanged: ['Liner 1', 'Disch. Valve 1'],
    Disch_Valve_1_brand: 'Forum : FO HT',
    Liner_1_brand: 'Forum : Ceramic',
    linerSize: 6.5,
    reUseLiners: 'Yes',
    liner1Hours: 120,
    wearplateInspected: 'Yes',
    pistonInspected: 'No',
    linerInspected: 'No',
    seatInspected: 'No',
    moduleInspected: 'No',
    mudType: '',
    mudWeight: 10.2,
    lgsContent: 0,
    mudTemp: 0,
    oilFilterChanged: 'No',
    KCF: 'No Alarm',
    comments: 'Liner 1 replaced',
  });
  expect(await screen.findByRole('status')).toHaveTextContent(SUCCESS_TEXT);
}, 15000);

test('a server error shows the red result, and Review and try again resubmits', async () => {
  global.fetch.mockResolvedValue(textResponse(213, 'Liner size mismatch : Change all three or correct this one.'));
  render(<Logbook />);
  begin();
  pickComponents('Module 1');
  reviewAndSubmit();
  const result = await screen.findByRole('alert');
  expect(result).toHaveTextContent('Your logbook entry was not added');
  expect(result).toHaveTextContent('Liner size mismatch');
  expect(screen.getByText('Not saved')).toBeInTheDocument();
  // 205 has no body, so the message is mapped locally
  global.fetch.mockResolvedValue(textResponse(205));
  fireEvent.click(screen.getByRole('button', { name: 'Review and try again' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  expect(await screen.findByText('Comment missing. Please resubmit.')).toBeInTheDocument();
});
