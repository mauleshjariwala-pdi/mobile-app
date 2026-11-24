/**
 * authConfig.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

/**
 * @typedef {object} AuthConfig
 * @property {string} domain - Auth0 tenant domain
 * @property {string} clientId - Auth0 Single Page Application client id, given by PDI
 * @property {string} audience - API audience; without it the Designers refuse the token
 * @property {string} scope - offline_access gives the refresh token
 * @property {string} redirectUri - callback URL registered on the Auth0 application
 * @property {string} claimNamespace - prefix of the custom claims in the access token
 */

// Constants
const DEFAULT_DOMAIN = 'prescient-pd.us.auth0.com';
const DEFAULT_AUDIENCE = 'https://precision-designers.prescientdevices.com';
// Auth0 application "Precision Mobile" (Single Page Application). Public: a SPA has no secret
const DEFAULT_CLIENT_ID = 'kBoBLOeTW912VoZu60U22hSiHohTNh8x';

/** @type {AuthConfig} */
const AUTH_CONFIG = Object.freeze({
  domain: process.env.REACT_APP_AUTH0_DOMAIN || DEFAULT_DOMAIN,
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID || DEFAULT_CLIENT_ID,
  audience: process.env.REACT_APP_AUTH0_AUDIENCE || DEFAULT_AUDIENCE,
  scope: 'openid profile email offline_access',
  redirectUri: `${window.location.origin}/callback`,
  claimNamespace: `${process.env.REACT_APP_AUTH0_AUDIENCE || DEFAULT_AUDIENCE}/`,
});

export { AUTH_CONFIG };
