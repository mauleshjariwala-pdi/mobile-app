/**
 * clearBrowserData.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Constants
// Kept across sign-out: the device id belongs to the device, not the user (push alarms), so the
// next user registers the same device instead of filling the server with new ids
const KEPT_KEYS = ['pushDeviceId'];

/**
 * Remove everything the app keeps in the browser for this site: localStorage (tokens, active rig,
 * theme, push "registered" flag), sessionStorage and the cookies JavaScript can see. Used on
 * sign-out, so the next user of the device starts clean. Only the device id (KEPT_KEYS) stays.
 * HttpOnly cookies are set by the server and only it can remove them.
 * @returns {void}
 */
function clearBrowserData() {
  try {
    const kept = KEPT_KEYS.map((key) => [key, localStorage.getItem(key)]).filter(([, value]) => value !== null);
    localStorage.clear();
    kept.forEach(([key, value]) => localStorage.setItem(key, value));
  } catch {
    // Storage unavailable (e.g. private mode): nothing was saved
  }
  try {
    sessionStorage.clear();
  } catch {
    // Storage unavailable: nothing was saved
  }
  clearCookies();
}

/**
 * Expire every cookie visible to the page. A cookie is removed only with the path and domain it
 * was set with, which the browser does not tell, so each is expired for the likely paths and for the
 * host and its parent domains (e.g. app.example.com and .example.com)
 * @returns {void}
 */
function clearCookies() {
  if (typeof document === 'undefined' || !document.cookie) return;
  const names = document.cookie
    .split(';')
    .map((part) => part.split('=')[0].trim())
    .filter(Boolean);
  const hostParts = window.location.hostname.split('.');
  // undefined: no Domain attribute (host-only cookie)
  const domains = [undefined, ...hostParts.map((_, i) => hostParts.slice(i).join('.')).filter((d) => d.includes('.'))];
  const segments = window.location.pathname.split('/').filter(Boolean);
  const paths = ['/', ...segments.map((_, i) => `/${segments.slice(0, i + 1).join('/')}`)];
  names.forEach((name) => {
    domains.forEach((domain) => {
      paths.forEach((path) => {
        const domainPart = domain ? `; domain=${domain}` : '';
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${path}${domainPart}`;
      });
    });
  });
}

export { clearBrowserData };
