/**
 * start.js
 *
 * Runs the react-scripts development server with three known deprecation warnings hidden. They
 * come from react-scripts 5 itself (fs.F_OK in react-dev-utils and the old webpack-dev-server
 * middleware options), not from this app, and react-scripts is no longer updated. Every other
 * warning still shows.
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Constants
const HIDDEN_WARNINGS = new Set([
  'DEP0176',
  'DEP_WEBPACK_DEV_SERVER_ON_AFTER_SETUP_MIDDLEWARE',
  'DEP_WEBPACK_DEV_SERVER_ON_BEFORE_SETUP_MIDDLEWARE',
]);

const emitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...args) => {
  // emitWarning(warning, type, code) or emitWarning(warning, { type, code })
  const code = typeof args[0] === 'object' && args[0] !== null ? args[0].code : args[1];
  if (HIDDEN_WARNINGS.has(code)) return;
  emitWarning(warning, ...args);
};

// Runs in this process, so the filter above applies
require('react-scripts/scripts/start');
