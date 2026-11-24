/**
 * historyData.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { toDateTimeInputValue } from '../Logbook/logbookConfig';

/**
 * @typedef {object} HistoryDetail
 * @property {string} label - field label
 * @property {string} value - recorded value ('' when empty)
 * @property {string} [unit] - unit shown after the label
 * @property {'boolean'} [type] - Yes/No value shown as a badge
 * @property {boolean} [wide] - tile spans the full row
 * @property {string} [icon] - Icon name for the full-width Yes/No tile
 * @property {string} [yesText] - caption when the value is Yes
 * @property {string} [noText] - caption when the value is No
 *
 * @typedef {object} HistoryEntry
 * @property {string} id - entry identifier
 * @property {string} purpose - Inspection or Repair
 * @property {string[]} components - components inspected or changed
 * @property {string} pump - mud pump label, e.g. "Pump 1"
 * @property {string} rig - rig identifier ('' when unknown)
 * @property {string} mudpump - mud pump number
 * @property {string} username - user who entered the record ('' when unknown)
 * @property {string} alarmStatus - alarm status for Repair (the purpose when not recorded), "No Alarm" for
 *   Inspection (a key of STATUS_TONE)
 * @property {number} dateTime - work date (epoch ms)
 * @property {number} submittedAt - time the entry was submitted (epoch ms); the work date when unknown
 * @property {HistoryDetail[]} details - detail tiles in display order
 */

// Constants
// Units used when the record does not include them
const DEFAULT_MUD_TEMPERATURE_UNIT = 'ºF';
const DEFAULT_MUD_WEIGHT_UNIT = 'ppg';
// Inspections do not record an alarm status
const NO_ALARM = 'No Alarm';
// Values the backend stores for fields that do not apply
const EMPTY_VALUES = new Set(['', 'N/A', 'Choose']);
// Colour tone for each alarm status (and for Inspection entries)
const STATUS_TONE = {
  Alarm: 'critical',
  Inspection: 'info',
  'Missed Alarm': 'critical',
  'No Alarm': 'ok',
  'Preventative Maintenance': 'info',
  Repair: 'info',
  Warning: 'warning',
};

/**
 * Build the detail tiles of a Repair record in the fixed display order;
 * empty values are kept so the tile shows a dash
 * @param {import('../../api/logbookApi').LogbookRecord} record - logbook record
 * @returns {HistoryDetail[]} detail tiles
 */
function buildRepairDetails(record) {
  const valueOf = (key) => (isEmpty(record[key]) ? '' : String(record[key]).trim());
  const oilFilterChanged = valueOf('oilFilterChanged');
  return [
    { label: 'LGS Content', unit: '%', value: valueOf('lgsContent') },
    { label: 'Re-Use Liners', value: valueOf('reUseLiners') },
    { label: 'Liner Size', unit: 'in', value: valueOf('linerSize') },
    { label: 'Mud Type', value: valueOf('mudType') },
    {
      label: 'Mud Weight',
      unit: isEmpty(record.mudWeightUnits) ? DEFAULT_MUD_WEIGHT_UNIT : record.mudWeightUnits,
      value: valueOf('mudWeight'),
    },
    {
      label: 'Mud Temperature',
      unit: isEmpty(record.mudTemperatureUnits) ? DEFAULT_MUD_TEMPERATURE_UNIT : record.mudTemperatureUnits,
      value: valueOf('mudTemp'),
    },
    {
      label: 'Oil Filter Changed',
      value: oilFilterChanged,
      wide: true,
      // Yes/No gets the illustrated tile; an empty value falls back to a plain tile with a dash
      ...(oilFilterChanged && {
        type: 'boolean',
        icon: 'oilDrop',
        yesText: 'Oil filter was replaced',
        noText: 'Oil filter was not replaced',
      }),
    },
  ];
}

/**
 * Build the card title in capitals, e.g. "RIG 547 • MUD PUMP 3"
 * @param {HistoryEntry} entry - history entry
 * @returns {string} title
 */
function entryTitle(entry) {
  const pump = `MUD PUMP ${entry.mudpump}`;
  return entry.rig ? `RIG ${entry.rig} • ${pump}` : pump;
}

/**
 * List the components of an entry, e.g. "Liner 1, Disch. Valve 1"; the purpose when there are none
 * @param {HistoryEntry} entry - history entry
 * @returns {string} components
 */
function entryComponents(entry) {
  return entry.components.join(', ') || entry.purpose;
}

/**
 * Format a timestamp in local time, e.g. 2026-10-10 01:49
 * @param {number} timestamp - epoch ms
 * @returns {string} formatted date and time
 */
function formatEntryDate(timestamp) {
  return toDateTimeInputValue(new Date(timestamp)).slice(0, 16).replace('T', ' ');
}

/**
 * Format a timestamp in local time with seconds, e.g. 2026-10-30 at 13:47:51
 * @param {number} timestamp - epoch ms
 * @returns {string} formatted date and time
 */
function formatSubmittedDate(timestamp) {
  return toDateTimeInputValue(new Date(timestamp)).replace('T', ' at ');
}

/**
 * Check whether a stored value means "not recorded"
 * @param {*} value - stored value
 * @returns {boolean} true when the value should not be shown
 */
function isEmpty(value) {
  return value === undefined || value === null || EMPTY_VALUES.has(String(value).trim());
}

/**
 * Split a comma-separated component list as stored by the backend
 * @param {string} [value] - e.g. "Liner 1,Disch. Valve 1"
 * @returns {string[]} components
 */
function splitComponents(value) {
  if (isEmpty(value)) return [];
  return String(value)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Pick the alarm status of a record: the recorded one for Repair, "No Alarm" for Inspection
 * @param {import('../../api/logbookApi').LogbookRecord} record - logbook record
 * @returns {string} alarm status
 */
function alarmStatusOf(record) {
  if (record.purpose !== 'Repair') return NO_ALARM;
  return isEmpty(record.KCF) ? record.purpose : record.KCF;
}

/**
 * Map a logbook API record to a History entry
 * @param {import('../../api/logbookApi').LogbookRecord} record - logbook record
 * @returns {HistoryEntry} history entry
 */
function toHistoryEntry(record) {
  const isRepair = record.purpose === 'Repair';
  const details = isRepair ? buildRepairDetails(record) : [];
  const dateTime = Number(record.dateOfRepair);
  details.push({ label: 'Comments', value: isEmpty(record.comments) ? '' : record.comments, wide: true });
  return {
    id: record.uid || `${record.rigID}-${record.mudpump}-${record.timeEntered}`,
    purpose: record.purpose,
    components: splitComponents(isRepair ? record.componentChanged : record.componentInspected),
    pump: `Pump ${record.mudpump}`,
    rig: isEmpty(record.rigID) ? '' : String(record.rigID),
    mudpump: String(record.mudpump),
    username: isEmpty(record.username) ? '' : record.username.trim(),
    alarmStatus: alarmStatusOf(record),
    dateTime,
    submittedAt: Number(record.timeEntered) || dateTime,
    details,
  };
}

export { STATUS_TONE, entryComponents, entryTitle, formatEntryDate, formatSubmittedDate, toHistoryEntry };
