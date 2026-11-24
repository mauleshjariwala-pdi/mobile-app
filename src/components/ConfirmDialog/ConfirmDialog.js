/**
 * ConfirmDialog.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useEffect, useRef } from 'react';
// Prescient Devices imports
import './ConfirmDialog.css';

/**
 * Render a confirmation dialog: bottom sheet on phones, centred dialog on tablets
 * @param {object} props - component props
 * @param {string} props.title - dialog heading
 * @param {string} props.message - description of the action
 * @param {JSX.Element} [props.icon] - icon shown above the title
 * @param {string} props.confirmLabel - confirm button text
 * @param {string} [props.cancelLabel] - cancel button text
 * @param {() => void} props.onConfirm - called when the action is confirmed
 * @param {() => void} props.onCancel - called on cancel, backdrop tap or Escape
 * @returns {JSX.Element} dialog
 */
function ConfirmDialog({ title, message, icon, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  // Ref keeps the Escape listener stable while always calling the latest onCancel
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event) => event.key === 'Escape' && onCancelRef.current();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  return (
    <div className="cd-backdrop" onClick={onCancel}>
      <div
        className="cd-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        aria-describedby="cd-text"
        onClick={(event) => event.stopPropagation()}
      >
        {icon && <span className="cd-dialog__icon">{icon}</span>}
        <h2 id="cd-title" className="cd-dialog__title">
          {title}
        </h2>
        <p id="cd-text" className="cd-dialog__text">
          {message}
        </p>
        <div className="cd-dialog__actions">
          <button ref={cancelRef} type="button" className="cd-btn cd-btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="cd-btn cd-btn--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
