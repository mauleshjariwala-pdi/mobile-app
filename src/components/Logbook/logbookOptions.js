/**
 * logbookOptions.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

/**
 * @typedef {object} Option
 * @property {string} label - text shown to the user
 * @property {string | number} value - submitted value
 */

// Constants
const ALARM_PLACEHOLDER = 'Choose';
const ALARM_STATUS = opts(['Alarm', 'Warning', 'No Alarm', 'Preventative Maintenance', 'Missed Alarm']);
const BRAND_CATEGORIES = ['Piston', 'Seats', 'Valves', 'Liners'];
// Purpose = Repair: 68 options in this order, grouped for the picker
const COMPONENT_GROUPS = [
  { group: 'Liners', options: opts(triple('Liner')) },
  { group: 'Discharge valves', options: opts(triple('Disch. Valve')) },
  { group: 'Head/Swab', options: opts(triple('Head/Swab')) },
  { group: 'Discharge modules', options: opts(triple('Disch. Module')) },
  { group: 'Discharge seats', options: opts(triple('Disch. Seat')) },
  { group: 'Suction seats', options: opts(triple('Suction Seat')) },
  { group: 'Suction valves', options: opts(triple('Suction Valve')) },
  { group: 'Suction modules', options: opts(triple('Suction Module')) },
  { group: 'Wearplates', options: opts(triple('Wearplate')) },
  { group: 'Pony rods', options: opts(triple('Pony Rod')) },
  { group: 'Pony rod seals', options: opts(triple('Pony Rod Seal')) },
  { group: 'Piston rods', options: opts(triple('Piston Rod')) },
  { group: 'Oil', options: [{ label: 'Oil Change', value: 'Oil change' }] },
  { group: 'Wearplate gaskets', options: opts(triple('Wearplate Gasket')) },
  { group: 'Liner gaskets', options: opts(triple('Liner Gasket')) },
  { group: 'Cap gaskets', options: opts(triple('Cap Gasket')) },
  { group: 'Valve inserts', options: opts(triple('Valve Insert')) },
  { group: 'Suction caps', options: opts(triple('Suction Cap')) },
  { group: 'Clipper seals', options: opts(triple('Clipper Seal')) },
  { group: 'Dampener', options: opts(['Pulsation Dampener Bladder']) },
  { group: 'Discharge screens', options: opts(triple('Discharge Screen')) },
  { group: 'Suction thread rings', options: opts(triple('Suction Thread Ring')) },
  { group: 'Liner lock thread rings', options: opts(triple('Liner Lock Thread Ring')) },
  { group: 'Liner lock nuts', options: opts(triple('Liner Lock Nut')) },
];
const COMPONENT_OPTIONS = COMPONENT_GROUPS.flatMap((g) => g.options);
// Fallback brand lists; runtime values come from the brandlist API
const FALLBACK_BRANDS = {
  Piston: opts([
    'Forum : Black Max',
    'Forum : Blue Devil',
    'Forum : Endurohead',
    'Forum : GS Rubber',
    'Forum : Highlander',
    'Forum : Highlander HT',
    'Forum : Red Head',
    'Forum : Double Duro Urethane Red Head',
    'Mission : Black Lightning',
    'Mission : Blue Lightning',
    'Mission : Green Duo',
    'Mission : Maverick (Purple)',
    'Mission : White Lightning (Bonded XT)',
    'Mission : White Lightning (Slip Seal)',
    'Mud King : Cowboy HT/HP',
    'Mud King : Long Life',
    'Premium : KD',
    'Premium : Patriot HT',
    'Premium : Patriot ST',
    'Premium : Patriot TD',
    'Premium : Patriot FB',
    'Premium : X300',
    'Premium : X350',
    'Premium : X400',
    'Premium : X450',
    'Premium : X500',
    'SouthWest : Black panther',
    'SouthWest : BlackCat',
    'SouthWest : BullDog / DualDuro',
    'SouthWest : Fail Safe',
    'SouthWest : Hellcat',
    'SouthWest : Pitbull',
    'SouthWest : Singe Duro',
    'PSC : Red/Blue',
  ]),
  Seats: opts([
    'Forum : 4-WEB',
    'Forum : Double Angle 3-WEB',
    'Forum : Full Open',
    'Forum : Full Open Mod.',
    'Forum : Plate Type 3-WEB',
    'Forum : FO Roughneck Style',
    'Gardner Denver : Full Open',
    'Mission : Full Open',
    'Mission : Full Open Mod.',
    'Mission : Supreme (4-Web)',
    'Mud King : Full Open',
    'Mud King : Full Open Mod.',
    'Premium : 4-WEB',
    'Premium : Full Open',
    'Premium : Full Open STD',
    'Premium : Full Open Mod.',
    'Premium : XS',
    'Premium : XS200E',
    'Southwest : 3-WEB',
    'Southwest : 4-WEB',
    'Southwest : Full Open',
    'NOV : Powerlast',
  ]),
  Valves: opts([
    'Forum : 3-WEB',
    'Forum : 3-WEB HT',
    'Forum : 4-WEB HT',
    'Forum : FO',
    'Forum : FO EXT',
    'Forum : FO HT',
    'Forum : MV-471',
    'Gardner Denver : Full Open Redline',
    'NOV : Powerlast',
    'Mission : Black Lightning Bonded',
    'Mission : National FKN',
    'Mission : Oilwell FK1',
    'Mission : Oilwell FK2',
    'Mission : Roughneck',
    'Mission : Roughneck Bonded',
    'Mission : Roughneck HP',
    'Mission : Roughneck HP WL',
    'Mission : Roughneck WL',
    'Mission : Service Master',
    'Mission : Supreme',
    'Mission : Supreme WL',
    'Mission : White Lightning Bonded',
    'Mud King : Full Open',
    'Mud King : Full Open Mod.',
    'Premium : 4-WEB Caliber',
    'Premium : HD',
    'Premium : VXT',
    'Premium : XV400',
    'Premium : XV200E',
    'Premium : XV HT',
    'Premium : XV400 HT',
    'Premium : XTA',
    'Southwest : 3-WEB',
    'Southwest : 4-WEB',
    'Southwest : 4-WEB HT',
    'Southwest : Full Open',
    'Southwest : Full Open HT',
    'Southwest : Full Open MOD',
  ]),
  Liners: opts([
    'Forum : Ceramic',
    'Forum : Iron/Chrome',
    'Mission : Ceramic',
    'Mission : Iron/Chrome',
    'Mission : Zirconia',
    'Mud King : Ceramic',
    'Mud King : Iron/Chrome',
    'Premium : Ceramic',
    'Premium : Iron/Chrome',
    'Southwest : Ceramic',
    'Southwest : Iron',
    'NOV FB1600 : Zirconia',
    'NOV 12P160 : Zirconia',
  ]),
};
// Purpose = Inspection
const INSPECTION_COMPONENTS = opts(triple('Module'));
// Liner sizes in inches; values are numbers
const LINER_SIZES = [4.5, 4.75, 5, 5.25, 5.5, 6, 6.25, 6.5, 6.75, 7].map((n) => ({
  label: String(n),
  value: n,
}));
// Server response codes for logbook submits (204-213 are 2xx, so check them before response.ok)
const LOGBOOK_RESPONSE_MESSAGES = {
  204: 'Please add Liner and Head/Swab Hours.',
  205: 'Comment missing. Please resubmit.',
  206: 'Please select a component to change.',
  207: 'Please select alarm status.',
  210: 'Please select liner material.',
  211: 'Please select gasket type.',
  212: 'Please select liner size.',
  213: 'Liner size mismatch: Correct liner entry to match sizes of installed liners or change all three liners in one entry to correct size.',
  305: 'Missing Brand Name. Please resubmit.',
};
const MUD_TYPES = opts([
  'Water-based mud',
  'Brine-based mud',
  'Oil-based mud',
  'Synthetic oil-based mud',
  'Aerated fluid',
]);

