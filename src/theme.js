/**
 * theme.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Constants
const STORAGE_KEY = 'theme';

/**
 * Apply a theme to the page and remember it
 * @param {'light' | 'dark'} theme - theme to apply
 * @returns {void}
 */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (e.g. private mode): the theme still applies for this session
  }
}

/**
 * Read the saved theme, defaulting to light
 * @returns {'light' | 'dark'} saved theme
 */
function getInitialTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export { applyTheme, getInitialTheme };
