/**
 * firebase.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';

// Constants
// Firebase project the Precision server sends alarms from (docs/firebase-push-notifications, section 2).
// These values and the Web Push key are public by design; sending also needs the server's private key
const FIREBASE_CONFIG = {
  projectId: 'precision-mobile-push',
  appId: '1:534661965784:web:a2975520e58c57565774ad',
  storageBucket: 'precision-mobile-push.firebasestorage.app',
  apiKey: 'AIzaSyAqlwYMQfZBuR54ureiZ-rf86nNpi25bwI',
  authDomain: 'precision-mobile-push.firebaseapp.com',
  messagingSenderId: '534661965784',
  measurementId: 'G-18G9EPL6JL',
};
// Web Push certificate (public key) of the project
const VAPID_KEY = 'BGtB4fCXcT4tSA8w4v5CkyU6ES0QKhTSSOJdIcU-EzL3GqQFUXKB9RwsCM5khY-83vJNRNOXRJIiuZoMiVB8-uY';
// Push needs HTTPS (or localhost): browsers block service workers and getMessaging() throws on plain
// HTTP, e.g. when the app is opened by a VM's IP address. There the app runs without push.
const isPushSupported =
  typeof window !== 'undefined' &&
  window.isSecureContext === true &&
  'serviceWorker' in navigator &&
  'Notification' in window;
const UNSUPPORTED_MESSAGE = 'Push notifications need HTTPS. Open the app over https:// to enable them.';
const messaging = isPushSupported ? createMessaging() : null;
const SERVICE_WORKER_URL = '/firebase-messaging-sw.js';

// Shared registration so the service worker is only registered once
let serviceWorkerRegistrationPromise;

/**
 * Start Firebase messaging; a failure leaves the app working without push
 * @returns {import('firebase/messaging').Messaging | null} messaging instance, or null when unavailable
 */
function createMessaging() {
  try {
    return getMessaging(initializeApp(FIREBASE_CONFIG));
  } catch (error) {
    console.warn('Firebase messaging is unavailable:', error);
    return null;
  }
}

/**
 * Register the Firebase messaging service worker (once; retried after a failure)
 * @returns {Promise<ServiceWorkerRegistration>} service worker registration
 */
function registerMessagingServiceWorker() {
  if (!messaging) {
    return Promise.reject(new Error(UNSUPPORTED_MESSAGE));
  }
  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = navigator.serviceWorker.register(SERVICE_WORKER_URL).catch((error) => {
      serviceWorkerRegistrationPromise = undefined;
      throw error;
    });
  }
  return serviceWorkerRegistrationPromise;
}

export { VAPID_KEY, isPushSupported, messaging, registerMessagingServiceWorker };
