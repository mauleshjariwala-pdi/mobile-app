/**
 * index.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import React from 'react';
import ReactDOM from 'react-dom/client';
// Roboto, served from the app itself (the CSP allows fonts from 'self' only); variable weights 100-900
import '@fontsource-variable/roboto';
// Prescient Devices imports
import App from './App';
import './index.css';
import './theme.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