/**
 * Get the mud units for a rig; rig 95 reports mud weight in pcf
 * @param {string | number} [rig] - rig number
 * @returns {{ mudWeight: string, mudTemperature: string }} unit labels
 */
function getMudUnits(rig) {
  return {
    mudWeight: String(rig) === '95' ? 'pcf' : 'ppg',
    mudTemperature: 'ºF',
  };
}

/**
 * Turn a list of strings into options whose label equals the value
 * @param {string[]} list - option values
 * @returns {Option[]} options
 */
function opts(list) {
  return list.map((v) => ({ label: v, value: v }));
}

/**
 * Build the three numbered names of a pump part, e.g. "Liner" -> Liner 1, Liner 2, Liner 3
 * @param {string} base - part name
 * @returns {string[]} numbered names
 */
function triple(base) {
  return [1, 2, 3].map((n) => `${base} ${n}`);
}

export {
  ALARM_PLACEHOLDER,
  ALARM_STATUS,
  BRAND_CATEGORIES,
  COMPONENT_GROUPS,
  COMPONENT_OPTIONS,
  FALLBACK_BRANDS,
  INSPECTION_COMPONENTS,
  LINER_SIZES,
  LOGBOOK_RESPONSE_MESSAGES,
  MUD_TYPES,
  getMudUnits,
};
