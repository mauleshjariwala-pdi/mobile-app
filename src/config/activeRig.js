/**
 * activeRig.js
 *
 * The rig the app works on: picked on the first-time page or in Settings → Switch Rigs, and
 * remembered on this device.
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
// Prescient Devices imports
import { fetchRigsByCountry } from '../api/rigApi';

// Constants
const STORAGE_KEY = 'activeRig';
// Rigs offered when the user's token does not list them (e.g. "001,575,875")
const CONFIGURED_RIGS = (process.env.REACT_APP_RIGS || '')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

const listeners = new Set();
// Rigs read from /rigs/bycountry for users whose token gives countries but no rigs, per country list
const countryRigsCache = new Map();
// Empty until the user picks a rig: the first-time page asks for one
let activeRig = readStoredRig();

/**
 * Read the rig saved on this device
 * @returns {string} saved rig, or an empty string
 */
function readStoredRig() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Get the rig the app works on
 * @returns {string} active rig
 */
function getActiveRig() {
  return activeRig;
}

/**
 * Switch the whole app to another rig and remember it on this device
 * @param {string} rig - rig number
 * @returns {void}
 */
function setActiveRig(rig) {
  if (!rig || rig === activeRig) return;
  activeRig = rig;
  try {
    localStorage.setItem(STORAGE_KEY, rig);
  } catch {
    // Storage unavailable (e.g. private mode): the rig still changes for this session
  }
  listeners.forEach((listener) => listener());
}

/**
 * Rigs the access token limits the user to. Null only when the token does not limit rigs: no
 * rig_access claim or every rig (`all`). Access by country alone names no rig and gives an empty
 * list: those rigs are read from the API (see getTokenCountries).
 * @param {import('../auth/auth').SessionUser | null} [user] - signed-in user
 * @returns {string[] | null} allowed rig numbers
 */
function getTokenRigs(user) {
  const access = user?.rigAccess;
  if (!access || access.all) return null;
  return (Array.isArray(access.rigs) ? access.rigs : []).map(String);
}

/**
 * Countries whose rigs the user may see, when the token names countries but no rig. Their rigs come
 * from GET /rigs/bycountry
 * @param {import('../auth/auth').SessionUser | null} [user] - signed-in user
 * @returns {string[] | null} country codes (upper case), or null when the rigs are not read by country
 */
