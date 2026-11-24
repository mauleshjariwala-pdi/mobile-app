/**
 * pushRegistration.js
 *
 * Register this device for push alarms (docs/firebase-push-notifications, sections 4 to 6):
 * - one random device id per device, kept in localStorage (also across sign-out)
 * - after sign-in, with no "registered" flag yet: GET the device; when it is not stored, PUT it.
 *   Then the flag is saved, so the next app starts make no GET. Only a new Firebase token, another
 *   user or another device id makes the app check again
 * - on sign-out: DELETE the device, so its alarms stop, and drop the flag
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { getToken, isSupported } from 'firebase/messaging';
// Prescient Devices imports
import { deletePushDevice, getPushDevice, putPushDevice } from '../api/pushTokenApi';
import { VAPID_KEY, isPushSupported, messaging, registerMessagingServiceWorker } from './firebase';

/**
 * @typedef {object} PushRegistration
 * @property {string} deviceId - device id stored on the server
 * @property {string} userId - Auth0 id of the user it is stored for
 * @property {string} token - Firebase token it is stored with
 * @property {number} registeredAt - when it was stored or checked (epoch ms)
 *
 * @typedef {'unsupported' | 'install' | 'denied' | 'prompt' | 'granted'} PushAvailability
 *   install: iPhone in Safari; push works only from the home screen app
 */

// Constants
const DEVICE_ID_KEY = 'pushDeviceId';
const REGISTRATION_KEY = 'pushRegistration';
// 1 to 128 characters of A-Z a-z 0-9 _ - (section 5)
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
// Sign-out waits at most this long for DELETE; keepalive lets it finish after the page leaves
const UNREGISTER_TIMEOUT_MS = 4000;

let syncPromise = null;

/**
 * Get this device's id, made once at random and kept in localStorage. Never built from the user, the
 * rig or a name: a guessable id lets another user take the slot (section 5)
 * @returns {string} device id
 */
function getDeviceId() {
  const saved = readStorage(DEVICE_ID_KEY);
  if (saved && DEVICE_ID_PATTERN.test(saved)) return saved;
  return renewDeviceId();
}

/**
 * Make a new random device id and keep it, e.g. after a 409 (the id belongs to another user)
 * @returns {string} new device id
 */
function renewDeviceId() {
  const id = randomId();
  writeStorage(DEVICE_ID_KEY, id);
  return id;
}

/**
 * Random UUID; crypto.randomUUID needs a secure page, so fall back to crypto.getRandomValues
 * @returns {string} random id, e.g. 3f2c9b1e-8d4a-4e1b-9c7a-2d5f6a7b8c9d
 */
function randomId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Read the "registered" flag
 * @returns {PushRegistration | null} flag, or null when the device is not known to be registered
 */
function getRegistration() {
  try {
    const saved = JSON.parse(readStorage(REGISTRATION_KEY));
    return saved?.deviceId ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Can this browser get push alarms, and has the user allowed them?
 * @returns {Promise<PushAvailability>} availability
 */
async function getPushAvailability() {
  const supported = isPushSupported && Boolean(messaging) && (await isSupported().catch(() => false));
  if (!supported) return isIosBrowserTab() ? 'install' : 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.permission === 'denied' ? 'denied' : 'prompt';
}

/**
 * Ask the user to allow notifications, then register the device. Call it from a tap: iOS refuses the
 * permission prompt otherwise
 * @param {import('../auth/auth').SessionUser} user - signed-in user
 * @returns {Promise<boolean>} true when the device is registered
 */
async function enablePush(user) {
  if ((await getPushAvailability()) === 'unsupported') return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  return syncPushRegistration(user);
}

/**
 * After sign-in and at every app start: make sure this device is stored for the user. Does nothing
 * until notifications are allowed. With the flag saved for this user, device and token, no request is
 * made. Without the flag: GET, then PUT when the device is not stored. A changed token is PUT at once
 * @param {import('../auth/auth').SessionUser} user - signed-in user
 * @returns {Promise<boolean>} true when the device is registered
 */
function syncPushRegistration(user) {
  if (!syncPromise) {
    syncPromise = runSync(user)
      .catch((error) => {
        // Push is extra: the app works without it, and the next start tries again
        console.warn('Push registration failed:', error);
        return false;
      })
      .finally(() => {
        syncPromise = null;
      });
  }
  return syncPromise;
}

/**
 * Register the device (see syncPushRegistration)
 * @param {import('../auth/auth').SessionUser} user - signed-in user
 * @returns {Promise<boolean>} true when the device is registered
 */
async function runSync(user) {
  if (!user?.id || (await getPushAvailability()) !== 'granted') return false;
  const token = await getFirebaseToken();
  if (!token) return false;
  let deviceId = getDeviceId();
  const saved = getRegistration();
  const isSameDevice = saved && saved.deviceId === deviceId && saved.userId === user.id;
  // Registered before with this token: nothing to do, no request
  if (isSameDevice && saved.token === token) return true;
  // No flag yet (first sign-in on this device, or after sign-out): ask the server first
  if (!isSameDevice && (await getPushDevice(deviceId))) {
    saveRegistration(deviceId, user.id, token);
    return true;
  }
  try {
    await putPushDevice(deviceId, token);
  } catch (error) {
    if (error.status !== 409) throw error;
    // The id or the token belongs to another user: take a new id and try once more
    deviceId = renewDeviceId();
    await putPushDevice(deviceId, token);
  }
  saveRegistration(deviceId, user.id, token);
  return true;
}

/**
 * Sign-out: remove this device from the server so its alarms stop, and drop the flag. Never fails and
 * waits at most a few seconds, so sign-out always goes on. Keeps the device id for the next user
 * @returns {Promise<void>} resolves when done or given up
 */
async function unregisterPushDevice() {
  const saved = getRegistration();
  removeStorage(REGISTRATION_KEY);
  if (!saved) return;
  const timeout = new Promise((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS));
  try {
    await Promise.race([deletePushDevice(saved.deviceId), timeout]);
  } catch (error) {
    console.warn('Push device was not removed:', error);
  }
}

/**
 * Get this device's Firebase token. Firebase can change it at any time
 * @returns {Promise<string>} token, or an empty string
 */
async function getFirebaseToken() {
  const registration = await registerMessagingServiceWorker();
  await navigator.serviceWorker.ready;
  return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
}

/**
 * Save the "registered" flag
 * @param {string} deviceId - device id
 * @param {string} userId - Auth0 user id
 * @param {string} token - Firebase token
 * @returns {void}
 */
function saveRegistration(deviceId, userId, token) {
  writeStorage(REGISTRATION_KEY, JSON.stringify({ deviceId, userId, token, registeredAt: Date.now() }));
}

/**
 * True on an iPhone or iPad in a browser tab: web push needs the home screen app there (iOS 16.4+)
 * @returns {boolean} true in iOS Safari
 */
function isIosBrowserTab() {
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  return isIos && !isStandalone;
}

/**
 * localStorage helpers: storage can be unavailable (e.g. private mode)
 * @param {string} key - storage key
 * @returns {string | null} value
 */
function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * @param {string} key - storage key
 * @param {string} value - value
 * @returns {void}
 */
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not kept: the next start checks with the server again
  }
}

/**
 * @param {string} key - storage key
 * @returns {void}
 */
function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing was saved
  }
}

export {
  DEVICE_ID_KEY,
  REGISTRATION_KEY,
  enablePush,
  getDeviceId,
  getPushAvailability,
  getRegistration,
  syncPushRegistration,
  unregisterPushDevice,
};
