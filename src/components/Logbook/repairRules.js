/**
 * repairRules.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { ALARM_PLACEHOLDER, LOGBOOK_RESPONSE_MESSAGES } from './logbookOptions';

/**
 * @typedef {object} RepairField
 * @property {string} id - submit key
 * @property {string} label - field label
 * @property {'multiselect' | 'select' | 'yesno' | 'number' | 'text'} control - input type
 * @property {string} [options] - option list name or brand category
 * @property {*} default - default value
 *
 * @typedef {object} ComponentField
 * @property {string} component - component that reveals the field
 * @property {string} id - submit key
 * @property {string} label - field label
 * @property {string} [category] - brand category (brand fields only)
 */

// Constants
/** @type {ComponentField[]} Component to brand field and brand category */
const BRAND_FIELDS = [
  ...perCylinder((n) => ({
    component: `Head/Swab ${n}`,
    id: `Piston_${n}_brand`,
    label: `Head/Swab ${n} Brand`,
    category: 'Piston',
  })),
  ...perCylinder((n) => ({
    component: `Disch. Seat ${n}`,
    id: `Disch_Seat_${n}_brand`,
    label: `Disch. Seat ${n} Brand`,
    category: 'Seats',
  })),
  ...perCylinder((n) => ({
    component: `Suction Seat ${n}`,
    id: `Suction_Seat_${n}_brand`,
    label: `Suction Seat ${n} Brand`,
    category: 'Seats',
  })),
  ...perCylinder((n) => ({
    component: `Disch. Valve ${n}`,
    id: `Disch_Valve_${n}_brand`,
    label: `Disch. Valve ${n} Brand`,
    category: 'Valves',
  })),
  ...perCylinder((n) => ({
    component: `Suction Valve ${n}`,
    id: `Suction_Valve_${n}_brand`,
    label: `Suction Valve ${n} Brand`,
    category: 'Valves',
  })),
  ...perCylinder((n) => ({
    component: `Liner ${n}`,
    id: `Liner_${n}_brand`,
    label: `Liner ${n} Type`,
    category: 'Liners',
  })),
];
/** @type {ComponentField[]} Component to hours field */
const HOURS_FIELDS = [
  ...perCylinder((n) => ({ component: `Liner ${n}`, id: `liner${n}Hours`, label: `Liner ${n} Hours` })),
  ...perCylinder((n) => ({ component: `Head/Swab ${n}`, id: `piston${n}Hours`, label: `Head/Swab ${n} Hours` })),
];
// Fields submitted as numbers
const NUMBER_FIELDS = [...HOURS_FIELDS.map((h) => h.id), 'mudWeight', 'lgsContent', 'mudTemp', 'numberofGaskets'];
/** @type {RepairField[]} Render order; units are shown as badges by the screen */
const REPAIR_FIELDS = [
  {
    id: 'componentChanged',
    label: 'Components being changed',
    control: 'multiselect',
    options: 'COMPONENTS',
    default: [],
  },
  ...BRAND_FIELDS.map((b) => ({ id: b.id, label: b.label, control: 'select', options: b.category, default: '' })),
  { id: 'linerSize', label: 'Liner Size [in]', control: 'select', options: 'LINER_SIZES', default: '' },
  { id: 'reUseLiners', label: 'Re-Use Liners', control: 'yesno', options: 'YES_NO', default: 'No' },
  ...HOURS_FIELDS.map((h) => ({ id: h.id, label: h.label, control: 'number', default: 0 })),
  { id: 'wearplateInspected', label: 'Wearplate Inspected', control: 'yesno', options: 'YES_NO', default: 'Yes' },
  { id: 'pistonInspected', label: 'Head/Swab Inspected', control: 'yesno', options: 'YES_NO', default: 'No' },
  { id: 'linerInspected', label: 'Liner Inspected', control: 'yesno', options: 'YES_NO', default: 'No' },
  { id: 'seatInspected', label: 'Seat Inspected', control: 'yesno', options: 'YES_NO', default: 'No' },
  { id: 'moduleInspected', label: 'Module Inspected', control: 'yesno', options: 'YES_NO', default: 'No' },
  { id: 'valveInspected', label: 'Valve Inspected', control: 'yesno', options: 'YES_NO', default: 'No' },
  { id: 'mudType', label: 'Mud Type', control: 'select', options: 'MUD_TYPES', default: '' },
  { id: 'mudWeight', label: 'Mud Weight', control: 'number', default: 0 },
  { id: 'lgsContent', label: 'LGS Content', control: 'number', default: 0 },
  { id: 'mudTemp', label: 'Mud Temperature', control: 'number', default: 0 },
  { id: 'numberofGaskets', label: 'How Many Gaskets?', control: 'number', default: 0 },
  { id: 'oilFilterChanged', label: 'Oil Filter Changed', control: 'yesno', options: 'YES_NO', default: 'No' },
  { id: 'KCF', label: 'Alarm Status', control: 'select', options: 'ALARM_STATUS', default: ALARM_PLACEHOLDER },
  { id: 'comments', label: 'Comments', control: 'text', default: '' },
];