function getTokenCountries(user) {
  const tokenRigs = getTokenRigs(user);
  if (!tokenRigs || tokenRigs.length > 0) return null;
  const countries = user.rigAccess.countries;
  if (!Array.isArray(countries) || countries.length === 0) return null;
  return [...new Set(countries.map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
}

/**
 * True when the user's token gives them at least one rig, or countries to read rigs from. Without
 * either, every Designer call answers 403, so the app shows a "no rig access" page instead
 * @param {import('../auth/auth').SessionUser | null} user - signed-in user
 * @returns {boolean} false when rig_access names no rig and no country
 */
function hasRigAccess(user) {
  const tokenRigs = getTokenRigs(user);
  return tokenRigs === null || tokenRigs.length > 0 || Boolean(getTokenCountries(user));
}

/**
 * Rigs the user can switch to, without waiting. When the access token lists rigs, only those: any
 * other rig answers 403. With countries only, the rigs already read from the API (empty before
 * loadAvailableRigs). Otherwise REACT_APP_RIGS, with the active rig included.
 * @param {import('../auth/auth').SessionUser | null} [user] - signed-in user
 * @returns {string[]} rig numbers, in order
 */
function getAvailableRigs(user) {
  const countries = getTokenCountries(user);
  if (countries) {
    const cached = countryRigsCache.get(countries.join(','));
    return cached?.rigs ?? [];
  }
  const tokenRigs = getTokenRigs(user);
  if (tokenRigs) return tokenRigs;
  return activeRig && !CONFIGURED_RIGS.includes(activeRig) ? [activeRig, ...CONFIGURED_RIGS] : CONFIGURED_RIGS;
}

/**
 * Rigs the user can switch to. With countries only, reads each country's rigs from the API once
 * (GET /rigs/bycountry); a failed read is tried again on the next call
 * @param {import('../auth/auth').SessionUser | null} [user] - signed-in user
 * @returns {Promise<string[]>} rig numbers, sorted
 * @throws {import('../api/rigApi').RigApiError} when the rigs of a country cannot be read
 */
function loadAvailableRigs(user) {
  const countries = getTokenCountries(user);
  if (!countries) return Promise.resolve(getAvailableRigs(user));
  const key = countries.join(',');
  let entry = countryRigsCache.get(key);
  if (!entry) {
    entry = {
      rigs: null,
      promise: Promise.all(countries.map((country) => fetchRigsByCountry(country))).then((lists) => {
        const rigs = [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        entry.rigs = rigs;
        return rigs;
      }),
    };
    countryRigsCache.set(key, entry);
    entry.promise.catch(() => countryRigsCache.delete(key));
  }
  return entry.promise;
}

/**
 * After sign-in: when the active rig is not one the user may see, drop it so they pick again, and
 * take the only rig when there is just one. Rigs by country are read from the API first; when that
 * read fails the active rig is kept and the rig picker shows the error
 * @param {import('../auth/auth').SessionUser | null} user - signed-in user
 * @returns {Promise<void>} resolves when the active rig is checked
 */
async function ensureAllowedRig(user) {
  let rigs;
  try {
    rigs = await loadAvailableRigs(user);
  } catch {
    return;
  }
  const isRestricted = getTokenRigs(user) !== null;
  // A rig the user may no longer see is dropped, so they pick again
  if (activeRig && isRestricted && !rigs.includes(activeRig)) clearActiveRig();
  // Nothing to choose between: take the only rig
  if (!activeRig && rigs.length === 1) setActiveRig(rigs[0]);
}

/**
 * Read the rigs the user can switch to in a component, loading rigs by country when needed
 * @param {import('../auth/auth').SessionUser | null} user - signed-in user
 * @returns {{ rigs: string[], status: 'loading' | 'ready' | 'error', error: string, reload: () => void }}
 *   rigs and load state
 */
function useAvailableRigs(user) {
  const [state, setState] = useState(() => {
    const isByCountry = Boolean(getTokenCountries(user));
    const rigs = getAvailableRigs(user);
    const isLoaded = !isByCountry || countryRigsCache.get(getTokenCountries(user).join(','))?.rigs;
    return { rigs, status: isLoaded ? 'ready' : 'loading', error: '' };
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // Rigs from the token or REACT_APP_RIGS are known at once: no request, no waiting
    if (!getTokenCountries(user)) {
      setState({ rigs: getAvailableRigs(user), status: 'ready', error: '' });
      return undefined;
    }
    let isActive = true;
    loadAvailableRigs(user)
      .then((rigs) => isActive && setState({ rigs, status: 'ready', error: '' }))
      .catch(
        (error) =>
          isActive && setState({ rigs: [], status: 'error', error: error.message || 'Unable to load your rigs.' })
      );
    return () => {
      isActive = false;
    };
  }, [user, attempt]);
  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading', error: '' }));
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, reload };
}

/**
 * Forget the picked rig on this device, e.g. when the user lost access to it
 * @returns {void}
 */
function clearActiveRig() {
  activeRig = '';
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing was saved
  }
  listeners.forEach((listener) => listener());
}

/**
 * Be told when the active rig changes
 * @param {() => void} listener - called after each change
 * @returns {() => void} removes the listener
 */
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Read the active rig in a component; re-renders when it changes
 * @returns {string} active rig
 */
function useActiveRig() {
  return useSyncExternalStore(subscribe, getActiveRig);
}

export { clearActiveRig, ensureAllowedRig, getActiveRig, hasRigAccess, setActiveRig, useActiveRig, useAvailableRigs };
