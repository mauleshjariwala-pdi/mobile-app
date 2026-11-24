/**
 * History.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useState } from 'react';
// Prescient Devices imports
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import Icon from '../Icon/Icon';
import MobileHeader from '../MobileHeader/MobileHeader';
import SkeletonCard from '../SkeletonCard/SkeletonCard';
import './History.css';
import { STATUS_TONE, entryComponents, entryTitle, formatEntryDate, formatSubmittedDate } from './historyData';
import { useLogbookHistory } from './useLogbookHistory';

// Constants
const SKELETON_CARDS = 4;
const PURPOSE_ICON = { Repair: 'wrench', Inspection: 'search' };

/**
 * Render a Yes/No value as a green tick or red cross badge
 * @param {object} props - component props
 * @param {string} props.value - 'Yes' or 'No'
 * @returns {JSX.Element} badge
 */
function BooleanBadge({ value }) {
  const isYes = value === 'Yes';
  return (
    <span className={`hs-bool hs-bool--${isYes ? 'yes' : 'no'}`}>
      <span className="hs-bool__mark">
        <Icon name={isYes ? 'check' : 'close'} size={14} />
      </span>
      {value}
    </span>
  );
}

/**
 * Render one detail tile; Yes/No details with an icon become a full-width feature tile
 * @param {object} props - component props
 * @param {import('./historyData').HistoryDetail} props.detail - detail to show
 * @returns {JSX.Element} tile
 */
function DetailTile({ detail }) {
  const isBoolean = detail.type === 'boolean' && detail.value;
  const isYes = detail.value === 'Yes';
  const isFeature = isBoolean && detail.icon;
  const classes = [
    'hs-detail-tile',
    detail.wide && 'hs-detail-tile--wide',
    isFeature && `hs-detail-tile--feature hs-detail-tile--${isYes ? 'yes' : 'no'}`,
  ]
    .filter(Boolean)
    .join(' ');
  const label = (
    <dt className="hs-detail-tile__label">
      {detail.label}
      {detail.unit && <span className="hs-detail-tile__unit"> [{detail.unit}]</span>}
    </dt>
  );
  if (isFeature) {
    return (
      <div className={classes}>
        <span className="hs-feature__art" aria-hidden="true">
          <Icon name={detail.icon} size={26} />
          <span className="hs-feature__art-mark">
            <Icon name={isYes ? 'check' : 'close'} size={12} />
          </span>
        </span>
        <div className="hs-feature__text">
          {label}
          <p className="hs-feature__caption">{isYes ? detail.yesText : detail.noText}</p>
        </div>
        <dd className="hs-feature__value">
          <BooleanBadge value={detail.value} />
        </dd>
      </div>
    );
  }
  return (
    <div className={classes}>
      {label}
      <dd className={`hs-detail-tile__value${detail.value ? '' : ' hs-detail-tile__value--empty'}`}>
        {isBoolean ? <BooleanBadge value={detail.value} /> : detail.value || '—'}
      </dd>
    </div>
  );
}

/**
 * Render the History tab: logbook entries from the API, entry details, and delete from the edit mode
 * @param {object} props - component props
 * @param {boolean} [props.canWrite] - false for read-only users: no Edit
 * @returns {JSX.Element} history page
 */
