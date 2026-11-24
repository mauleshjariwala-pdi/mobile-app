/**
 * rigApi.js
 *
 * Precision rig APIs: the user's rigs in a country, and the equipment layout of one rig.
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { APP_CONFIG } from '../config/appConfig';
import { NO_RIG_ACCESS_MESSAGE, designerFetch, requestErrorMessage } from './designerFetch';

/**
 * @typedef {object} EquipmentEntry
 * @property {boolean} present - true when the rig has this equipment
 * @property {number} count - number of units
 * @property {number[]} [ids] - unit numbers to use in other calls (pumps and gensets)
 * @property {string | null} [model] - model, null when not known
 *
 * @typedef {object} RigLayout
 * @property {string} rig - rig as sent, e.g. "575" or "Demo"
 * @property {string} country - US, CA, ME or AR
 * @property {string} region - e.g. appalachia
 * @property {'imperial' | 'si'} units - unit system of the rig
 * @property {EquipmentEntry} pumps - mud pumps
 * @property {EquipmentEntry} topDrive - top drive
 * @property {EquipmentEntry} gensets - generator sets
 * @property {EquipmentEntry} mudSystems - mud systems
 * @property {EquipmentEntry} catwalk - catwalk
 * @property {EquipmentEntry} hoisting - hoisting
 * @property {object} evergreen - evergreen systems
 */

// Constants
// Rig routes live on the same Designer as the pump logbook
const RIGS_BY_COUNTRY_PATH = '/api/private/rigs/bycountry';
const RIG_LAYOUT_PATH = '/api/private/rig/layout';
// 503: the server is starting. Try again after a short wait
const STARTING_RETRIES = 2;
const STARTING_RETRY_DELAY_MS = 3000;
const LAYOUT_MESSAGES = {
  400: 'No rig was given.',
  403: NO_RIG_ACCESS_MESSAGE,
  404: 'This rig was not found.',
  503: 'The rig service is starting. Please try again in a few seconds.',
};

/**
 * Get the user's rigs in one country
 * @param {string} country - US, CA, ME or AR (any letter case)
 * @param {object} [options] - request options
 * @param {AbortSignal} [options.signal] - cancels the request
 * @returns {Promise<string[]>} rig numbers, sorted; empty when the user has no rig there
 * @throws {RigApiError} when the rigs cannot be read
 */
async function fetchRigsByCountry(country, { signal } = {}) {
  const params = new URLSearchParams({ country });
  const data = await getJson(`${RIGS_BY_COUNTRY_PATH}?${params}`, signal, {
    400: `Unknown country "${country}".`,
    503: LAYOUT_MESSAGES[503],
  });
  return Array.isArray(data) ? data.map(String) : [];
}

/**
 * Get the equipment layout of one rig
 * @param {string} rig - rig number or name
 * @param {object} [options] - request options
 * @param {AbortSignal} [options.signal] - cancels the request
 * @returns {Promise<RigLayout>} rig layout
 * @throws {RigApiError} when the layout cannot be read
 */
async function fetchRigLayout(rig, { signal } = {}) {
  const params = new URLSearchParams({ rig });
  return getJson(`${RIG_LAYOUT_PATH}?${params}`, signal, LAYOUT_MESSAGES);
}

/**
 * Mud pump numbers of a rig layout, e.g. ["1", "2", "3"]; empty when the rig has no pumps
 * @param {RigLayout | null} layout - rig layout
 * @returns {string[]} pump numbers
 */
function getLayoutPumps(layout) {
  const pumps = layout?.pumps;
  if (!pumps?.present) return [];
  if (Array.isArray(pumps.ids) && pumps.ids.length > 0) return pumps.ids.map(String);
  // No ids given: number the pumps 1..count
  return Array.from({ length: Math.max(0, pumps.count || 0) }, (_, i) => String(i + 1));
}

/**
 * GET a rig route and read its JSON answer. A 503 (server starting) is tried again after a wait
 * @param {string} path - route path with query
 * @param {AbortSignal | undefined} signal - cancels the request
 * @param {Record<number, string>} messages - message per HTTP status
 * @returns {Promise<any>} parsed JSON
 * @throws {RigApiError} on any answer other than 2xx
 */
async function getJson(path, signal, messages) {
  const { baseUrl } = APP_CONFIG.logbook;
  if (!baseUrl) throw new RigApiError('Rig service is not configured.', 0);
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await designerFetch(`${baseUrl}${path}`, { method: 'GET', signal });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new RigApiError(requestErrorMessage(error, 'Unable to reach the rig service. Check your connection.'), 0);
    }
    if (response.status === 503 && attempt < STARTING_RETRIES) {
      await wait(STARTING_RETRY_DELAY_MS, signal);
      continue;
    }
    const text = await response.text().catch(() => '');
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const message =
        response.status === 401
          ? 'Not authorised to read the rigs. Please sign in again.'
          : messages[response.status] || data?.error || `Rig request failed (${response.status}).`;
      throw new RigApiError(message, response.status);
    }
    return data;
  }
}

/**
 * Wait, unless the request is cancelled first
 * @param {number} ms - wait in milliseconds
 * @param {AbortSignal | undefined} signal - cancels the wait
 * @returns {Promise<void>} resolves after the wait
 */
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/**
 * Error thrown when a rig route does not return a 2xx response
 */
class RigApiError extends Error {
  /**
   * @param {string} message - error message
   * @param {number} status - HTTP status (0 when the request did not reach the server)
   */
  constructor(message, status) {
    super(message);
    this.name = 'RigApiError';
    this.status = status;
  }
}

export { RigApiError, fetchRigLayout, fetchRigsByCountry, getLayoutPumps };
