/**
 * logbookApi.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { getActiveRig } from '../config/activeRig';
import { APP_CONFIG } from '../config/appConfig';
import {
  NO_RIG_ACCESS_MESSAGE,
  designerFetch,
  getRequestUser,
  requestErrorMessage,
  serviceHeaders,
} from './designerFetch';

/**
 * @typedef {object} LogbookRecord
 * @property {string} purpose - Inspection or Repair
 * @property {string} mudpump - mud pump number
 * @property {string} rigID - rig identifier
 * @property {number} dateOfRepair - work date (epoch ms)
 * @property {number} timeEntered - submission time (epoch ms)
 * @property {string} uid - unique record id
 * @property {string} [username] - submitting user
 * @property {string} [componentInspected] - comma-separated modules (Inspection)
 * @property {string} [componentChanged] - comma-separated components (Repair)
 * @property {string} [comments] - free-text comments
 * @property {number} [valid] - 1 for a valid record
 */

// Constants
const LOGBOOK_PATH = '/api/private/pump/logbook';
// 204 and 205 cannot carry a body, so their messages are mapped locally (API section 4.6)
const NO_BODY_MESSAGES = {
  204: 'Please add Liner and Head/Swab Hours.',
  205: 'Comment missing. Please resubmit.',
};

/**
 * Create a logbook entry for one mud pump (API section 4). Validation failures use 2xx and 3xx
 * codes with a plain-text body, so only 200 counts as success.
 * @param {object} options - request options
 * @param {string} options.mudpump - mud pump number, e.g. "1"
 * @param {object} options.body - request body for the purpose (dateOfRepair, purpose and its fields)
 * @returns {Promise<object | string>} written record, or the reply of the pre-charge service
 * @throws {LogbookApiError} if the service or user is not configured, or the entry is not saved
 */
async function createLogbookEntry({ mudpump, body }) {
  const { digitalTwinID, userToken, logbook } = APP_CONFIG;
  const rig = getActiveRig();
  const user = getRequestUser();
  if (!logbook.baseUrl) {
    throw new LogbookApiError('Logbook service is not configured.', 0);
  }
  const params = new URLSearchParams({
    rig,
    mudpump,
    login: user.login,
    userid: user.userId,
    email: user.email,
    digitalTwinID,
    userToken,
  });
  let response;
  try {
    response = await designerFetch(`${logbook.baseUrl}${LOGBOOK_PATH}?${params}`, {
      method: 'POST',
      headers: serviceHeaders(logbook, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new LogbookApiError(
      requestErrorMessage(error, 'Unable to reach the logbook service. Check your connection.'),
      0
    );
  }
  const text = await response.text().catch(() => '');
  if (response.status !== 200) {
    let message = NO_BODY_MESSAGES[response.status] || text.trim();
    if (response.status === 401) message = 'Not authorised to write to the logbook. Check the credentials.';
    if (response.status === 403) message = NO_RIG_ACCESS_MESSAGE;
    throw new LogbookApiError(message || `Logbook entry was not saved (${response.status}).`, response.status);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Get the logbook entries of one mud pump within a time range (API section 3)
 * @param {object} options - request options
 * @param {string} options.mudpump - mud pump number, e.g. "1"
 * @param {Date} options.from - start of the range
 * @param {Date} options.to - end of the range
 * @param {AbortSignal} [options.signal] - cancels the request
 * @returns {Promise<LogbookRecord[]>} logbook records
 * @throws {LogbookApiError} if the service is not configured or does not return a 2xx response
 */
async function fetchLogbookEntries({ mudpump, from, to, signal }) {
  const { digitalTwinID, userToken, logbook } = APP_CONFIG;
  const rig = getActiveRig();
  if (!logbook.baseUrl) {
    throw new LogbookApiError('Logbook service is not configured.', 0);
  }
  // URLSearchParams URL-encodes the ISO timestamps (":" becomes %3A) as the API requires
  const params = new URLSearchParams({
    digitalTwinID,
    rig,
    mudpump,
    from: from.toISOString(),
    to: to.toISOString(),
    userToken,
  });
  let response;
  try {
    response = await designerFetch(`${logbook.baseUrl}${LOGBOOK_PATH}?${params}`, {
      method: 'GET',
      headers: serviceHeaders(logbook),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new LogbookApiError(
      requestErrorMessage(error, 'Unable to reach the logbook service. Check your connection.'),
      0
    );
  }
  if (!response.ok) {
    // The service also answers 401 when the range is longer than 14 days
    const message =
      response.status === 403
        ? NO_RIG_ACCESS_MESSAGE
        : response.status === 401
          ? 'Not authorised to read the logbook. Check the credentials and use a range of 14 days or less.'
          : `Logbook request failed (${response.status}).`;
    throw new LogbookApiError(message, response.status);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Error thrown when the logbook service does not return a 2xx response
 */
class LogbookApiError extends Error {
  /**
   * @param {string} message - error message
   * @param {number} status - HTTP status (0 when the request did not reach the server)
   */
  constructor(message, status) {
    super(message);
    this.name = 'LogbookApiError';
    this.status = status;
  }
}

export { LogbookApiError, createLogbookEntry, fetchLogbookEntries };
