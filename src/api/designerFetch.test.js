/**
 * designerFetch.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { getToken } from '../auth/auth';
import { designerFetch } from './designerFetch';

const reply = (status) => ({ ok: status < 300, status });

beforeEach(() => {
  global.fetch = jest.fn(async () => reply(200));
});

test('sends the access token once, without cookies', async () => {
  await designerFetch('/rwhitney-pc1f13f/api/private/pump/logbook', { method: 'GET', headers: { a: '1' } });
  expect(global.fetch).toHaveBeenCalledWith('/rwhitney-pc1f13f/api/private/pump/logbook', {
    method: 'GET',
    headers: { a: '1', Authorization: 'Bearer test-access-token' },
    credentials: 'omit',
  });
});

test('on 401 gets a new token and tries once more', async () => {
  getToken.mockResolvedValueOnce('old-token').mockResolvedValueOnce('new-token');
  global.fetch.mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(401));
  const response = await designerFetch('/x/api/private/y');
  expect(response.status).toBe(401);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(getToken).toHaveBeenLastCalledWith({ forceRefresh: true });
  expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer new-token');
});

test('does not retry a 403 (no access to the rig)', async () => {
  global.fetch.mockResolvedValueOnce(reply(403));
  const response = await designerFetch('/x/api/private/y');
  expect(response.status).toBe(403);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('sends only the token: the legacy authentication key is dropped', async () => {
  await designerFetch('/x/api/private/y', {
    headers: { authentication: 'LEGACY', 'Content-Type': 'application/json' },
  });
  expect(global.fetch.mock.calls[0][1].headers).toEqual({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-access-token',
  });
});
