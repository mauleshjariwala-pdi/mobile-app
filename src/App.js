/**
 * App.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { onMessage } from 'firebase/messaging';
import { useEffect, useState } from 'react';
// Prescient Devices imports
import BottomNav from './components/BottomNav/BottomNav';
import { prefetchRigLayout } from './api/rigLayoutCache';
import { acknowledgeSmartAlert } from './api/smartAlertApi';
import History from './components/History/History';
import Logbook from './components/Logbook/Logbook';
import Login from './components/Login/Login';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { canWrite } from './auth/auth';
import { hasRigAccess, useActiveRig } from './config/activeRig';
import RigSetup from './components/More/RigSetup';
import NoRigAccess from './components/Login/NoRigAccess';
import More from './components/More/More';
import Notifications from './components/Notifications/Notifications';
import { useSmartAlerts } from './components/Notifications/useSmartAlerts';
import { messaging, registerMessagingServiceWorker } from './notification/firebase';
import { syncPushRegistration } from './notification/pushRegistration';
import PushPrompt from './components/PushPrompt/PushPrompt';
import { applyTheme, getInitialTheme } from './theme';

// Constants
const DEFAULT_NOTIFICATION_ICON = '/logo192.png';

/**
 * Render the app inside the session: the sign-in page until the user is signed in
 * @returns {JSX.Element} app
 */
function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

/**
 * Show the sign-in page, or the app once the user is signed in
 * @returns {JSX.Element} sign-in page or app
 */
function AuthGate() {
  const auth = useAuth();
  const activeRig = useActiveRig();
  // Use the screen mode saved in Settings on the sign-in page too
  useEffect(() => applyTheme(getInitialTheme()), []);
  if (auth.status === 'signedIn') {
    // Every Designer call would answer 403: say so instead of showing failing pages
    if (!hasRigAccess(auth.user)) return <NoRigAccess user={auth.user} onLogout={auth.signOut} />;
    // First time on this device, or the old rig is no longer allowed: a rig must be picked first
    if (!activeRig) return <RigSetup user={auth.user} onLogout={auth.signOut} />;
    return <MainApp user={auth.user} onLogout={auth.signOut} />;
  }
  // Never a login form: the session is being checked, the browser is going to Auth0, or sign-in
  // cannot run on this page
  return <Login status={auth.status} error={auth.error} />;
}

/**
 * Render the signed-in app: the active tab page and the bottom navigation
 * @param {object} props - component props
 * @param {import('./auth/auth').SessionUser} props.user - signed-in user
 * @param {() => Promise<void>} props.onLogout - signs out of Auth0
 * @returns {JSX.Element} app
 */
function MainApp({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('notification');
  // Bumped on every bottom-nav tap so the page remounts in its default view,
  // even when the already-active tab is tapped again
  const [viewKey, setViewKey] = useState(0);
  const [theme, setTheme] = useState(getInitialTheme);
  const smartAlerts = useSmartAlerts();
  const activeRig = useActiveRig();
  // Read-only users see no write buttons (MD section 4.4)
  const mayWrite = canWrite(user);
  const notifications = smartAlerts.alerts;
  const unacknowledgedCount = notifications.filter((n) => !n.acknowledgedAt).length;
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  // After sign-in and at every start: store this device for push alarms. Without the "registered" flag
  // it checks the server (GET) and stores the device (PUT) when needed; with it, nothing is sent
  useEffect(() => {
    syncPushRegistration(user);
  }, [user]);
  // Save the rig layout (mud pumps) in the background, so the logbook shows the pumps at once
  useEffect(() => prefetchRigLayout(activeRig), [activeRig]);
  // Show push messages received while the app is open as system notifications. Without HTTPS there is
  // no messaging, so the app runs without push and the test button explains why
  useEffect(() => {
    if (!messaging) return undefined;
    const unsubscribe = onMessage(messaging, async (payload) => {
      try {
        const registration = await registerMessagingServiceWorker();
        await registration.showNotification(payload.notification?.title || 'Notification', {
          body: payload.notification?.body || '',
          icon: payload.notification?.icon || DEFAULT_NOTIFICATION_ICON,
        });
      } catch (error) {
        console.error('Failed to display foreground notification:', error);
      }
    });
    registerMessagingServiceWorker().catch((error) => {
      console.error('Failed to register Firebase messaging service worker:', error);
    });
    return unsubscribe;
  }, []);
  const showTab = (tabId) => {
    setActiveTab(tabId);
    setViewKey((key) => key + 1);
    if (tabId === 'notification') smartAlerts.reload();
  };
  const handleTabChange = (tabId) => {
    showTab(tabId);
    window.scrollTo(0, 0);
  };
  const handleAcknowledge = async (alertID) => {
    try {
      await acknowledgeSmartAlert(alertID);
    } finally {
      // Refresh on success and failure: an acknowledged alert leaves the unacknowledged list
      smartAlerts.reload({ silent: true });
    }
  };
  return (
    <>
      {activeTab === 'home' && (
        <Logbook key={viewKey} canWrite={mayWrite} onDone={() => handleTabChange('notification')} />
      )}
      {activeTab === 'history' && <History key={viewKey} canWrite={mayWrite} />}
      {activeTab === 'notification' && (
        <Notifications
          key={viewKey}
          notifications={notifications}
          status={smartAlerts.status}
          error={smartAlerts.error}
          onReload={smartAlerts.reload}
          onAcknowledge={handleAcknowledge}
          canAcknowledge={mayWrite}
          banner={<PushPrompt user={user} />}
        />
      )}
      {activeTab === 'more' && (
        <More key={viewKey} user={user} theme={theme} onThemeChange={setTheme} onLogout={onLogout} />
      )}
      <BottomNav activeTab={activeTab} onChange={handleTabChange} badges={{ notification: unacknowledgedCount }} />
    </>
  );
}

export default App;
