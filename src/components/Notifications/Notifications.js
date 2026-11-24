/**
 * Notifications.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useEffect, useState } from 'react';
// Prescient Devices imports
import Icon from '../Icon/Icon';
import MobileHeader from '../MobileHeader/MobileHeader';
import SkeletonCard from '../SkeletonCard/SkeletonCard';
import './Notifications.css';
import { formatDuration } from './notificationsData';

// Constants
const DURATION_TICK_MS = 60 * 1000;
const MESSAGE_MS = 4000;
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Unacknowledged' },
  { id: 'critical', label: 'Critical' },
  { id: 'warning', label: 'Warning' },
];
const SKELETON_CARDS = 3;
const PRIORITY = {
  critical: { label: 'Critical', rank: 0 },
  warning: { label: 'Warning', rank: 1 },
};

/**
 * Order alerts: unacknowledged first, critical before warning and oldest first;
 * then acknowledged, most recently acknowledged first
 * @param {import('./notificationsData').AlertNotification} a - first alert
 * @param {import('./notificationsData').AlertNotification} b - second alert
 * @returns {number} sort order
 */
function compareNotifications(a, b) {
  if (a.acknowledgedAt || b.acknowledgedAt) {
    return Boolean(a.acknowledgedAt) - Boolean(b.acknowledgedAt) || b.acknowledgedAt - a.acknowledgedAt;
  }
  return PRIORITY[a.priority].rank - PRIORITY[b.priority].rank || a.startedAt - b.startedAt;
}

/**
 * Format a timestamp as a short date and 24-hour time, e.g. "26 OCT 14:53"
 * @param {number} timestamp - ms since epoch
 * @returns {string} formatted date and time
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const month = date.toLocaleString('en', { month: 'short' }).toUpperCase();
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date.getDate()} ${month} ${time}`;
}

/**
 * Render the filled priority badge: a red diamond for critical, a yellow triangle for warning
 * @param {object} props - component props
 * @param {'critical' | 'warning'} props.priority - alert priority
 * @returns {JSX.Element} svg badge
 */