/**
 * Get the patch of values to apply after a change from prev to next
 * @param {object} prev - values before the change (including purpose)
 * @param {object} next - values after the change (including purpose)
 * @returns {object} values to reset
 */
function applyRepairResets(prev, next) {
  const patch = {};
  if (prev.purpose === 'Repair' && next.purpose !== 'Repair') {
    const keepComments = next.purpose === 'Inspection';
    for (const [k, d] of Object.entries(getRepairDefaults())) {
      if (k === 'comments' && keepComments) continue;
      patch[k] = d;
    }
    return patch;
  }
  const before = prev.componentChanged ?? [];
  const after = next.componentChanged ?? [];
  const added = after.filter((c) => !before.includes(c));
  const removed = before.filter((c) => !after.includes(c));
  for (const c of [...added, ...removed]) {
    const b = BRAND_FIELDS.find((x) => x.component === c);
    if (b) patch[b.id] = '';
  }
  for (const c of removed) {
    const h = HOURS_FIELDS.find((x) => x.component === c);
    if (h) patch[h.id] = 0;
  }
  if (removed.length && !perCylinder((n) => `Liner ${n}`).some((c) => after.includes(c))) patch.linerSize = '';
  if (prev.reUseLiners === 'Yes' && next.reUseLiners === 'No') {
    for (const h of HOURS_FIELDS) patch[h.id] = 0;
  }
  return patch;
}

/**
 * Get fresh default values for every Repair field
 * @returns {object} default values keyed by submit key
 */
function getRepairDefaults() {
  return Object.fromEntries(REPAIR_FIELDS.map((f) => [f.id, Array.isArray(f.default) ? [] : f.default]));
}

/**
 * Check whether a Repair field is shown for the current values
 * @param {string} id - field submit key
 * @param {object} v - form values, including purpose
 * @returns {boolean} true when the field is visible
 */
function isRepairFieldVisible(id, v) {
  const repair = v.purpose === 'Repair';
  const changed = repair ? (v.componentChanged ?? []) : [];
  const contains = (s) => changed.some((c) => c.includes(s));
  const brand = BRAND_FIELDS.find((b) => b.id === id);
  if (brand) return changed.includes(brand.component);
  const hours = HOURS_FIELDS.find((h) => h.id === id);
  if (hours) return changed.includes(hours.component) && v.reUseLiners === 'Yes';
  switch (id) {
    case 'componentChanged':
    case 'mudType':
    case 'mudWeight':
    case 'lgsContent':
    case 'mudTemp':
    case 'oilFilterChanged':
    case 'KCF':
      return repair;
    case 'comments':
      return repair || v.purpose === 'Inspection';
    case 'linerSize':
      return perCylinder((n) => changed.includes(`Liner ${n}`) && !!v[`Liner_${n}_brand`]).some(Boolean);
    case 'reUseLiners':
      return HOURS_FIELDS.some((h) => changed.includes(h.component));
    case 'wearplateInspected':
    case 'pistonInspected':
    case 'linerInspected':
      return contains('Liner 1') || contains('Liner 2') || contains('Liner 3') || contains('Head');
    case 'seatInspected':
      return contains('Valve');
    case 'moduleInspected':
      return contains('Valve') || contains('Seat');
    case 'valveInspected':
      return contains('Seat');
    case 'numberofGaskets':
      return contains('Gasket');
    default:
      return false;
  }
}

