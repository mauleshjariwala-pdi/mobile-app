/**
 * useSmartAlerts.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useCallback, useEffect, useState } from 'react';
// Prescient Devices imports
import { useActiveRig } from '../../config/activeRig';
import { fetchSmartAlerts } from '../../api/smartAlertApi';
import { toAlertNotification } from './notificationsData';

/**
 * @typedef {object} SmartAlertsState
 * @property {'loading' | 'success' | 'error'} status - request state
 * @property {import('./notificationsData').AlertNotification[]} alerts - unacknowledged and acknowledged alerts
 * @property {string} error - message when the request failed
 * @property {(options?: { silent?: boolean }) => void} reload - fetches the alerts again; a silent
 *   reload keeps the current list on screen instead of showing the skeleton
 */

/**
 * Load the unacknowledged and acknowledged smart alerts of the configured rig.
 * Only the unacknowledged request is required: if the acknowledged one fails the active alerts still show.
 * @returns {SmartAlertsState} alerts state
 */
function useSmartAlerts() {
  // Switching rigs in Settings loads that rig's alerts
  const rig = useActiveRig();
  const [state, setState] = useState({ status: 'loading', alerts: [], error: '' });
  const [request, setRequest] = useState({ attempt: 0, silent: false });
  // Also used directly as an onClick handler, so `options` can be a click event
  const reload = useCallback(
    (options) => setRequest((prev) => ({ attempt: prev.attempt + 1, silent: options?.silent === true })),
    []
  );
  useEffect(() => {
    const controller = new AbortController();
    if (!request.silent) setState((prev) => ({ ...prev, status: 'loading', error: '' }));
    const open = fetchSmartAlerts({ ack: false, signal: controller.signal });
    const acknowledged = fetchSmartAlerts({ ack: true, signal: controller.signal }).catch(() => []);
    Promise.all([open, acknowledged])
      .then(([open, closed]) => {
        if (controller.signal.aborted) return;
        setState({ status: 'success', alerts: [...open, ...closed].map(toAlertNotification), error: '' });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', alerts: [], error: error.message || 'Failed to load notifications.' });
      });
    return () => controller.abort();
    // The request reads the rig itself; it is listed so a switch triggers a new load
  }, [request, rig]);
  return { ...state, reload };
}

export { useSmartAlerts };
