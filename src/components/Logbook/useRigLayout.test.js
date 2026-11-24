/**
 * useRigLayout.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { renderHook, waitFor } from '@testing-library/react';
// Prescient Devices imports
import { useRigLayout } from './useRigLayout';

jest.mock('../../config/appConfig', () => ({
  APP_CONFIG: { logbook: { baseUrl: 'https://designer.test/api-designer', authKey: '' } },
}));

const layout = (ids) => ({ rig: '575', units: 'imperial', pumps: { present: ids.length > 0, count: ids.length, ids } });
const jsonResponse = (status, data) => ({ ok: status < 300, status, text: async () => JSON.stringify(data) });
const saveLayout = (rig, value) =>
  localStorage.setItem(`rigLayout:${rig}`, JSON.stringify({ layout: value, savedAt: 1 }));

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
});

test('without a saved layout it waits for the API, then saves the layout', async () => {
  global.fetch.mockResolvedValue(jsonResponse(200, layout([1, 2, 3])));
  const { result } = renderHook(() => useRigLayout('575'));
  expect(result.current.status).toBe('loading');
  await waitFor(() => expect(result.current.pumps).toEqual(['1', '2', '3']));
  expect(JSON.parse(localStorage.getItem('rigLayout:575')).layout.pumps.ids).toEqual([1, 2, 3]);
});

test('a saved layout shows at once and is refreshed in the background', async () => {
  saveLayout('575', layout([1, 2]));
  global.fetch.mockResolvedValue(jsonResponse(200, layout([1, 2, 3])));
  const { result } = renderHook(() => useRigLayout('575'));
  expect(result.current.status).toBe('ready');
  expect(result.current.pumps).toEqual(['1', '2']);
  await waitFor(() => expect(result.current.pumps).toEqual(['1', '2', '3']));
});

test('a connection error keeps the saved layout', async () => {
  saveLayout('575', layout([1, 2]));
  global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
  const { result } = renderHook(() => useRigLayout('575'));
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(result.current.status).toBe('ready');
  expect(result.current.pumps).toEqual(['1', '2']);
});

test('no access to the rig drops the saved layout and shows the error', async () => {
  saveLayout('575', layout([1, 2]));
  global.fetch.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }));
  const { result } = renderHook(() => useRigLayout('575'));
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.error).toBe('You have no access to this rig.');
  expect(localStorage.getItem('rigLayout:575')).toBeNull();
});