/**
 * Build one item per pump cylinder (1, 2 and 3)
 * @template T
 * @param {(n: number) => T} build - builds the item for cylinder n
 * @returns {T[]} items for cylinders 1 to 3
 */
function perCylinder(build) {
  return [1, 2, 3].map(build);
}

/**
 * Build the Repair part of the submit body: only the visible fields (API section 5.5), with the
 * types the backend expects. The server derives linerMaterial, gasketType, processed and uid.
 * @param {object} values - form values
 * @returns {object} submit body without dateOfRepair and purpose
 */
function toRepairSubmitBody(values) {
  const v = { ...getRepairDefaults(), ...values, purpose: 'Repair' };
  const body = {};
  for (const { id } of REPAIR_FIELDS) {
    if (!isRepairFieldVisible(id, v)) continue;
    if (NUMBER_FIELDS.includes(id)) body[id] = Number(v[id]) || 0;
    else if (id === 'linerSize') body[id] = Number(v[id]);
    else if (id === 'componentChanged') body[id] = [...v[id]];
    else if (id === 'comments') body[id] = v[id].trim();
    else body[id] = v[id];
  }
  return body;
}

/**
 * List every required Repair field that is still empty, in form order; mirrors validateRepair
 * @param {object} values - form values
 * @returns {string[]} labels of the missing fields
 */
function getRepairMissingFields(values) {
  const v = { ...values, purpose: 'Repair' };
  const missing = [];
  if (!(v.componentChanged ?? []).length) missing.push('Components');
  BRAND_FIELDS.forEach((b) => isRepairFieldVisible(b.id, v) && !v[b.id] && missing.push(b.label));
  if (isRepairFieldVisible('linerSize', v) && v.linerSize === '') missing.push('Liner Size');
  HOURS_FIELDS.forEach((h) => isRepairFieldVisible(h.id, v) && !(Number(v[h.id]) > 0) && missing.push(h.label));
  if (!v.KCF || v.KCF === ALARM_PLACEHOLDER) missing.push('Alarm Status');
  if (!String(v.comments ?? '').trim()) missing.push('Comments');
  return missing;
}

/**
 * Run the client-side checks that mirror the server codes
 * @param {object} values - form values
 * @returns {{ code: number, message: string } | null} first failure, or null when valid
 */
function validateRepair(values) {
  const v = { ...values, purpose: 'Repair' };
  const fail = (code) => ({ code, message: LOGBOOK_RESPONSE_MESSAGES[code] });
  if (!(v.componentChanged ?? []).length) return fail(206);
  if (!v.KCF || v.KCF === ALARM_PLACEHOLDER) return fail(207);
  if (BRAND_FIELDS.some((b) => isRepairFieldVisible(b.id, v) && !v[b.id])) return fail(305);
  if (isRepairFieldVisible('linerSize', v) && v.linerSize === '') return fail(212);
  if (HOURS_FIELDS.some((h) => isRepairFieldVisible(h.id, v) && !(Number(v[h.id]) > 0))) return fail(204);
  if (!String(v.comments ?? '').trim()) return fail(205);
  return null;
}

export {
  REPAIR_FIELDS,
  applyRepairResets,
  getRepairDefaults,
  getRepairMissingFields,
  isRepairFieldVisible,
  toRepairSubmitBody,
  validateRepair,
};