function PriorityBadge({ priority }) {
  return (
    <svg className="nt-badge" viewBox="0 0 24 24" width={32} height={32} aria-hidden="true">
      {priority === 'critical' ? (
        <>
          <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" transform="rotate(45 12 12)" fill="#ef4444" />
          <path d="m9.4 9.4 5.2 5.2m0-5.2-5.2 5.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M10.27 3.5a2 2 0 0 1 3.46 0l8.4 14.75a2 2 0 0 1-1.73 3H3.6a2 2 0 0 1-1.73-3z" fill="#ffc21a" />
          <path d="M12 9v4.6m0 3.4h.01" stroke="#1b1b1f" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/**
 * Render one alert card: an active alert with its facts and acknowledge action, or a compact acknowledged alert
 * @param {object} props - component props
 * @param {import('./notificationsData').AlertNotification} props.notification - alert
 * @param {number} props.now - current time used for the "Alert since" duration
 * @param {(id: string) => void} props.onAcknowledge - acknowledges the alert
 * @param {boolean} props.isAcknowledging - this alert is being acknowledged
 * @param {boolean} props.isLocked - another acknowledge is running, so the button is disabled
 * @param {boolean} props.canAcknowledge - false for read-only users: no Acknowledge button
 * @returns {JSX.Element} card
 */
function NotificationCard({ notification, now, onAcknowledge, isAcknowledging, isLocked, canAcknowledge }) {
  const { id, priority, title, reason, startedAt, details, acknowledgedAt } = notification;
  const isAcknowledged = Boolean(acknowledgedAt);
  const classes = ['nt-card', `nt-card--${priority}`, isAcknowledged && 'nt-card--acknowledged']
    .filter(Boolean)
    .join(' ');
  const heading = (
    <h3 id={`nt-${id}-title`} className="nt-card__title">
      {title}
    </h3>
  );
  if (isAcknowledged) {
    return (
      <article className={classes} aria-labelledby={`nt-${id}-title`}>
        <div className="nt-card__body">
          <span className="nt-card__priority">{PRIORITY[priority].label}</span>
          {heading}
          <div className="nt-card__ack">
            <span className="nt-acknowledged">
              <Icon name="check" size={16} strokeWidth={2.6} />
              <span className="nt-visually-hidden">Acknowledged</span>
              {formatTime(acknowledgedAt)}
            </span>
            <span className="nt-card__duration">{formatDuration(now - startedAt)}</span>
          </div>
        </div>
      </article>
    );
  }
  return (
    <article className={classes} aria-labelledby={`nt-${id}-title`}>
      <div className="nt-card__body">
        <div className="nt-card__meta">
          <span className="nt-card__priority">{PRIORITY[priority].label}</span>
          <span className="nt-card__time">{formatTime(startedAt)}</span>
        </div>
        {heading}
        {reason && <p className="nt-card__line">{reason}</p>}
        {details.map((detail) => (
          <p key={detail.label} className="nt-card__line">
            {detail.label}: <span className="nt-card__value">{detail.value}</span>
          </p>
        ))}
      </div>
      <div className="nt-card__footer">
        <PriorityBadge priority={priority} />
        <div className="nt-since">
          <span className="nt-since__label">Alert since</span>
          <span className="nt-since__value">{formatDuration(now - startedAt)}</span>
        </div>
        {canAcknowledge && (
          <button
            type="button"
            className="nt-btn"
            disabled={isLocked}
            aria-busy={isAcknowledging || undefined}
            onClick={() => onAcknowledge(id)}
          >
            <Icon name="check" size={18} strokeWidth={2.6} />
            <span>{isAcknowledging ? 'Acknowledging…' : 'Acknowledge'}</span>
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * Render the Notification tab: filters and the active and acknowledged smart alert cards
 * @param {object} props - component props
 * @param {import('./notificationsData').AlertNotification[]} props.notifications - alerts
 * @param {'loading' | 'success' | 'error'} props.status - smart alert request state
 * @param {string} [props.error] - message when the request failed
 * @param {() => void} props.onReload - fetches the alerts again
 * @param {(id: string) => Promise<void>} props.onAcknowledge - acknowledges an alert; rejects on failure
 * @param {boolean} [props.canAcknowledge] - false for read-only users (no write:digital_twin)
 * @param {JSX.Element} [props.banner] - card above the alerts, e.g. the push prompt
 * @returns {JSX.Element} notifications page
 */
function Notifications({ notifications, status, error, onReload, onAcknowledge, canAcknowledge = true, banner }) {
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(() => Date.now());
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [message, setMessage] = useState(null);
  // Keep the "Active for" durations ticking
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), DURATION_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (message?.type !== 'success') return undefined;
    const timer = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [message]);
  const handleAcknowledge = async (id) => {
    // One acknowledge at a time, like the web panel
    if (acknowledgingId) return;
    setAcknowledgingId(id);
    setMessage(null);
    try {
      await onAcknowledge(id);
      setMessage({ type: 'success', text: 'Acknowledged!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Error acknowledging the alert.' });
    } finally {
      setAcknowledgingId(null);
    }
  };
  const visible = notifications
    .filter((n) => {
      if (filter === 'open') return !n.acknowledgedAt;
      if (filter === 'critical' || filter === 'warning') return n.priority === filter;
      return true;
    })
    .sort(compareNotifications);
  const needsAttention = visible.filter((n) => !n.acknowledgedAt);
  const acknowledged = visible.filter((n) => n.acknowledgedAt);
  const renderCards = (items) =>
    items.map((n) => (
      <NotificationCard
        key={n.id}
        notification={n}
        now={now}
        onAcknowledge={handleAcknowledge}
        isAcknowledging={acknowledgingId === n.id}
        isLocked={Boolean(acknowledgingId)}
        canAcknowledge={canAcknowledge}
      />
    ));
  let content;
  if (status === 'loading') {
    content = (
      <div className="nt-list" role="status" aria-busy="true" aria-label="Loading notifications">
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <SkeletonCard key={i} variant="alert" />
        ))}
      </div>
    );
  } else if (status === 'error') {
    content = (
      <div className="nt-empty nt-empty--error" role="alert">
        <span className="nt-empty__icon">
          <Icon name="warning" size={30} />
        </span>
        <h2 className="nt-empty__title">Could not load notifications</h2>
        <p className="nt-empty__text">{error}</p>
        <button type="button" className="nt-btn nt-btn--retry" onClick={onReload}>
          <Icon name="refresh" size={18} />
          <span>Retry</span>
        </button>
      </div>
    );
  } else if (visible.length === 0) {
    content = (
      <div className="nt-empty">
        <span className="nt-empty__icon">
          <Icon name="bellOff" size={30} />
        </span>
        <h2 className="nt-empty__title">You're all caught up</h2>
        <p className="nt-empty__text">
          {filter === 'all' ? 'There are no unacknowledged alerts.' : 'No notifications match this filter.'}
        </p>
      </div>
    );
  } else {
    content = (
      <>
        {needsAttention.length > 0 && (
          <section className="nt-section" aria-label="Active">
            <h2 className="nt-section__title">Active ({needsAttention.length})</h2>
            {renderCards(needsAttention)}
          </section>
        )}
        {acknowledged.length > 0 && (
          <section className="nt-section" aria-label="Acknowledged">
            <h2 className="nt-section__title">Acknowledged ({acknowledged.length})</h2>
            {renderCards(acknowledged)}
          </section>
        )}
      </>
    );
  }
  const refreshButton = (
    <button
      type="button"
      className="nt-refresh"
      aria-label="Refresh"
      onClick={onReload}
      disabled={status === 'loading'}
    >
      <Icon name="refresh" size={20} strokeWidth={2.4} />
    </button>
  );
  return (
    <div className="notifications">
      <MobileHeader title="Smart Alerts" action={refreshButton} />
      <main className="notifications__content">
        {banner}
        <div className="nt-filters" role="tablist" aria-label="Filter notifications">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`nt-chip${filter === f.id ? ' nt-chip--active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {message && (
          <p role={message.type === 'error' ? 'alert' : 'status'} className={`nt-message nt-message--${message.type}`}>
            {message.text}
          </p>
        )}
        {content}
      </main>
    </div>
  );
}

export default Notifications;
