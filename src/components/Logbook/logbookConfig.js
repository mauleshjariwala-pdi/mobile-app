/**
 * logbookConfig.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { INSPECTION_COMPONENTS } from './logbookOptions';
import { getRepairDefaults, getRepairMissingFields, toRepairSubmitBody } from './repairRules';

/**
 * @typedef {object} FieldConfig
 * @property {string} name - submit key
 * @property {string} label - field label
 * @property {'select' | 'number' | 'toggle' | 'textarea' | 'picker' | 'multipicker'} type - input type
 * @property {Array} [options] - options for select and picker fields
 * @property {Array} [groups] - grouped options for the multi-select picker
 * @property {string} [placeholder] - picker text when nothing is selected
 * @property {string} [placeholderValue] - value of the select "Choose" option
 * @property {string} [unit] - unit badge for number fields
 * @property {boolean} [integer] - whole numbers only
 * @property {boolean} [required] - marks the label with a required asterisk
 * @property {string} [hint] - helper text below the field
 * @property {string | string[]} [defaultValue] - initial value
 *
 * @typedef {object} Purpose
 * @property {string} id - purpose identifier
 * @property {string} value - value submitted as `purpose`
 * @property {string} label - card title
 * @property {string} description - card description
 * @property {string} icon - Icon name
 * @property {boolean} [dynamic] - fields come from repairRules.js
 * @property {FieldConfig[]} fields - static fields in render order
 */

// Constants
const COMMENTS_FIELD = { name: 'comments', label: 'Comments', type: 'textarea' };
// `value` is what the backend receives as `purpose`; Repair fields are dynamic (see repairRules.js)
const PURPOSES = [
  {
    id: 'inspection',
    value: 'Inspection',
    label: 'Inspection',
    description: 'Log a routine inspection of components',
    icon: 'inspection',
    fields: [
      {
        name: 'componentInspected',
        label: 'Components inspected',
        type: 'multipicker',
        options: INSPECTION_COMPONENTS,
        placeholder: 'Choose modules',
        defaultValue: [],
      },
      COMMENTS_FIELD,
    ],
  },
  {
    id: 'repair',
    value: 'Repair',
    label: 'Repair',
    description: 'Record changed parts, mud and alarm details',
    icon: 'repair',
    dynamic: true,
    fields: [],
  },
  {
    id: 'dampener',
    value: 'Precharge',
    label: 'Dampener Pre-charge',
    description: 'Capture the dampener pre-charge pressure',
    icon: 'dampener',
    fields: [
      {
        name: 'pressure',
        label: 'Pressure',
        type: 'number',
        unit: 'PSI',
        hint: 'Dampener pre-charge pressure reading',
      },
      { name: 'inspected', label: 'Inspected', type: 'toggle', defaultValue: 'No' },
      COMMENTS_FIELD,
    ],
  },
];

/**
 * Build the POST body for a purpose (API sections 4.3 to 4.5); only the fields of that purpose are sent
 * @param {Purpose} purpose - selected purpose
 * @param {object} values - form values
 * @param {string} dateTime - local date and time from the form
 * @returns {object} request body
 */
function buildLogbookBody(purpose, values, dateTime) {
  const body = { dateOfRepair: new Date(dateTime).toISOString(), purpose: purpose.value };
  const comments = String(values.comments ?? '').trim();
  switch (purpose.value) {
    case 'Inspection':
      return { ...body, componentInspected: [...values.componentInspected], ...(comments && { comments }) };
    case 'Repair':
      return { ...body, ...toRepairSubmitBody(values) };
    default:
      return {
        ...body,
        precharge_pressure: Number(values.pressure),
        precharge_inspected: values.inspected === 'Yes' ? 1 : 0,
        ...(comments && { precharge_comments: comments }),
      };
  }
}

/**
 * Get the initial form values for a purpose
 * @param {Purpose} purpose - selected purpose
 * @returns {object} values keyed by field name
 */
function getDefaultValues(purpose) {
  if (purpose.dynamic) return getRepairDefaults();
  return Object.fromEntries(
    purpose.fields.map((field) => {
      const value = field.defaultValue ?? '';
      return [field.name, Array.isArray(value) ? [] : value];
    })
  );
}

/**
 * Format a date for <input type="datetime-local" step="1">, e.g. 2026-10-08T08:05:09
 * @param {Date} [date] - date to format
 * @returns {string} local date and time
 */
function toDateTimeInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * List every required field of the purpose that is still empty; mirrors validateLogbookEntry and validateRepair
 * @param {Purpose} purpose - selected purpose
 * @param {object} values - form values
 * @returns {string[]} labels of the missing fields
 */
function getMissingFields(purpose, values) {
  if (purpose.dynamic) return getRepairMissingFields(values);
  if (purpose.value === 'Inspection') return values.componentInspected?.length ? [] : ['Components inspected'];
  if (purpose.value === 'Precharge' && (values.pressure === '' || Number.isNaN(Number(values.pressure)))) {
    return ['Pressure'];
  }
  return [];
}

/**
 * Check the entry date: it must be set and not in the future
 * @param {string} dateTime - local date and time from the form
 * @returns {string} error message, or '' when the date is valid
 */
function validateEntryDate(dateTime) {
  const date = new Date(dateTime).getTime();
  if (Number.isNaN(date)) return 'Please choose a date and time.';
  if (date > Date.now()) return 'Future entries are not allowed.';
  return '';
}

/**
 * Run the client-side checks for Inspection and pre-charge and the date checks for every purpose
 * @param {Purpose} purpose - selected purpose
 * @param {object} values - form values
 * @param {string} dateTime - local date and time from the form
 * @returns {string} error message, or '' when the entry can be sent
 */
function validateLogbookEntry(purpose, values, dateTime) {
  const dateError = validateEntryDate(dateTime);
  if (dateError) return dateError;
  if (purpose.value === 'Inspection' && !values.componentInspected.length) {
    return 'Please select a component to inspect.';
  }
  if (purpose.value === 'Precharge' && (values.pressure === '' || Number.isNaN(Number(values.pressure)))) {
    return 'Please enter the pre-charge pressure.';
  }
  return '';
}

export {
  PURPOSES,
  buildLogbookBody,
  getDefaultValues,
  getMissingFields,
  toDateTimeInputValue,
  validateEntryDate,
  validateLogbookEntry,
};
