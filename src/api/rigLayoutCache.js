/**
 * rigLayoutCache.js
 *
 * Rig layouts kept in localStorage, so pages (e.g. the mud pumps of Begin Logbook Entry) show at once
 * without waiting for GET /rig/layout. The cache is refreshed in the background and cleared on sign-out.
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { fetchRigLayout } from './rigApi';

/**
 * @typedef {object} CachedLayout
 * @property {import('./rigApi').RigLayout} layout - rig layout
 * @property {number} savedAt - when it was read from the API (epoch ms)
 */

// Constants
const STORAGE_PREFIX = 'rigLayout:';
// Answers that mean the rig is gone for this user: the saved layout must not be shown any more
const FINAL_ERRORS = [403, 404];
// One request per rig at a time, shared by the start-up prefetch and the page
const pending = new Map();

/**
 * Read the saved layout of a rig
 * @param {string} rig - rig number or name
 * @returns {CachedLayout | null} saved layout, or null when there is none
 */
function readCachedLayout(rig) {
  if (!rig) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + rig));
    return saved?.layout ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Save the layout of a rig
 * @param {string} rig - rig number or name
 * @param {import('./rigApi').RigLayout} layout - rig layout
 * @returns {void}
 */
function writeCachedLayout(rig, layout) {
  try {
    localStorage.setItem(STORAGE_PREFIX + rig, JSON.stringify({ layout, savedAt: Date.now() }));
  } catch {
    // Storage full or unavailable: the layout still shows for this visit
  }
}

/**
 * Forget the saved layout of a rig
 * @param {string} rig - rig number or name
 * @returns {void}
 */
function removeCachedLayout(rig) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + rig);
  } catch {
    // Storage unavailable: nothing was saved
  }
}

/**
 * Read the layout of a rig from the API and save it. A 403 or 404 also removes the saved layout
 * @param {string} rig - rig number or name
 * @returns {Promise<import('./rigApi').RigLayout>} fresh layout
 * @throws {import('./rigApi').RigApiError} when the layout cannot be read
 */
function refreshRigLayout(rig) {
  if (pending.has(rig)) return pending.get(rig);
  const request = fetchRigLayout(rig)
    .then((layout) => {
      writeCachedLayout(rig, layout);
      return layout;
    })
    .catch((error) => {
      if (FINAL_ERRORS.includes(error.status)) removeCachedLayout(rig);
      throw error;
    })
    .finally(() => pending.delete(rig));
  pending.set(rig, request);
  return request;
}

/**
 * Fill the cache in the background, e.g. after sign-in or a rig switch. Errors are ignored here:
 * the page that needs the layout shows them
 * @param {string} rig - rig number or name
 * @returns {void}
 */
function prefetchRigLayout(rig) {
  if (rig) refreshRigLayout(rig).catch(() => {});
}

export { FINAL_ERRORS, prefetchRigLayout, readCachedLayout, refreshRigLayout };
