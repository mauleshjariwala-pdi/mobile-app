/**
 * appConfig.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

/**
 * @typedef {object} ServiceConfig
 * @property {string} baseUrl - Designer instance URL, without a trailing slash
 * @property {string} authKey - value of the `authentication` header for this instance
 *
 * @typedef {object} UserConfig
 * @property {string} login - login name, stored by the logbook as `username`
 * @property {string} userId - numeric user id
 * @property {string} email - e-mail address
 *
 * @typedef {object} AppConfig
 * @property {string} digitalTwinID - digital twin the rig belongs to
 * @property {string} userToken - session token of the user
 * @property {UserConfig} user - signed-in user, sent with new logbook entries
 * @property {string[]} mudPumps - mud pump numbers on the rig
 * @property {ServiceConfig} logbook - Pump Logbook service
 * @property {ServiceConfig} ruleEngine - Smart Alert (Rule Engine) service
 */

// Constants
// Legacy service keys work in development only. Production calls use the Auth0 token, and with the
// check written at each read the minifier drops the keys, so they never ship to browsers
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Base path of each Designer open to the app; keep them in this one place (MD section 6)
const DESIGNER_PATHS = Object.freeze({
  api: '/rwhitney-pc1f13f', // pump logbook, tickets
  rules: '/precisionRuleEngine-p64c1a8', // smart alerts
});

// Pumps and digital twin come from .env.local (git-ignored). The rig is picked in the app (activeRig.js)
/** @type {AppConfig} */
const APP_CONFIG = Object.freeze({
  digitalTwinID: process.env.REACT_APP_DIGITAL_TWIN_ID || '',
  userToken: process.env.REACT_APP_USER_TOKEN || '',
  user: Object.freeze({
    login: process.env.REACT_APP_USER_LOGIN || '',
    userId: process.env.REACT_APP_USER_ID || '',
    email: process.env.REACT_APP_USER_EMAIL || '',
  }),
  mudPumps: (process.env.REACT_APP_MUD_PUMPS || '1')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  // Designer paths on the app's own host (MOBILE_WEB_APP_AUTH0.md section 4.2); the load balancer,
  // or setupProxy.js under `npm start`, sends them to the Designers
  logbook: Object.freeze({
    baseUrl: trimTrailingSlash(process.env.REACT_APP_LOGBOOK_BASE_URL || DESIGNER_PATHS.api),
    authKey: IS_PRODUCTION ? '' : process.env.REACT_APP_LOGBOOK_AUTH_KEY || '',
  }),
  ruleEngine: Object.freeze({
    baseUrl: trimTrailingSlash(process.env.REACT_APP_RULE_ENGINE_BASE_URL || DESIGNER_PATHS.rules),
    authKey: IS_PRODUCTION ? '' : process.env.REACT_APP_RULE_ENGINE_AUTH_KEY || '',
  }),
});

/**
 * Remove trailing slashes so paths can be appended safely
 * @param {string} url - URL
 * @returns {string} URL without trailing slashes
 */
function trimTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

export { APP_CONFIG };
