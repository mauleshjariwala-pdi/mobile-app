/**
 * pushRegistration.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { getToken, isSupported } from 'firebase/messaging';
// Prescient Devices imports
import { clearBrowserData } from '../auth/clearBrowserData';
import { registerMessagingServiceWorker } from './firebase';
import {
  DEVICE_ID_KEY,
  REGISTRATION_KEY,
  getDeviceId,
  getRegistration,
  syncPushRegistration,
  unregisterPushDevice,
} from './pushRegistration';

jest.mock('firebase/messaging', () => ({ getToken: jest.fn(), isSupported: jest.fn() }));
jest.mock('./firebase', () => ({
  VAPID_KEY: 'VAPID',
  isPushSupported: true,
  messaging: {},
  registerMessagingServiceWorker: jest.fn(),
}));
jest.mock('../config/appConfig', () => ({
  APP_CONFIG: { logbook: { baseUrl: 'https://designer.test/api-designer', authKey: '' } },
}));

const USER = { id: 'auth0|1' };
const ROUTE = 'https://designer.test/api-designer/api/private/push/tokens/';
const jsonResponse = (status, data) => ({ ok: status < 300, status, text: async () => JSON.stringify(data) });
// Method and device id of every push request
const requests = () =>
  global.fetch.mock.calls.map(([url, init]) => [init.method, decodeURIComponent(url.slice(ROUTE.length))]);

beforeAll(() => {
  // jsdom has no Web Crypto; every browser does
  Object.defineProperty(global, 'crypto', { value: require('crypto').webcrypto, configurable: true });
  Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve() }, configurable: true });
});

beforeEach(() => {
  localStorage.clear();
  global.Notification = { permission: 'granted', requestPermission: jest.fn(async () => 'granted') };
  // Set here: CRA resets mock implementations before every test
  isSupported.mockResolvedValue(true);
  registerMessagingServiceWorker.mockResolvedValue({ scope: '/' });
  getToken.mockResolvedValue('FCM-1');
  global.fetch = jest.fn(async (url, init) => {
    if (init.method === 'GET') return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'no device' } });
    if (init.method === 'PUT') return jsonResponse(201, { deviceId: JSON.parse(init.body).deviceId, created: true });
    return jsonResponse(200, { deleted: true });
  });
});

test('the device id is random, valid and kept', () => {
  const id = getDeviceId();
  expect(id).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
  expect(getDeviceId()).toBe(id);
  expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(id);
});

test('first sign-in: GET finds no device, so PUT stores it and the flag is saved; later starts send nothing', async () => {
  const id = getDeviceId();
  await expect(syncPushRegistration(USER)).resolves.toBe(true);
  expect(requests()).toEqual([
    ['GET', id],
    ['PUT', id],
  ]);
  const [, init] = global.fetch.mock.calls[1];
  expect(JSON.parse(init.body)).toEqual({ deviceId: id, token: 'FCM-1', platform: 'web' });
  expect(init.headers.Authorization).toBe('Bearer test-access-token');
  expect(getRegistration()).toMatchObject({ deviceId: id, userId: USER.id, token: 'FCM-1' });
  global.fetch.mockClear();
  await syncPushRegistration(USER);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('a device the server already has is not stored again', async () => {
  global.fetch.mockImplementation(async () =>
    jsonResponse(200, { deviceId: 'x', platform: 'web', rigCount: 3, createdAt: 1, updatedAt: 2 })
  );
  await syncPushRegistration(USER);
  expect(requests().map(([method]) => method)).toEqual(['GET']);
  expect(getRegistration()).toMatchObject({ userId: USER.id, token: 'FCM-1' });
});

test('a new Firebase token is stored with PUT at once, without GET', async () => {
  await syncPushRegistration(USER);
  global.fetch.mockClear();
  getToken.mockResolvedValue('FCM-2');
  await syncPushRegistration(USER);
  expect(requests().map(([method]) => method)).toEqual(['PUT']);
  expect(getRegistration().token).toBe('FCM-2');
});

test('another user on the device checks again', async () => {
  await syncPushRegistration(USER);
  global.fetch.mockClear();
  await syncPushRegistration({ id: 'auth0|2' });
  expect(requests().map(([method]) => method)).toEqual(['GET', 'PUT']);
  expect(getRegistration().userId).toBe('auth0|2');
});

test('409 (the id belongs to another user) takes a new device id and stores it once more', async () => {
  const oldId = getDeviceId();
  let puts = 0;
  global.fetch.mockImplementation(async (url, init) => {
    if (init.method === 'GET') return jsonResponse(404, { error: { code: 'NOT_FOUND' } });
    puts += 1;
    return puts === 1 ? jsonResponse(409, { error: { code: 'CONFLICT', message: 'taken' } }) : jsonResponse(201, {});
  });
  await expect(syncPushRegistration(USER)).resolves.toBe(true);
  const newId = getDeviceId();
  expect(newId).not.toBe(oldId);
  expect(requests()).toEqual([
    ['GET', oldId],
    ['PUT', oldId],
    ['PUT', newId],
  ]);
  expect(getRegistration().deviceId).toBe(newId);
});

test('nothing is sent until notifications are allowed', async () => {
  global.Notification.permission = 'default';
  await expect(syncPushRegistration(USER)).resolves.toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(getRegistration()).toBeNull();
});

test('a failed registration does not throw and saves no flag', async () => {
  global.fetch.mockResolvedValue(jsonResponse(429, { error: { code: 'TOO_MANY_REQUESTS', message: 'wait' } }));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(syncPushRegistration(USER)).resolves.toBe(false);
  warn.mockRestore();
  expect(getRegistration()).toBeNull();
});

test('logout deletes the device, drops the flag and keeps the device id', async () => {
  const id = getDeviceId();
  await syncPushRegistration(USER);
  global.fetch.mockClear();
  await unregisterPushDevice();
  expect(requests()).toEqual([['DELETE', id]]);
  expect(global.fetch.mock.calls[0][1].keepalive).toBe(true);
  expect(localStorage.getItem(REGISTRATION_KEY)).toBeNull();
  // Sign-out clears the rest of the storage, but the device keeps its id
  clearBrowserData();
  expect(getDeviceId()).toBe(id);
});

test('logout never fails on DELETE, and sends nothing for a device that was not registered', async () => {
  await unregisterPushDevice();
  expect(global.fetch).not.toHaveBeenCalled();
  await syncPushRegistration(USER);
  global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(unregisterPushDevice()).resolves.toBeUndefined();
  warn.mockRestore();
  expect(getRegistration()).toBeNull();
});
