/**
 * MobileHeader.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import Icon from '../Icon/Icon';
import './MobileHeader.css';

/**
 * Render the sticky page header with a centred title, an optional back button and an optional action
 * @param {object} props - component props
 * @param {string} props.title - page title
 * @param {() => void} [props.onBack] - shows the back button when provided
 * @param {JSX.Element} [props.action] - control shown on the right, e.g. a refresh button
 * @returns {JSX.Element} page header
 */
function MobileHeader({ title, onBack, action }) {
  return (
    <header className="mobile-header">
      <div className="mobile-header__side">
        {onBack && (
          <button type="button" className="mobile-header__back" onClick={onBack} aria-label="Back">
            <Icon name="chevronLeft" size={24} strokeWidth={2.2} />
          </button>
        )}
      </div>
      <h1 className="mobile-header__title">{title}</h1>
      {action ? (
        <div className="mobile-header__side mobile-header__side--end">{action}</div>
      ) : (
        <div className="mobile-header__side" aria-hidden="true" />
      )}
    </header>
  );
}

export default MobileHeader;
