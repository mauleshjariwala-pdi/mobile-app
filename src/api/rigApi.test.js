/**
 * rigApi.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { fetchRigLayout, fetchRigsByCountry, getLayoutPumps } from './rigApi';

jest.mock('../config/appConfig', () => ({
  APP_CONFIG: { logbook: { baseUrl: 'https://designer.test/api-designer', authKey: '' } },
}));

const jsonResponse = (status, data) => ({ ok: status < 300, status, text: async () => JSON.stringify(data) });

beforeEach(() => {
  global.fetch = jest.fn();
});

test('reads the rigs of a country with the bearer token', async () => {
  global.fetch.mockResolvedValue(jsonResponse(200, [49, 50, 575]));
  await expect(fetchRigsByCountry('US')).resolves.toEqual(['49', '50', '575']);
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe('https://designer.test/api-designer/api/private/rigs/bycountry?country=US');
  expect(options.headers.Authorization).toBe('Bearer test-access-token');
});

test('reads a rig layout and lists its pump ids', async () => {
  const layout = { rig: '575', units: 'imperial', pumps: { present: true, count: 3, ids: [1, 2, 3], model: null } };
  global.fetch.mockResolvedValue(jsonResponse(200, layout));
  const result = await fetchRigLayout('575');
  expect(global.fetch.mock.calls[0][0]).toBe('https://designer.test/api-designer/api/private/rig/layout?rig=575');
  expect(getLayoutPumps(result)).toEqual(['1', '2', '3']);
});

test('a rig without pumps has no pump ids', () => {
  expect(getLayoutPumps({ pumps: { present: false, count: 0 } })).toEqual([]);
  expect(getLayoutPumps({})).toEqual([]);
  expect(getLayoutPumps(null)).toEqual([]);
  // No ids given: numbered 1..count
  expect(getLayoutPumps({ pumps: { present: true, count: 2 } })).toEqual(['1', '2']);
});

test('layout errors give a message for the user', async () => {
  global.fetch.mockResolvedValue(jsonResponse(404, { error: 'not found' }));
  await expect(fetchRigLayout('9999')).rejects.toMatchObject({ status: 404, message: 'This rig was not found.' });
  global.fetch.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }));
  await expect(fetchRigLayout('1')).rejects.toMatchObject({ status: 403, message: 'You have no access to this rig.' });
});

test('a 503 while the server starts is tried again', async () => {
  // Skip the wait between the tries
  const timer = jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
    callback();
    return 0;
  });
  global.fetch
    .mockResolvedValueOnce(jsonResponse(503, { error: 'starting' }))
    .mockResolvedValueOnce(jsonResponse(200, [101]));
  await expect(fetchRigsByCountry('CA')).resolves.toEqual(['101']);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(timer).toHaveBeenCalledWith(expect.any(Function), 3000);
  timer.mockRestore();
});
