/**
 * useRigLayout.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useCallback, useEffect, useState } from 'react';
// Prescient Devices imports
import { getLayoutPumps } from '../../api/rigApi';
import { FINAL_ERRORS, readCachedLayout, refreshRigLayout } from '../../api/rigLayoutCache';

/**
 * @typedef {object} RigLayoutState
 * @property {'loading' | 'ready' | 'error'} status - load state
 * @property {import('../../api/rigApi').RigLayout | null} layout - rig layout once loaded
 * @property {string[]} pumps - mud pump numbers of the rig; empty when it has none
 * @property {string} error - why the layout could not be loaded
 * @property {() => void} reload - loads the layout again
 */

/**
 * Initial state of a rig: its saved layout when there is one, so the page shows at once
 * @param {string} rig - rig number or name
 * @returns {{ status: string, layout: object | null, error: string }} state
 */
function initialState(rig) {
  const cached = readCachedLayout(rig);
  return cached
    ? { status: 'ready', layout: cached.layout, error: '' }
    : { status: 'loading', layout: null, error: '' };
}

/**
 * Get the equipment layout of a rig and its mud pumps. The layout saved in localStorage shows at once
 * and is refreshed from GET /rig/layout in the background; only without a saved layout does the page
 * wait for the API. Reloads when the rig changes
 * @param {string} rig - rig number or name
 * @returns {RigLayoutState} layout and load state
 */
function useRigLayout(rig) {
  const [state, setState] = useState(() => initialState(rig));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!rig) {
      setState({ status: 'error', layout: null, error: 'No rig is selected.' });
      return undefined;
    }
    let isActive = true;
    const hasCached = Boolean(readCachedLayout(rig));
    setState(initialState(rig));
    refreshRigLayout(rig)
      .then((layout) => isActive && setState({ status: 'ready', layout, error: '' }))
      .catch((error) => {
        if (!isActive) return;
        // A connection problem keeps the saved layout; no access or no such rig does not
        if (hasCached && !FINAL_ERRORS.includes(error.status)) return;
        setState({ status: 'error', layout: null, error: error.message || 'Unable to load the rig equipment.' });
      });
    return () => {
      isActive = false;
    };
  }, [rig, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, pumps: getLayoutPumps(state.layout), reload };
}

export { useRigLayout };
