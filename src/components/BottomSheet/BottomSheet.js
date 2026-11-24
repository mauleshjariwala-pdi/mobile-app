/**
 * BottomSheet.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useEffect, useId, useRef } from 'react';
// Prescient Devices imports
import Icon from '../Icon/Icon';
import './BottomSheet.css';

/**
 * Render a modal sheet: slides up from the bottom on phones, centred dialog on tablets.
 * Closes on the close button, a backdrop tap or Escape, and locks page scroll while open.
 * @param {object} props - component props
 * @param {string} props.title - sheet heading
 * @param {string} [props.subtitle] - live text under the heading, e.g. "3 selected"
 * @param {() => void} props.onClose - called when the sheet should close
 * @param {import('react').RefObject<HTMLElement>} [props.initialFocusRef] - focused on open with a mouse or keyboard
 * @param {(event: KeyboardEvent) => void} [props.onKeyDown] - extra key handling (Escape is handled here)
 * @param {import('react').ReactNode} [props.footer] - content of the sticky footer
 * @param {import('react').ReactNode} [props.action] - header control shown instead of the close button,
 *   e.g. "Clear all"; the sheet still closes on a backdrop tap, Escape or a footer button
 * @param {import('react').ReactNode} props.children - sheet body
 * @returns {JSX.Element} sheet
 */
function BottomSheet({ title, subtitle, onClose, initialFocusRef, onKeyDown, footer, action, children }) {
  const titleId = useId();
  const sheetRef = useRef(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Only focus an input with a mouse or keyboard; on phones it would open the keyboard over the sheet
    const finePointer = window.matchMedia?.('(pointer: fine)').matches;
    (finePointer && initialFocusRef?.current ? initialFocusRef.current : sheetRef.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [initialFocusRef]);
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    onKeyDown?.(event);
  };
  return (
    <div className="bs-backdrop" onClick={onClose}>
      <div
        ref={sheetRef}
        className="bs-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <span className="bs-handle" aria-hidden="true" />
        <div className="bs-header">
          <div>
            <h2 id={titleId} className="bs-title">
              {title}
            </h2>
            {subtitle && (
              <p className="bs-subtitle" aria-live="polite">
                {subtitle}
              </p>
            )}
          </div>
          {action ?? (
            <button type="button" className="bs-close" aria-label="Close" onClick={onClose}>
              <Icon name="close" size={20} />
            </button>
          )}
        </div>
        {children}
        {footer && <div className="bs-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default BottomSheet;
