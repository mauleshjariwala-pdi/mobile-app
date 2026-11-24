/**
 * useLogbookHistory.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useCallback, useEffect, useState } from 'react';
// Prescient Devices imports
import { fetchLogbookEntries } from '../../api/logbookApi';
import { APP_CONFIG } from '../../config/appConfig';
import { toHistoryEntry } from './historyData';

/**
 * @typedef {object} LogbookHistoryState
 * @property {'loading' | 'success' | 'error'} status - request state
 * @property {import('./historyData').HistoryEntry[]} entries - entries, newest first
 * @property {string} error - message when every pump failed
 * @property {string[]} failedPumps - pumps that could not be loaded while others succeeded
 * @property {() => void} reload - fetches the entries again
 */

// Constants
// The logbook API returns 401 when `to` minus `from` is longer than 14 days
const HISTORY_RANGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Check that an API record is a real entry; an empty result comes back as
 * [{ componentChanged: 'No Data Available' }]
 * @param {import('../../api/logbookApi').LogbookRecord} record - logbook record
 * @returns {boolean} true for a valid logbook entry
 */
function isRealEntry(record) {
  return Boolean(record.purpose) && Number.isFinite(Number(record.dateOfRepair)) && record.valid !== 0;
}

/**
 * Load the last 14 days of logbook history for every configured mud pump
 * @returns {LogbookHistoryState} history state
 */
function useLogbookHistory() {
  const [state, setState] = useState({ status: 'loading', entries: [], error: '', failedPumps: [] });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const to = new Date();
    const from = new Date(to.getTime() - HISTORY_RANGE_MS);
    setState((prev) => ({ ...prev, status: 'loading', error: '' }));
    Promise.allSettled(
      APP_CONFIG.mudPumps.map((mudpump) => fetchLogbookEntries({ mudpump, from, to, signal: controller.signal }))
    ).then((results) => {
      if (controller.signal.aborted) return;
      const failedPumps = APP_CONFIG.mudPumps.filter((_, i) => results[i].status === 'rejected');
      if (failedPumps.length === APP_CONFIG.mudPumps.length) {
        setState({
          status: 'error',
          entries: [],
          error: results[0].reason?.message || 'Failed to load history.',
          failedPumps: [],
        });
        return;
      }
      const entries = results
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) => r.value)
        .filter(isRealEntry)
        .map(toHistoryEntry)
        .sort((a, b) => b.dateTime - a.dateTime);
      setState({ status: 'success', entries, error: '', failedPumps });
    });
    return () => controller.abort();
  }, [attempt]);
  return { ...state, reload };
}

export { useLogbookHistory };
