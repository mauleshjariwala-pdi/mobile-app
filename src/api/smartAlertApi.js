/**
 * smartAlertApi.js
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
 * @typedef {object} SmartAlertRecord
 * @property {string} alertID - unique alert id
 * @property {boolean} Acknowledged - acknowledgement state
 * @property {string} type - alert type, e.g. "alarm", "warning", "damage" or "unavailable" (no data)
 * @property {string} [rule] - rule that raised the alert, e.g. "rule2"
 * @property {string} [rigID] - rig identifier
 * @property {string} [mudpumpID] - mud pump number (rule2 family)
 * @property {string} [assetID] - mud pump number (rule5 family)
 * @property {string} [component] - component code, e.g. "PE H3"
 * @property {string} [componenet] - component, as spelled by the live service
 * @property {string} [moduleInfo] - action text, e.g. "Check Power End 3 in MUDPUMP 2"
 * @property {string} [additionalInfo] - why the alert fired
 * @property {number} [startTime] - alert start (epoch ms)
 * @property {number} [alarmStartTime] - alarm start (epoch ms)
 * @property {string} [pumpHoursInfo] - e.g. "Pump on time since alert started: 168hr"
 * @property {number} [acknowledgedTime] - acknowledge time (epoch ms), on acknowledged alerts
 * @property {number} [priority] - rule-engine priority
 */

// Constants
// ackType 1 is the ACKNOWLEDGE button of the Grafana SMART ALERTS panel
const ACK_TYPE_ACKNOWLEDGE = 1;
const SMART_ALERT_PATH = '/api/private/rig/smartAlert/v2';

/**
 * Acknowledge one smart alert as the signed-in user; the HTTP status is the source of truth
 * @param {string} alertID - `alertID` of the alert from the alert list
 * @returns {Promise<void>} resolves when the service answers with a 2xx status
 * @throws {SmartAlertApiError} if the service is not configured or the alert is not acknowledged
 */
async function acknowledgeSmartAlert(alertID) {
  const { digitalTwinID, userToken, ruleEngine } = APP_CONFIG;
  const rig = getActiveRig();
  const user = getRequestUser();
  if (!ruleEngine.baseUrl) {
    throw new SmartAlertApiError('Smart alert service is not configured.', 0);
  }
  const params = new URLSearchParams({
    userlogin: user.login,
    useremail: user.email,
    userid: user.userId,
    alertid: alertID,
    ackType: String(ACK_TYPE_ACKNOWLEDGE),
  });
  let response;
  try {
    response = await designerFetch(`${ruleEngine.baseUrl}${SMART_ALERT_PATH}?${params}`, {
      method: 'POST',
      headers: serviceHeaders(ruleEngine, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ digitalTwinID, userToken, rig }),
    });
  } catch (error) {
    throw new SmartAlertApiError(
      requestErrorMessage(error, 'Unable to reach the smart alert service. Check your connection.'),
      0
    );
  }
  if (!response.ok) {
    const message =
      response.status === 403
        ? NO_RIG_ACCESS_MESSAGE
        : response.status === 401
          ? 'Not authorised to acknowledge alerts. Check the credentials.'
          : `Error acknowledging the alert (${response.status}).`;
    throw new SmartAlertApiError(message, response.status);
  }
}

/**
 * Get the smart alerts of the configured rig (API section 6)
 * @param {object} [options] - request options
 * @param {boolean} [options.ack] - false for unacknowledged alerts, true for acknowledged ones
 * @param {string} [options.type] - alert category filter
 * @param {AbortSignal} [options.signal] - cancels the request
 * @returns {Promise<SmartAlertRecord[]>} alerts; empty when the service reports no data
 * @throws {SmartAlertApiError} if the service is not configured or does not return a 2xx response
 */
async function fetchSmartAlerts({ ack = false, type = 'aro', signal } = {}) {
  const { digitalTwinID, userToken, ruleEngine } = APP_CONFIG;
  const rig = getActiveRig();
  if (!ruleEngine.baseUrl) {
    throw new SmartAlertApiError('Smart alert service is not configured.', 0);
  }
  const params = new URLSearchParams({ digitalTwinID, rig, ack: String(ack), type, userToken });
  let response;
  try {
    response = await designerFetch(`${ruleEngine.baseUrl}${SMART_ALERT_PATH}?${params}`, {
      method: 'GET',
      headers: serviceHeaders(ruleEngine),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new SmartAlertApiError(
      requestErrorMessage(error, 'Unable to reach the smart alert service. Check your connection.'),
      0
    );
  }
  if (!response.ok) {
    const message =
      response.status === 403
        ? NO_RIG_ACCESS_MESSAGE
        : response.status === 401
          ? 'Not authorised to read smart alerts. Check the credentials.'
          : `Smart alert request failed (${response.status}).`;
    throw new SmartAlertApiError(message, response.status);
  }
  const data = await response.json();
  // No data comes back as { table: [{ type: 'unavailable' }] } instead of an empty array
  const records = Array.isArray(data) ? data : (data?.table ?? []);
  return records.filter((r) => r && r.type !== 'unavailable');
}

/**
 * Error thrown when the smart alert service does not return a 2xx response
 */
class SmartAlertApiError extends Error {
  /**
   * @param {string} message - error message
   * @param {number} status - HTTP status (0 when the request did not reach the server)
   */
  constructor(message, status) {
    super(message);
    this.name = 'SmartAlertApiError';
    this.status = status;
  }
}

export { SmartAlertApiError, acknowledgeSmartAlert, fetchSmartAlerts };
