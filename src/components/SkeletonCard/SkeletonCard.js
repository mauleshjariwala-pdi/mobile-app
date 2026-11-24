/**
 * SkeletonCard.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import './SkeletonCard.css';

/**
 * Bar shapes of each card, in the order they appear on the real card
 */
const VARIANTS = {
  // Smart alert card: priority and time, title, two detail lines, then the footer band with the
  // badge, "Alert since" and the Acknowledge button
  alert: (
    <>
      <div className="sk-card__body">
        <span className="sk-card__row">
          <span className="sk-card__bar sk-card__bar--label" />
          <span className="sk-card__bar sk-card__bar--time" />
        </span>
        <span className="sk-card__bar sk-card__bar--title" />
        <span className="sk-card__bar sk-card__bar--line" />
        <span className="sk-card__bar sk-card__bar--line-short" />
      </div>
      <div className="sk-card__footer">
        <span className="sk-card__bar sk-card__bar--badge" />
        <span className="sk-card__since">
          <span className="sk-card__bar sk-card__bar--since-label" />
          <span className="sk-card__bar sk-card__bar--since-value" />
        </span>
        <span className="sk-card__bar sk-card__bar--button" />
      </div>
    </>
  ),
  // Logbook history card: tags, title, components and "Submitted on"
  history: (
    <div className="sk-card__body">
      <span className="sk-card__bar sk-card__bar--tags" />
      <span className="sk-card__bar sk-card__bar--title sk-card__bar--spaced" />
      <span className="sk-card__bar sk-card__bar--components" />
      <span className="sk-card__bar sk-card__bar--submitted sk-card__bar--spaced" />
    </div>
  ),
};

/**
 * Render a shimmering placeholder shaped like the card that is loading
 * @param {object} props - component props
 * @param {'alert' | 'history'} props.variant - card it stands in for
 * @returns {JSX.Element} skeleton card
 */
function SkeletonCard({ variant }) {
  return (
    <div className={`sk-card sk-card--${variant}`} aria-hidden="true">
      {VARIANTS[variant]}
    </div>
  );
}

export default SkeletonCard;
