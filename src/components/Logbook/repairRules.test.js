/**
 * repairRules.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { COMPONENT_OPTIONS } from './logbookOptions';
import {
  REPAIR_FIELDS,
  applyRepairResets,
  getRepairDefaults,
  isRepairFieldVisible,
  toRepairSubmitBody,
  validateRepair,
} from './repairRules';

const repair = (overrides = {}) => ({ ...getRepairDefaults(), purpose: 'Repair', ...overrides });
const visibleIds = (values) => REPAIR_FIELDS.filter((f) => isRepairFieldVisible(f.id, values)).map((f) => f.id);
const BASE = [
  'componentChanged',
  'mudType',
  'mudWeight',
  'lgsContent',
  'mudTemp',
  'oilFilterChanged',
  'KCF',
  'comments',
];

test('lists all 68 components, with Oil Change submitting "Oil change"', () => {
  expect(COMPONENT_OPTIONS).toHaveLength(68);
  expect(COMPONENT_OPTIONS).toContainEqual({ label: 'Oil Change', value: 'Oil change' });
});

test('Repair always shows the base fields in render order', () => {
  expect(visibleIds(repair())).toEqual(BASE);
});

test('Head/Swab 1 reveals its brand, Re-Use Liners and the inspected trio', () => {
  expect(visibleIds(repair({ componentChanged: ['Head/Swab 1'] }))).toEqual([
    'componentChanged',
    'Piston_1_brand',
    'reUseLiners',
    'wearplateInspected',
    'pistonInspected',
    'linerInspected',
    'mudType',
    'mudWeight',
    'lgsContent',
    'mudTemp',
    'oilFilterChanged',
    'KCF',
    'comments',
  ]);
});

test('Liner 2: type, then Liner Size once a type is chosen, hours only with Re-Use = Yes', () => {
  const values = repair({ componentChanged: ['Liner 2'] });
  expect(isRepairFieldVisible('Liner_2_brand', values)).toBe(true);
  expect(isRepairFieldVisible('linerSize', values)).toBe(false);
  expect(isRepairFieldVisible('liner2Hours', values)).toBe(false);
  const typed = { ...values, Liner_2_brand: 'Forum : Ceramic' };
  expect(isRepairFieldVisible('linerSize', typed)).toBe(true);
  expect(isRepairFieldVisible('liner2Hours', { ...typed, reUseLiners: 'Yes' })).toBe(true);
});

test('valves, seats and gaskets reveal the right questions', () => {
  const valve = visibleIds(repair({ componentChanged: ['Disch. Valve 3'] }));
  expect(valve).toEqual(expect.arrayContaining(['Disch_Valve_3_brand', 'seatInspected', 'moduleInspected']));
  expect(valve).not.toContain('valveInspected');
  const seat = visibleIds(repair({ componentChanged: ['Suction Seat 1'] }));
  expect(seat).toEqual(expect.arrayContaining(['Suction_Seat_1_brand', 'moduleInspected', 'valveInspected']));
  expect(seat).not.toContain('seatInspected');
  expect(visibleIds(repair({ componentChanged: ['Valve Insert 2'] }))).toEqual(
    expect.arrayContaining(['seatInspected', 'moduleInspected'])
  );
  expect(visibleIds(repair({ componentChanged: ['Cap Gasket 1'] }))).toContain('numberofGaskets');
  expect(visibleIds(repair({ componentChanged: ['Oil change'] }))).toEqual(BASE);
});

test('shared fields appear once and order ignores selection order', () => {
  const ids = visibleIds(repair({ componentChanged: ['Disch. Valve 1', 'Head/Swab 1', 'Liner 1'] }));
  expect(ids.filter((id) => id === 'reUseLiners')).toHaveLength(1);
  expect(ids.indexOf('Piston_1_brand')).toBeLessThan(ids.indexOf('Disch_Valve_1_brand'));
  expect(ids.indexOf('Disch_Valve_1_brand')).toBeLessThan(ids.indexOf('Liner_1_brand'));
});

test('nothing Repair-specific is visible for other purposes', () => {
  const inspection = { ...repair({ componentChanged: ['Liner 1'] }), purpose: 'Inspection' };
  expect(visibleIds(inspection)).toEqual(['comments']);
});

test('removing a component clears its brand, hours and (last liner) the liner size', () => {
  const prev = repair({
    componentChanged: ['Liner 1', 'Head/Swab 2'],
    Liner_1_brand: 'Forum : Ceramic',
    liner1Hours: 120,
    linerSize: '6.5',
  });
  const next = { ...prev, componentChanged: ['Head/Swab 2'] };
  expect(applyRepairResets(prev, next)).toEqual({ Liner_1_brand: '', liner1Hours: 0, linerSize: '' });
});

test('Re-Use = No clears all hours; leaving Repair resets but keeps comments for Inspection', () => {
  const prev = repair({ reUseLiners: 'Yes', liner1Hours: 50, piston3Hours: 20 });
  const patch = applyRepairResets(prev, { ...prev, reUseLiners: 'No' });
  expect(patch).toMatchObject({ liner1Hours: 0, piston3Hours: 0, liner2Hours: 0 });
  const leaving = applyRepairResets(repair({ componentChanged: ['Liner 1'], comments: 'note' }), {
    purpose: 'Inspection',
  });
  expect(leaving.componentChanged).toEqual([]);
  expect(leaving).not.toHaveProperty('comments');
});

test('submit body has only the visible keys, with backend types', () => {
  const body = toRepairSubmitBody({
    componentChanged: ['Liner 1'],
    Liner_1_brand: 'Forum : Ceramic',
    linerSize: '6.5',
    reUseLiners: 'Yes',
    liner1Hours: '120',
    liner2Hours: '50',
    mudWeight: '10.2',
    KCF: 'No Alarm',
    comments: ' note ',
  });
  expect(body).toEqual({
    componentChanged: ['Liner 1'],
    Liner_1_brand: 'Forum : Ceramic',
    linerSize: 6.5,
    reUseLiners: 'Yes',
    liner1Hours: 120,
    wearplateInspected: 'Yes',
    pistonInspected: 'No',
    linerInspected: 'No',
    mudType: '',
    mudWeight: 10.2,
    lgsContent: 0,
    mudTemp: 0,
    oilFilterChanged: 'No',
    KCF: 'No Alarm',
    comments: 'note',
  });
});

test('client-side validation matches the server codes', () => {
  expect(validateRepair(repair())?.code).toBe(206);
  expect(validateRepair(repair({ componentChanged: ['Liner 1'] }))?.code).toBe(207);
  expect(validateRepair(repair({ componentChanged: ['Liner 1'], KCF: 'Alarm' }))?.code).toBe(305);
  const typed = repair({ componentChanged: ['Liner 1'], KCF: 'Alarm', Liner_1_brand: 'Forum : Ceramic' });
  expect(validateRepair(typed)?.code).toBe(212);
  expect(validateRepair({ ...typed, linerSize: '6', reUseLiners: 'Yes' })?.code).toBe(204);
  const complete = { ...typed, linerSize: '6', reUseLiners: 'Yes', liner1Hours: '10' };
  expect(validateRepair(complete)?.code).toBe(205);
  expect(validateRepair({ ...complete, comments: 'Liner 1 replaced' })).toBeNull();
});
