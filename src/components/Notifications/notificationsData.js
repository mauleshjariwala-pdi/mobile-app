/**
 * notificationsData.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

/**
 * @typedef {object} AlertNotification
 * @property {string} id - notification identifier
 * @property {'critical' | 'warning'} priority - red or yellow alert
 * @property {string} title - alert title
 * @property {string} reason - why the alert fired
 * @property {number} startedAt - alert start time (ms since epoch)
 * @property {{ label: string, value: string }[]} details - extra facts
 * @property {number | null} acknowledgedAt - acknowledge time (ms since epoch)
 */

// Constants
const MINUTE_MS = 60 * 1000;

/**
 * Format a duration, e.g. "25h 21m", "45m" or "Just now"
 * @param {number} ms - duration in milliseconds
 * @returns {string} formatted duration
 */
function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / MINUTE_MS));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'Just now';
}

/**
 * Map a smart alert from the API to the card model
 * @param {import('../../api/smartAlertApi').SmartAlertRecord} record - smart alert
 * @returns {AlertNotification} notification
 */
function toAlertNotification(record) {
  // The live service spells the key "componenet"; the documented key is "component"
  const component = record.component || record.componenet;
  const pump = record.mudpumpID || record.assetID;
  const [pumpHoursLabel, pumpHoursValue] = String(record.pumpHoursInfo ?? '').split(/:\s*/);
  const details = [
    component && { label: 'Component', value: component },
    pump && { label: 'Mud pump', value: pump },
    pumpHoursValue && { label: pumpHoursLabel, value: pumpHoursValue },
  ].filter(Boolean);
  const startedAt = Number(record.startTime || record.alarmStartTime) || Date.now();
  return {
    id: record.alertID,
    priority: record.type === 'warning' ? 'warning' : 'critical',
    title: record.moduleInfo || component || 'Smart alert',
    reason: toSentence(record.additionalInfo),
    startedAt,
    details,
    // Fall back to the start time so an acknowledged alert without a time still lands in Acknowledged
    acknowledgedAt: record.Acknowledged ? Number(record.acknowledgedTime) || startedAt : null,
  };
}

/**
 * Turn a sentence fragment into a sentence, e.g. "in warning for 1 hour" -> "In warning for 1 hour."
 * @param {string} text - text from the API
 * @returns {string} sentence, or '' when empty
 */
function toSentence(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return '';
  const capitalised = trimmed[0].toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

export { formatDuration, toAlertNotification };
