/**
 * designerFetch.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { getSessionUser, getToken } from '../auth/auth';
import { APP_CONFIG } from '../config/appConfig';

// Constants
// 403: the token is good, but the user has no access to that rig. Not retried (MD section 5)
const NO_RIG_ACCESS_MESSAGE = 'You have no access to this rig.';

/**
 * Call a Precision Designer API with the user's access token (MOBILE_WEB_APP_AUTH0.md section 4).
 * Sends `Authorization: Bearer <access token>` once and no cookies. On a 401 it gets a new token and
 * tries once more. The caller reads the status, so 403 ("no access to this rig") is not retried.
 * @param {string} url - request URL; use a same-origin path such as /rwhitney-pc1f13f/api/private/...
 * @param {RequestInit} [init] - fetch options
 * @returns {Promise<Response>} response
 * @throws {import('../auth/auth').AuthError} when no token can be had (the session has ended)
 * @throws {TypeError} when the request does not reach the server
 */
async function designerFetch(url, init = {}) {
  const send = async (token) => {
    // With a token, send only the token (MD 4.3). The legacy key is for the development bypass only
    const { authentication, ...headers } = init.headers ?? {};
    return fetch(url, {
      ...init,
      headers: token ? { ...headers, Authorization: `Bearer ${token}` } : init.headers,
      credentials: 'omit',
    });
  };
  const token = await getToken();
  const response = await send(token);
  if (response.status !== 401 || !token) return response;
  // The token was refused: skip the cache once. An ended session makes getToken() throw
  return send(await getToken({ forceRefresh: true }));
}

/**
 * Headers for a Designer service. The legacy `authentication` key is sent only when one is set,
 * until PDI opens every route to user tokens (MD section 6)
 * @param {import('../config/appConfig').ServiceConfig} service - service settings
 * @param {Record<string, string>} [headers] - other headers
 * @returns {Record<string, string>} headers
 */
function serviceHeaders(service, headers = {}) {
  return service.authKey ? { authentication: service.authKey, ...headers } : headers;
}

/**
 * User details sent with writes: the signed-in user, or the static values from .env before sign-in
 * @returns {{ login: string, userId: string, email: string }} user details
 */
function getRequestUser() {
  const user = getSessionUser();
  if (!user) return APP_CONFIG.user;
  return {
    login: user.login || APP_CONFIG.user.login,
    userId: APP_CONFIG.user.userId || user.id,
    email: user.email || APP_CONFIG.user.email,
  };
}

/**
 * Message for a request that never got an answer
 * @param {Error} error - error thrown by designerFetch
 * @param {string} fallback - message when the server could not be reached
 * @returns {string} message for the user
 */
function requestErrorMessage(error, fallback) {
  // An ended session or missing sign-in set-up has its own message
  return error?.name === 'AuthError' ? error.message : fallback;
}

export { NO_RIG_ACCESS_MESSAGE, designerFetch, getRequestUser, requestErrorMessage, serviceHeaders };
