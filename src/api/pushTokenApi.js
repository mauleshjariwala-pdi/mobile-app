/**
 * pushTokenApi.js
 *
 * Push token routes of the Precision mobile app (docs/firebase-push-notifications, section 6): store,
 * check and remove this device's Firebase token. The server sends the alarms; the app only registers.
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { APP_CONFIG } from '../config/appConfig';
import { designerFetch, requestErrorMessage } from './designerFetch';

/**
 * @typedef {object} PushDevice
 * @property {string} deviceId - device id
 * @property {'web' | 'android' | 'ios'} platform - platform
 * @property {number} rigCount - number of rigs whose alarms reach this user
 * @property {number} createdAt - first stored (epoch ms)
 * @property {number} updatedAt - last stored (epoch ms)
 */

// Constants
const PUSH_TOKENS_PATH = '/api/private/push/tokens';

/**
 * Is this device stored for the signed-in user? (GET, needs read:digital_twin)
 * @param {string} deviceId - device id
 * @returns {Promise<PushDevice | null>} stored device, or null when it is not stored (404)
 * @throws {PushTokenApiError} on any other answer
 */
async function getPushDevice(deviceId) {
  const response = await send(deviceId, { method: 'GET' });
  if (response.status === 404) return null;
  return readAnswer(response);
}

/**
 * Store or update this device's Firebase token (PUT, needs write:digital_twin). The user comes from the
 * access token and the rigs from the user's access, so neither is sent
 * @param {string} deviceId - device id
 * @param {string} token - Firebase (FCM) token
 * @returns {Promise<{ deviceId: string, created: boolean }>} created is false for an update
 * @throws {PushTokenApiError} 409 when the device id or the token belongs to another user, 429 after
 *   more than 10 PUTs in a minute
 */
async function putPushDevice(deviceId, token) {
  const response = await send(deviceId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, token, platform: 'web' }),
  });
  return readAnswer(response);
}

/**
 * Remove this device, so it gets no more alarms (DELETE, needs write:digital_twin). Call it before the
 * Auth0 session is cleared: it needs the access token. keepalive lets it finish while the page leaves
 * @param {string} deviceId - device id
 * @returns {Promise<{ deviceId: string, deleted: boolean }>} deleted is false when nothing was stored
 * @throws {PushTokenApiError} when the device cannot be removed
 */
async function deletePushDevice(deviceId) {
  const response = await send(deviceId, { method: 'DELETE', keepalive: true });
  return readAnswer(response);
}

/**
 * Call the route of one device
 * @param {string} deviceId - device id, URL-encoded here
 * @param {RequestInit} init - fetch options
 * @returns {Promise<Response>} response
 * @throws {PushTokenApiError} when the request does not reach the server
 */
async function send(deviceId, init) {
  const url = `${APP_CONFIG.logbook.baseUrl}${PUSH_TOKENS_PATH}/${encodeURIComponent(deviceId)}`;
  try {
    return await designerFetch(url, init);
  } catch (error) {
    throw new PushTokenApiError(
      requestErrorMessage(error, 'Unable to reach the push service.'),
      0,
      error?.name === 'AuthError' ? 'UNAUTHORIZED' : 'NETWORK'
    );
  }
}

/**
 * Read a JSON answer. The route's own errors are { error: { code, message } }; a refused token gives
 * { error: "..." } (a string)
 * @param {Response} response - response
 * @returns {Promise<any>} parsed body of a 2xx answer
 * @throws {PushTokenApiError} on any answer other than 2xx
 */
async function readAnswer(response) {
  const text = await response.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (response.ok) return data;
  const error = data?.error;
  const code = typeof error === 'object' && error ? error.code : '';
  const message =
    (typeof error === 'object' && error ? error.message : error) || `Push request failed (${response.status}).`;
  throw new PushTokenApiError(message, response.status, code || '');
}

/**
 * Error thrown when a push token route does not return a 2xx response
 */
class PushTokenApiError extends Error {
  /**
   * @param {string} message - error message
   * @param {number} status - HTTP status (0 when the request did not reach the server)
   * @param {string} code - e.g. CONFLICT, TOO_MANY_REQUESTS, NOT_FOUND
   */
  constructor(message, status, code) {
    super(message);
    this.name = 'PushTokenApiError';
    this.status = status;
    this.code = code;
  }
}

export { PushTokenApiError, deletePushDevice, getPushDevice, putPushDevice };
