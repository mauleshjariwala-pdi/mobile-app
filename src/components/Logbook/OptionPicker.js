/**
 * OptionPicker.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useMemo, useRef, useState } from 'react';
// Prescient Devices imports
import BottomSheet from '../BottomSheet/BottomSheet';
import Icon from '../Icon/Icon';

/**
 * @typedef {object} OptionGroup
 * @property {string} group - section heading
 * @property {import('./logbookOptions').Option[]} options - options in the section
 */

// Constants
const SEARCH_THRESHOLD = 8;

/**
 * Render a searchable picker shown as a bottom sheet on phones (centred dialog on tablets).
 * Multiple mode shows checkboxes, removable chips under the field and a Done button;
 * single mode shows radio options and closes when an option is picked.
 * @param {object} props - component props
 * @param {string} props.id - trigger id
 * @param {string} props.labelId - id of the visible field label
 * @param {string} props.label - field label, used as the sheet title
 * @param {import('./logbookOptions').Option[]} props.options - all options
 * @param {OptionGroup[]} [props.groups] - options grouped under headings
 * @param {string | string[]} props.value - selected value (array when multiple)
 * @param {(value: string | string[]) => void} props.onChange - called with the new value
 * @param {boolean} [props.multiple] - allow several selections
 * @param {string} [props.placeholder] - text shown when nothing is selected
 * @returns {JSX.Element} picker
 */
function OptionPicker({
  id,
  labelId,
  label,
  options,
  groups,
  value,
  onChange,
  multiple = false,
  placeholder = 'Choose',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const selected = multiple ? (value ?? []) : value;
  const hasValue = multiple ? selected.length > 0 : selected !== '' && selected != null;
  const isSelected = (v) => (multiple ? selected.includes(v) : selected === v);
  const labelFor = (v) => options.find((o) => o.value === v)?.label ?? v;
  const searchable = options.length > SEARCH_THRESHOLD;
  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = groups ?? [{ group: null, options }];
    return source
      .map((g) => ({ ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(q)) }))
      .filter((g) => g.options.length);
  }, [groups, options, query]);
  const flatVisible = visibleGroups.flatMap((g) => g.options);
  const optionId = (index) => `${id}-option-${index}`;
  const open = () => {
    setQuery('');
    setActiveIndex(0);
    setIsOpen(true);
  };
  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const pick = (optionValue) => {
    if (!multiple) {
      onChange(optionValue);
      close();
      return;
    }
    // Appending keeps the selection order
    onChange(selected.includes(optionValue) ? selected.filter((v) => v !== optionValue) : [...selected, optionValue]);
  };
  // Arrow keys move the highlight; Enter in the search box picks it (Escape is handled by BottomSheet)
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatVisible.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && event.target === searchRef.current) {
      event.preventDefault();
      const option = flatVisible[activeIndex];
      if (option) pick(option.value);
    }
  };
  let display = placeholder;
  if (hasValue) display = multiple ? `${selected.length} selected` : labelFor(selected);
  let flatIndex = -1;
  return (
    <div className="lb-picker">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="lb-input lb-picker__trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-labelledby={`${labelId} ${id}-value`}
        onClick={open}
      >
        <span id={`${id}-value`} className={`lb-picker__value${hasValue ? '' : ' lb-picker__value--placeholder'}`}>
          {display}
        </span>
        <span className="lb-picker__chevron">
          <Icon name="chevronDown" size={20} />
        </span>
      </button>
      {multiple && hasValue && (
        <ul className="lb-chips" aria-label={`Selected ${label}`}>
          {selected.map((v) => (
            <li key={v} className="lb-chip">
              <span>{labelFor(v)}</span>
              <button
                type="button"
                className="lb-chip__remove"
                aria-label={`Remove ${labelFor(v)}`}
                onClick={() => pick(v)}
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {isOpen && (
        <BottomSheet
          title={label}
          subtitle={multiple ? `${selected.length} selected` : undefined}
          onClose={close}
          initialFocusRef={searchRef}
          onKeyDown={onKeyDown}
          footer={
            multiple && (
              <>
                <button type="button" className="bs-clear" onClick={() => onChange([])} disabled={!hasValue}>
                  Clear all
                </button>
                <button type="button" className="bs-primary" onClick={close}>
                  Done{hasValue ? ` (${selected.length})` : ''}
                </button>
              </>
            )
          }
        >
          {searchable && (
            <div className="bs-search">
              <Icon name="search" size={18} />
              <input
                ref={searchRef}
                type="search"
                className="bs-search-input"
                placeholder="Search…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                role="combobox"
                aria-label={`Search ${label}`}
                aria-expanded="true"
                aria-controls={`${id}-listbox`}
                aria-activedescendant={flatVisible.length ? optionId(activeIndex) : undefined}
                autoComplete="off"
                enterKeyHint="done"
              />
            </div>
          )}
          <div
            id={`${id}-listbox`}
            className="bs-list"
            role="listbox"
            aria-label={label}
            aria-multiselectable={multiple || undefined}
          >
            {visibleGroups.map((g) => (
              <div key={g.group ?? 'all'} role="group" aria-label={g.group ?? undefined}>
                {g.group && <div className="bs-group">{g.group}</div>}
                {g.options.map((o) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  const checked = isSelected(o.value);
                  const classes = [
                    'bs-option',
                    checked && 'bs-option--selected',
                    index === activeIndex && 'bs-option--active',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <div
                      key={o.value}
                      id={optionId(index)}
                      role="option"
                      aria-selected={checked}
                      className={classes}
                      onClick={() => pick(o.value)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className={`bs-mark bs-mark--${multiple ? 'checkbox' : 'radio'}`}>
                        {checked && <Icon name="check" size={13} />}
                      </span>
                      <span className="bs-option-label">{o.label}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            {flatVisible.length === 0 && <p className="bs-empty">No matches for “{query}”</p>}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

export default OptionPicker;
