/**
 * More.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useState } from 'react';
// Prescient Devices imports
import { setActiveRig, useActiveRig, useAvailableRigs } from '../../config/activeRig';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import Icon from '../Icon/Icon';
import MobileHeader from '../MobileHeader/MobileHeader';
import RigPicker from './RigPicker';
import './More.css';

/**
 * @typedef {object} User
 * @property {string} firstName - first name
 * @property {string} lastName - last name
 * @property {string} [email] - email address
 * @property {string} [role] - job role
 *
 * @typedef {object} SegmentOption
 * @property {string} value - option value
 * @property {string} label - option name; only read by screen readers when the option has an icon only
 * @property {JSX.Element} [icon] - icon shown before (or instead of) the label
 * @property {boolean} [iconOnly] - hide the label visually
 */

// Constants
const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: <Icon name="sun" size={18} strokeWidth={2.4} /> },
  { value: 'dark', label: 'Dark', icon: <Icon name="moon" size={18} strokeWidth={2.4} /> },
];

/**
 * Render a pill-shaped single-choice control (a radio group)
 * @param {object} props - component props
 * @param {string} props.labelledBy - id of the element that names the group
 * @param {SegmentOption[]} props.options - choices
 * @param {string} props.value - selected value
 * @param {(value: string) => void} props.onChange - called with the picked value
 * @returns {JSX.Element} segmented control
 */
function Segmented({ labelledBy, options, value, onChange }) {
  return (
    <div className="mr-segmented" role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.iconOnly ? option.label : undefined}
            className={`mr-segmented__option${isSelected ? ' mr-segmented__option--selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {!option.iconOnly && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Render one settings row: title and subtitle on the left, a control on the right
 * @param {object} props - component props
 * @param {string} props.id - id of the title, used to name the control
 * @param {string} props.title - row title
 * @param {string} props.subtitle - row subtitle
 * @param {JSX.Element} props.children - control
 * @returns {JSX.Element} settings row
 */
function SettingRow({ id, title, subtitle, children }) {
  return (
    <div className="mr-row">
      <span className="mr-row__text">
        <span id={id} className="mr-row__title">
          {title}
        </span>
        <span className="mr-row__subtitle">{subtitle}</span>
      </span>
      {children}
    </div>
  );
}

/**
 * Render the Settings tab: rig, appearance and account
 * @param {object} props - component props
 * @param {User} [props.user] - signed-in user
 * @param {'light' | 'dark'} props.theme - current theme
 * @param {(theme: 'light' | 'dark') => void} props.onThemeChange - switches the theme
 * @param {() => void} props.onLogout - logs the user out
 * @returns {JSX.Element} settings page
 */
function More({ user, theme, onThemeChange, onLogout }) {
  const [view, setView] = useState('menu');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const activeRig = useActiveRig();
  const available = useAvailableRigs(user);
  const fullName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';
  return (
    <div className="more">
      <MobileHeader
        title={view === 'rigs' ? 'Switch Rigs' : 'Settings'}
        onBack={view === 'rigs' ? () => setView('menu') : undefined}
      />
      {view === 'rigs' ? (
        <main className="more__content">
          <RigPicker
            activeRig={activeRig}
            rigs={available.rigs}
            status={available.status}
            error={available.error}
            onRetry={available.reload}
            onSave={(rig) => {
              // Every page and API call follows the new rig
              setActiveRig(rig);
              setView('menu');
            }}
          />
        </main>
      ) : (
        <main className="more__content">
          {activeRig && <h2 className="mr-rig">Rig {activeRig}</h2>}
          <section className="mr-section" aria-labelledby="mr-appearance">
            <h2 id="mr-appearance" className="mr-section-title">
              Appearance
            </h2>
            <div className="mr-group">
              <SettingRow
                id="mr-theme-label"
                title="Screen mode"
                subtitle={theme === 'dark' ? 'Set to dark mode' : 'Set to light mode'}
              >
                <Segmented labelledBy="mr-theme-label" options={THEME_OPTIONS} value={theme} onChange={onThemeChange} />
              </SettingRow>
            </div>
          </section>
          <section className="mr-section" aria-labelledby="mr-account">
            <h2 id="mr-account" className="mr-section-title">
              Account
            </h2>
            {fullName && (
              <div className="mr-group mr-signed-in">
                <span className="mr-signed-in__icon" aria-hidden="true">
                  <Icon name="user" size={22} strokeWidth={2.2} />
                </span>
                <p className="mr-signed-in__text">
                  <span>
                    Signed in as <strong>{fullName}</strong>
                  </span>
                  {user.email && <span className="mr-signed-in__email">{user.email}</span>}
                </p>
              </div>
            )}
            <div className="mr-actions">
              <button type="button" className="mr-btn mr-btn--secondary" onClick={() => setView('rigs')}>
                Switch Rigs
              </button>
              <button type="button" className="mr-btn mr-btn--secondary" onClick={() => setConfirmLogout(true)}>
                Logout
              </button>
            </div>
            <p className="mr-version">Version {process.env.REACT_APP_VERSION || '0.1.0'}</p>
          </section>
        </main>
      )}
      {confirmLogout && (
        <ConfirmDialog
          title="Log out?"
          message="You'll need to sign in again to use the app."
          icon={<Icon name="logout" size={26} />}
          confirmLabel="Log out"
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => {
            setConfirmLogout(false);
            onLogout();
          }}
        />
      )}
    </div>
  );
}

export default More;
