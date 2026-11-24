/**
 * useBrandLists.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useEffect, useState } from 'react';
// Prescient Devices imports
import { BRAND_CATEGORIES, FALLBACK_BRANDS } from './logbookOptions';

/**
 * @typedef {object} BrandApiConfig
 * @property {string} apiBase - API base URL
 * @property {string} userToken - signed-in user token
 * @property {string} digitalTwinID - pump digital twin id
 * @property {string | number} rig - rig number
 * @property {string} authToken - value of the `authentication` header (never hard-code it)
 */

/**
 * Get the brand / liner-type options, fetched once per screen load by category:
 *   GET {apiBase}/api/private/pump/logbook/brandlist?userToken&digitalTwinID&rig&component={category}
 * Starts with the fallback lists and only calls the API when every config value is provided.
 * A failed or empty response keeps that category's fallback list.
 * @param {BrandApiConfig} [apiConfig] - API settings from login/config
 * @returns {Object<string, import('./logbookOptions').Option[]>} options per category
 */
function useBrandLists(apiConfig) {
  const [lists, setLists] = useState(FALLBACK_BRANDS);
  const { apiBase, userToken, digitalTwinID, rig, authToken } = apiConfig || {};
  useEffect(() => {
    if (!apiBase || !userToken || !digitalTwinID || !rig || !authToken) return undefined;
    let cancelled = false;
    BRAND_CATEGORIES.forEach(async (category) => {
      try {
        const params = new URLSearchParams({ userToken, digitalTwinID, rig, component: category });
        const response = await fetch(`${apiBase}/api/private/pump/logbook/brandlist?${params}`, {
          headers: { authentication: authToken },
        });
        if (!response.ok) return;
        const data = await response.json();
        const options = Array.isArray(data)
          ? data.filter((item) => item?.brand).map((item) => ({ label: item.brand, value: item.brand }))
          : [];
        if (!cancelled && options.length) {
          setLists((prev) => ({ ...prev, [category]: options }));
        }
      } catch {
        // Offline or API error: keep the fallback list for this category
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiBase, userToken, digitalTwinID, rig, authToken]);
  return lists;
}

export { useBrandLists };
