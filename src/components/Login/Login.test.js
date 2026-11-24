/**
 * Login.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { render, screen } from '@testing-library/react';
// Prescient Devices imports
import Login from './Login';

test('shows progress while the session is checked and while Auth0 opens; no form', () => {
  const { rerender } = render(<Login status="loading" />);
  expect(screen.getByRole('status')).toHaveTextContent('Checking your session…');
  rerender(<Login status="redirecting" />);
  expect(screen.getByRole('status')).toHaveTextContent('Opening sign-in…');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('shows why sign-in cannot run', () => {
  render(<Login status="unavailable" error="Sign-in needs HTTPS. Open the app over https://." />);
  expect(screen.getByRole('alert')).toHaveTextContent('Sign-in needs HTTPS. Open the app over https://.');
});