function History({ canWrite = true }) {
  const { status, entries: loadedEntries, error, failedPumps, reload } = useLogbookHistory();
  // Entries removed in this session; there is no delete endpoint yet
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [openId, setOpenId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  // Card picked in the edit mode; it shows the delete action
  const [selectedId, setSelectedId] = useState(null);
  const entries = loadedEntries.filter((e) => !hiddenIds.has(e.id));
  const openEntry = entries.find((e) => e.id === openId);
  const deleteEntry = entries.find((e) => e.id === deleteId);
  const canEdit = canWrite && status === 'success' && entries.length > 0;
  const editing = isEditing && canEdit;
  const handleOpen = (id) => {
    setOpenId(id);
    window.scrollTo(0, 0);
  };
  const handleToggleEditing = () => {
    setIsEditing(!editing);
    setSelectedId(null);
  };
  const handleSelect = (id) => setSelectedId((current) => (current === id ? null : id));
  const handleConfirmDelete = () => {
    // TODO: call the backend once a delete endpoint exists; for now the entry is only hidden locally.
    setHiddenIds((prev) => new Set(prev).add(deleteId));
    if (openId === deleteId) setOpenId(null);
    setSelectedId(null);
    setDeleteId(null);
  };
  let content;
  if (openEntry) {
    content = <HistoryDetail entry={openEntry} onDelete={setDeleteId} />;
  } else if (status === 'loading') {
    content = (
      <div className="hs-list" role="status" aria-busy="true" aria-label="Loading logbook history">
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <SkeletonCard key={i} variant="history" />
        ))}
      </div>
    );
  } else if (status === 'error') {
    content = (
      <div className="history__empty history__empty--error" role="alert">
        <span className="history__empty-icon">
          <Icon name="warning" size={30} />
        </span>
        <h2 className="history__empty-title">Could not load history</h2>
        <p className="history__empty-text">{error}</p>
        <button type="button" className="hs-btn hs-btn--retry" onClick={reload}>
          <Icon name="refresh" size={18} />
          <span>Retry</span>
        </button>
      </div>
    );
  } else if (entries.length === 0) {
    content = (
      <div className="history__empty">
        <span className="history__empty-icon">
          <Icon name="clock" size={32} />
        </span>
        <h2 className="history__empty-title">No logbook entries</h2>
        <p className="history__empty-text">No entries in the last 14 days.</p>
      </div>
    );
  } else {
    content = (
      <section className="hs-list" aria-label="Logbook history">
        {entries.map((entry) => (
          <HistoryCard
            key={entry.id}
            entry={entry}
            isEditing={editing}
            isSelected={editing && selectedId === entry.id}
            onOpen={handleOpen}
            onSelect={handleSelect}
            onDelete={setDeleteId}
          />
        ))}
      </section>
    );
  }
  const refreshButton = (
    <button type="button" className="hs-refresh" aria-label="Refresh" onClick={reload} disabled={status === 'loading'}>
      <Icon name="refresh" size={20} strokeWidth={2.4} />
    </button>
  );
  return (
    <div className="history">
      <MobileHeader
        title={openEntry ? 'Entry Details' : 'Logbook History'}
        onBack={openEntry ? () => setOpenId(null) : undefined}
        action={openEntry ? undefined : refreshButton}
      />
      <main className="history__content">
        {!openEntry && (
          <div className="hs-toolbar">
            <h2 className="hs-toolbar__title">{editing ? 'Select to delete' : 'Manage past entries'}</h2>
            {canEdit && (
              <button type="button" className="hs-link" onClick={handleToggleEditing}>
                {editing ? 'Stop editing' : 'Edit'}
              </button>
            )}
          </div>
        )}
        {!openEntry && status === 'success' && failedPumps.length > 0 && (
          <p className="hs-notice" role="status">
            Could not load {failedPumps.map((p) => `Pump ${p}`).join(', ')}.{' '}
            <button type="button" className="hs-link" onClick={reload}>
              Retry
            </button>
          </p>
        )}
        {content}
      </main>
      {deleteEntry && (
        <ConfirmDialog
          title="Delete this entry?"
          message={`${entryTitle(deleteEntry)} (${entryComponents(deleteEntry)}) will be removed.`}
          icon={<Icon name="trash" size={26} />}
          confirmLabel="Delete"
          onCancel={() => setDeleteId(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}

/**
 * Render the purpose and, for repairs, the alarm status, e.g. "REPAIR • ALARM"
 * @param {object} props - component props
 * @param {import('./historyData').HistoryEntry} props.entry - history entry
 * @returns {JSX.Element} tag line
 */
function EntryTags({ entry }) {
  return (
    <span className="hs-tags">
      <span className="hs-tag hs-tag--purpose">
        {PURPOSE_ICON[entry.purpose] && <Icon name={PURPOSE_ICON[entry.purpose]} size={13} strokeWidth={2.4} />}
        {entry.purpose}
      </span>
      {entry.alarmStatus !== entry.purpose && (
        <>
          <span className="hs-tags__dot" aria-hidden="true">
            •
          </span>
          <StatusTag status={entry.alarmStatus} />
        </>
      )}
    </span>
  );
}

/**
 * Render one entry in the history list; in the edit mode a tap selects it and reveals the delete action
 * @param {object} props - component props
 * @param {import('./historyData').HistoryEntry} props.entry - history entry
 * @param {boolean} props.isEditing - the list is in the edit mode
 * @param {boolean} props.isSelected - the card is selected for delete
 * @param {(id: string) => void} props.onOpen - opens the entry details
 * @param {(id: string) => void} props.onSelect - selects or unselects the entry in the edit mode
 * @param {(id: string) => void} props.onDelete - asks to delete the entry
 * @returns {JSX.Element} card
 */
function HistoryCard({ entry, isEditing, isSelected, onOpen, onSelect, onDelete }) {
  const title = entryTitle(entry);
  return (
    <article className={`hs-card${isSelected ? ' hs-card--selected' : ''}`}>
      <button
        type="button"
        className="hs-card__main"
        aria-pressed={isEditing ? isSelected : undefined}
        onClick={() => (isEditing ? onSelect(entry.id) : onOpen(entry.id))}
      >
        <EntryTags entry={entry} />
        <span className="hs-card__title">{title}</span>
        <span className="hs-card__components">{entryComponents(entry)}</span>
        <span className="hs-card__submitted">
          <Icon name="check" size={14} strokeWidth={3} />
          Submitted on {formatSubmittedDate(entry.submittedAt)}
        </span>
      </button>
      {isSelected && (
        <button
          type="button"
          className="hs-card__delete"
          aria-label={`Delete ${title}`}
          onClick={() => onDelete(entry.id)}
        >
          <Icon name="trash" size={26} strokeWidth={2.2} />
        </button>
      )}
    </article>
  );
}

/**
 * Render the details page of one entry
 * @param {object} props - component props
 * @param {import('./historyData').HistoryEntry} props.entry - history entry
 * @param {(id: string) => void} props.onDelete - asks to delete the entry
 * @returns {JSX.Element} entry details
 */
function HistoryDetail({ entry, onDelete }) {
  return (
    <div className="hs-detail">
      <section className="hs-hero">
        <EntryTags entry={entry} />
        <h2 className="hs-hero__title">{entryTitle(entry)}</h2>
        <p className="hs-hero__components">{entryComponents(entry)}</p>
        <div className="hs-hero__meta">
          <span className="hs-hero__date">
            <Icon name="calendar" size={16} />
            {formatEntryDate(entry.dateTime)}
          </span>
          {entry.username && <span className="hs-hero__user">{entry.username}</span>}
        </div>
      </section>
      <dl className="hs-details">
        {entry.details.map((detail) => (
          <DetailTile key={detail.label} detail={detail} />
        ))}
      </dl>
      <button type="button" className="hs-btn hs-btn--danger-outline" onClick={() => onDelete(entry.id)}>
        <Icon name="trash" size={18} />
        <span>Delete entry</span>
      </button>
    </div>
  );
}

/**
 * Render the alarm status with its icon: red diamond for alarms, yellow triangle for warnings, green tick when fine
 * @param {object} props - component props
 * @param {string} props.status - alarm status
 * @returns {JSX.Element} status tag
 */
function StatusTag({ status }) {
  const tone = STATUS_TONE[status] || 'ok';
  return (
    <span className={`hs-tag hs-tag--${tone}`}>
      <svg viewBox="0 0 24 24" width={13} height={13} aria-hidden="true">
        {tone === 'critical' && (
          <>
            <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" transform="rotate(45 12 12)" fill="currentColor" />
            <path className="hs-tag__cut" d="m9.4 9.4 5.2 5.2m0-5.2-5.2 5.2" strokeWidth="2.6" strokeLinecap="round" />
          </>
        )}
        {tone === 'warning' && (
          <>
            <path
              d="M10.27 3.5a2 2 0 0 1 3.46 0l8.4 14.75a2 2 0 0 1-1.73 3H3.6a2 2 0 0 1-1.73-3z"
              fill="currentColor"
            />
            <path className="hs-tag__cut" d="M12 9v4.6m0 3.4h.01" strokeWidth="2.6" strokeLinecap="round" />
          </>
        )}
        {tone === 'ok' && (
          <>
            <circle cx="12" cy="12" r="10.5" fill="currentColor" />
            <path className="hs-tag__cut" d="m7.5 12.2 3 3 6-6.2" fill="none" strokeWidth="2.8" strokeLinecap="round" />
          </>
        )}
        {tone === 'info' && <circle cx="12" cy="12" r="6" fill="currentColor" />}
      </svg>
      {status}
    </span>
  );
}

export default History;
