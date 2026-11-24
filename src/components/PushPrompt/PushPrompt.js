/**
 * PushPrompt.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useEffect, useState } from 'react';
// Prescient Devices imports
import { enablePush, getPushAvailability } from '../../notification/pushRegistration';
import Icon from '../Icon/Icon';
import './PushPrompt.css';

// Constants
// "Not now" hides the card until the app is opened again
const DISMISSED_KEY = 'pushPromptDismissed';

/**
 * Render the card that turns on push alarms. The browser asks for permission only from a tap (iOS
 * refuses otherwise), so the app cannot ask on its own. On an iPhone in Safari it explains the home
 * screen step instead. Shows nothing once alarms are on, blocked or not supported
 * @param {object} props - component props
 * @param {import('../../auth/auth').SessionUser} props.user - signed-in user
 * @returns {JSX.Element | null} prompt card
 */
function PushPrompt({ user }) {
  const [availability, setAvailability] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => readDismissed());
  useEffect(() => {
    let isActive = true;
    getPushAvailability().then((value) => isActive && setAvailability(value));
    return () => {
      isActive = false;
    };
  }, []);
  if (isDismissed || (availability !== 'prompt' && availability !== 'install')) return null;
  const handleEnable = async () => {
    setIsBusy(true);
    await enablePush(user);
    setIsBusy(false);
    setAvailability(await getPushAvailability());
  };
  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Hidden for this view only
    }
    setIsDismissed(true);
  };
  return (
    <section className="push-prompt" aria-labelledby="push-prompt-title">
      <span className="push-prompt__icon" aria-hidden="true">
        <Icon name="bell" size={22} strokeWidth={2.2} />
      </span>
      <div className="push-prompt__text">
        <h2 id="push-prompt-title" className="push-prompt__title">
          Get alarms on this device
        </h2>
        {availability === 'install' ? (
          <p className="push-prompt__body">
            On iPhone, tap Share, then Add to Home Screen, and open the app from your home screen to get alarms.
          </p>
        ) : (
          <p className="push-prompt__body">Turn on notifications to get rig alarms even when the app is closed.</p>
        )}
        <div className="push-prompt__actions">
          {availability === 'prompt' && (
            <button
              type="button"
              className="push-prompt__btn push-prompt__btn--primary"
              disabled={isBusy}
              onClick={handleEnable}
            >
              {isBusy ? 'Turning on…' : 'Turn on'}
            </button>
          )}
          <button type="button" className="push-prompt__btn" onClick={handleDismiss}>
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * True when "Not now" was tapped since the app was opened
 * @returns {boolean} true when hidden
 */
function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export default PushPrompt;
