/**
 * setupTests.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
// Adds DOM matchers such as toBeInTheDocument() and toHaveTextContent() to Jest
import '@testing-library/jest-dom';

// Every test runs signed in: no Auth0 redirect, and API calls get a fixed access token.
// auth.test.js tests the real module with jest.requireActual
jest.mock('./auth/auth', () => {
  const user = {
    id: 'auth0|test',
    login: 'jcarter',
    email: 'john.carter@example.com',
    firstName: 'John',
    lastName: 'Carter',
    role: 'Editor',
    permissions: ['read:digital_twin', 'write:digital_twin'],
    rigAccess: { all: true },
  };
  return {
    AuthError: class AuthError extends Error {},
    canWrite: (u) => Boolean(u?.permissions?.includes('write:digital_twin')),
    EXPIRED_MESSAGE: 'Your session has ended. Please sign in again.',
    getSessionUser: jest.fn(),
    getToken: jest.fn(),
    initAuth: jest.fn(),
    onSessionEnded: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    TEST_USER: user,
  };
});

// Set in beforeEach because CRA resets mock implementations before every test
beforeEach(() => {
  const auth = jest.requireMock('./auth/auth');
  auth.getSessionUser.mockReturnValue(null);
  auth.getToken.mockResolvedValue('test-access-token');
  auth.initAuth.mockResolvedValue(auth.TEST_USER);
  auth.onSessionEnded.mockReturnValue(() => {});
  auth.signIn.mockResolvedValue(undefined);
  auth.signOut.mockResolvedValue(undefined);
});
