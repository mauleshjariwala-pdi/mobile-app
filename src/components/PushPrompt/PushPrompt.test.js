/**
 * PushPrompt.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { act, fireEvent, render, screen } from '@testing-library/react';
// Prescient Devices imports
import { enablePush, getPushAvailability } from '../../notification/pushRegistration';
import PushPrompt from './PushPrompt';

jest.mock('../../notification/pushRegistration', () => ({ enablePush: jest.fn(), getPushAvailability: jest.fn() }));

const USER = { id: 'auth0|1' };
const renderPrompt = async () => {
  const view = render(<PushPrompt user={USER} />);
  // Availability is read asynchronously: let it arrive
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  return view;
};

beforeEach(() => {
  sessionStorage.clear();
  enablePush.mockResolvedValue(true);
});

test('asks to turn on alarms, and Turn on asks for permission and registers the user', async () => {
  getPushAvailability.mockResolvedValueOnce('prompt').mockResolvedValue('granted');
  await renderPrompt();
  expect(screen.getByRole('region', { name: 'Get alarms on this device' })).toHaveTextContent(
    'Turn on notifications to get rig alarms even when the app is closed.'
  );
  let finish;
  enablePush.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
  expect(screen.getByRole('button', { name: 'Turning on…' })).toBeDisabled();
  expect(enablePush).toHaveBeenCalledWith(USER);
  await act(async () => finish(true));
  // Alarms are on: the card goes away
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

test('on an iPhone in Safari it explains the home screen step instead', async () => {
  getPushAvailability.mockResolvedValue('install');
  await renderPrompt();
  expect(screen.getByRole('region')).toHaveTextContent('tap Share, then Add to Home Screen');
  expect(screen.queryByRole('button', { name: 'Turn on' })).not.toBeInTheDocument();
});

test('Not now hides the card until the app is opened again', async () => {
  getPushAvailability.mockResolvedValue('prompt');
  const { unmount } = await renderPrompt();
  fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(sessionStorage.getItem('pushPromptDismissed')).toBe('1');
  unmount();
  await renderPrompt();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

test.each(['granted', 'denied', 'unsupported'])('shows nothing when push is %s', async (availability) => {
  getPushAvailability.mockResolvedValue(availability);
  await renderPrompt();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
