/**
 * firebase.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

jest.mock('firebase/app', () => ({ initializeApp: jest.fn() }));
jest.mock('firebase/messaging', () => ({ getMessaging: jest.fn() }));

/**
 * Load a fresh copy of firebase.js with fresh Firebase mocks: it reads the browser once, when loaded
 * @param {() => object} [getMessaging] - what getMessaging returns or throws
 * @returns {{ firebase: object, initializeApp: jest.Mock }} module and the initializeApp mock
 */
function loadFirebase(getMessaging = () => ({ messaging: true })) {
  let firebase;
  let initializeApp;
  jest.isolateModules(() => {
    initializeApp = require('firebase/app').initializeApp;
    initializeApp.mockReturnValue({ name: 'app' });
    require('firebase/messaging').getMessaging.mockImplementation(getMessaging);
    firebase = require('./firebase');
  });
  return { firebase, initializeApp };
}

/**
 * Set what the browser offers
 * @param {object} [options] - browser features
 * @returns {{ register: jest.Mock }} service worker container
 */
function setBrowser({ secure = true, notification = true } = {}) {
  const serviceWorker = { register: jest.fn() };
  Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
  Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker, configurable: true });
  if (notification) window.Notification = function Notification() {};
  else delete window.Notification;
  return serviceWorker;
}

test('starts messaging on the Precision push project and gives the Web Push key', () => {
  setBrowser();
  const { firebase, initializeApp } = loadFirebase();
  expect(firebase.isPushSupported).toBe(true);
  expect(firebase.messaging).toEqual({ messaging: true });
  expect(initializeApp).toHaveBeenCalledWith(
    expect.objectContaining({ projectId: 'precision-mobile-push', messagingSenderId: '534661965784' })
  );
  expect(firebase.VAPID_KEY).toMatch(/^BGtB4f/);
});

test('registers the service worker once, and again after a failure', async () => {
  const serviceWorker = setBrowser();
  serviceWorker.register.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ scope: '/' });
  const { firebase } = loadFirebase();
  await expect(firebase.registerMessagingServiceWorker()).rejects.toThrow('offline');
  await expect(firebase.registerMessagingServiceWorker()).resolves.toEqual({ scope: '/' });
  await firebase.registerMessagingServiceWorker();
  expect(serviceWorker.register).toHaveBeenCalledTimes(2);
  expect(serviceWorker.register).toHaveBeenCalledWith('/firebase-messaging-sw.js');
});

test('without HTTPS there is no push, and the service worker is not registered', async () => {
  setBrowser({ secure: false });
  const { firebase } = loadFirebase();
  expect(firebase.isPushSupported).toBe(false);
  expect(firebase.messaging).toBeNull();
  await expect(firebase.registerMessagingServiceWorker()).rejects.toThrow(
    'Push notifications need HTTPS. Open the app over https:// to enable them.'
  );
});

test('a browser without notifications has no push', () => {
  setBrowser({ notification: false });
  expect(loadFirebase().firebase.isPushSupported).toBe(false);
});

test('a Firebase start-up error leaves the app working without push', () => {
  setBrowser();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { firebase } = loadFirebase(() => {
    throw new Error('messaging/unsupported-browser');
  });
  expect(firebase.messaging).toBeNull();
  expect(warn).toHaveBeenCalledWith('Firebase messaging is unavailable:', expect.any(Error));
  warn.mockRestore();
});
