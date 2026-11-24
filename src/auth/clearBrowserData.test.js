/**
 * clearBrowserData.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { clearBrowserData } from './clearBrowserData';

test('removes every localStorage, sessionStorage and cookie value', () => {
  localStorage.setItem('activeRig', '575');
  localStorage.setItem('@@auth0spajs@@::client', '{}');
  sessionStorage.setItem('state', 'x');
  document.cookie = 'a=1; path=/';
  document.cookie = 'auth0.client.is.authenticated=true; path=/';
  clearBrowserData();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
  expect(document.cookie).toBe('');
});

test('does nothing harmful when there is nothing to clear', () => {
  expect(() => clearBrowserData()).not.toThrow();
});
