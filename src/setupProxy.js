/**
 * setupProxy.js
 *
 * Local development only (`npm start`): sends the Designer paths to the Designer host, so the
 * browser sees one origin and needs no CORS, like the load balancer in production
 * (MOBILE_WEB_APP_AUTH0.md section 4.3a).
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
const { createProxyMiddleware } = require('http-proxy-middleware');

// Constants
const DESIGNER_HOST = process.env.DESIGNER_PROXY_TARGET || 'https://designer3.prescientdevices.com';
// Base path of each Designer (MD section 4.2)
const DESIGNER_PATHS = [
  'kenmartin-p52b9e7',
  'dummy123-pff96d0',
  'genset-p9fb592',
  'mudsystems-p3bc764',
  'catwalk-p2db16d',
  'null10-p74d944',
  'null1-pec9f7e',
  'precisionRuleEngine-p64c1a8',
  'rwhitney-pc1f13f',
];

module.exports = function setupProxy(app) {
  app.use(
    createProxyMiddleware(
      DESIGNER_PATHS.map((path) => `/${path}/api/private/`),
      { target: DESIGNER_HOST, changeOrigin: true, secure: true, logLevel: 'warn' }
    )
  );
};
