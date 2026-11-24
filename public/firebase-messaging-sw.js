// Firebase messaging service worker (docs/firebase-push-notifications, section 3). Served from the app
// root with Cache-Control: no-cache (public/serve.json).
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Same project as src/notification/firebase.js; these values are public
firebase.initializeApp({
  projectId: 'precision-mobile-push',
  appId: '1:534661965784:web:a2975520e58c57565774ad',
  storageBucket: 'precision-mobile-push.firebasestorage.app',
  apiKey: 'AIzaSyAqlwYMQfZBuR54ureiZ-rf86nNpi25bwI',
  authDomain: 'precision-mobile-push.firebaseapp.com',
  messagingSenderId: '534661965784',
  measurementId: 'G-18G9EPL6JL',
});

// Shows each alarm by itself while the app is closed. No onBackgroundMessage that shows it again:
// the alarm would appear twice
firebase.messaging();

// Tapping an alarm opens the app at the link the server sent
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const msg = event.notification.data && event.notification.data.FCM_MSG;
  const link = (msg && msg.fcmOptions && msg.fcmOptions.link) || '/';
  event.waitUntil(clients.openWindow(link));
});
