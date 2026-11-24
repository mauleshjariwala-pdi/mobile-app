/**
 * BottomNav.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import Icon from '../Icon/Icon';
import './BottomNav.css';

/**
 * @typedef {object} Tab
 * @property {string} id - tab identifier
 * @property {string} label - visible label
 * @property {string} icon - Icon name
 */

// Constants
const BADGE_MAX = 99;
/** @type {Tab[]} */
const TABS = [
  { id: 'notification', label: 'Alerts', icon: 'bell' },
  { id: 'home', label: 'Logbook', icon: 'book' },
  { id: 'history', label: 'History', icon: 'list' },
  { id: 'more', label: 'Settings', icon: 'settings' },
];

/**
 * Render the docked bottom navigation bar
 * @param {object} props - component props
 * @param {string} props.activeTab - id of the selected tab
 * @param {(tabId: string) => void} props.onChange - called with the tapped tab id
 * @param {Object<string, number>} [props.badges] - unread count per tab id
 * @returns {JSX.Element} navigation bar
 */
function BottomNav({ activeTab, onChange, badges = {} }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map(({ id, label, icon }) => {
        const isActive = id === activeTab;
        const badge = badges[id];
        return (
          <button
            key={id}
            type="button"
            className={`bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            aria-label={badge ? `${label}, ${badge} new` : undefined}
            onClick={() => onChange(id)}
          >
            <span className="bottom-nav__icon">
              <Icon name={icon} size={24} strokeWidth={2.2} />
              {badge > 0 && (
                <span className="bottom-nav__badge" aria-hidden="true">
                  {badge > BADGE_MAX ? `${BADGE_MAX}+` : badge}
                </span>
              )}
            </span>
            <span className="bottom-nav__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default BottomNav;
