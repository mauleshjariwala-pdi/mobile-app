/**
 * ComponentSelector.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useMemo, useState } from 'react';
// Prescient Devices imports
import BottomSheet from '../BottomSheet/BottomSheet';
import Icon from '../Icon/Icon';

/**
 * @typedef {object} ComponentRow
 * @property {string} key - unique row key
 * @property {string} name - part name shown on the row, e.g. "Liner"
 * @property {string} group - group heading the row came from, also matched by the search
 * @property {(import('./logbookOptions').Option & { number: string | null })[]} options - the
 *   numbered options of the part, e.g. Liner 1, Liner 2 and Liner 3
 */

// Constants
// Splits "Disch. Valve 2" into the part name and the cylinder number
const NUMBERED_LABEL = /^(.*\S)\s+(\d+)$/;

/**
 * Group the options into one row per part, keeping the option order
 * @param {import('./logbookOptions').Option[]} options - all options
 * @param {import('./OptionPicker').OptionGroup[]} [groups] - options grouped under headings
 * @returns {ComponentRow[]} rows
 */
function buildRows(options, groups) {
  const rows = [];
  for (const { group, options: groupOptions } of groups ?? [{ group: '', options }]) {
    for (const option of groupOptions) {
      const match = NUMBERED_LABEL.exec(option.label);
      const name = match ? match[1] : option.label;
      const key = `${group}|${name}`;
      let row = rows.find((r) => r.key === key);
      if (!row) {
        row = { key, name, group, options: [] };
        rows.push(row);
      }
      row.options.push({ ...option, number: match ? match[2] : null });
    }
  }
  return rows;
}

/**
 * Render the component multi-select: a search box, the "N selected" summary that opens the selected
 * list, and one row per part with a button per cylinder number
 * @param {object} props - component props
 * @param {string} props.id - id prefix for the controls
 * @param {string} props.headingId - id of the heading that names the selector
 * @param {import('./logbookOptions').Option[]} props.options - all options
 * @param {import('./OptionPicker').OptionGroup[]} [props.groups] - options grouped under headings
 * @param {string[]} props.value - selected values, in the order they were picked
 * @param {(value: string[]) => void} props.onChange - called with the new selection
 * @returns {JSX.Element} component selector
 */
function ComponentSelector({ id, headingId, options, groups, value, onChange }) {
  const [query, setQuery] = useState('');
  const [isListOpen, setIsListOpen] = useState(false);
  const selected = value ?? [];
  const rows = useMemo(() => buildRows(options, groups), [options, groups]);
  const q = query.trim().toLowerCase();
  const visibleRows = q
    ? rows.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          row.group.toLowerCase().includes(q) ||
          row.options.some((o) => o.label.toLowerCase().includes(q))
      )
    : rows;
  const labelFor = (v) => options.find((o) => o.value === v)?.label ?? v;
  // Appending keeps the selection order, which is also the submit order
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  return (
    <div className="cs">
      <div className="cs-search">
        <Icon name="search" size={22} strokeWidth={2.4} />
        <input
          id={`${id}-search`}
          type="search"
          className="cs-search__input"
          placeholder="Type to search..."
          aria-label="Search components"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button type="button" className="cs-search__clear" aria-label="Clear search" onClick={() => setQuery('')}>
            <Icon name="close" size={18} strokeWidth={2.4} />
          </button>
        )}
      </div>
      <button
        type="button"
        className="cs-summary"
        aria-haspopup="dialog"
        aria-expanded={isListOpen}
        onClick={() => setIsListOpen(true)}
      >
        <span className={`cs-summary__count${selected.length ? ' cs-summary__count--active' : ''}`}>
          {selected.length} selected
        </span>
        {selected.length > 0 && <span className="cs-summary__preview">{selected.map(labelFor).join(', ')}</span>}
        <Icon name="chevronDown" size={20} />
      </button>
      <p className="cs-caption" aria-live="polite">
        {q
          ? `Search results (${visibleRows.length} ${visibleRows.length === 1 ? 'match' : 'matches'})`
          : 'Browse and select'}
      </p>
      <div className="cs-rows" aria-labelledby={headingId} role="group">
        {visibleRows.map((row) => (
          <div key={row.key} className="cs-row" role="group" aria-label={row.name}>
            <span className="cs-row__name">{row.name}</span>
            <span className="cs-row__numbers">
              {row.options.map((option) => {
                const isOn = selected.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`cs-number${isOn ? ' cs-number--on' : ''}`}
                    aria-pressed={isOn}
                    aria-label={option.label}
                    onClick={() => toggle(option.value)}
                  >
                    {option.number ?? <Icon name={isOn ? 'check' : 'plus'} size={20} strokeWidth={2.6} />}
                  </button>
                );
              })}
            </span>
          </div>
        ))}
        {visibleRows.length === 0 && <p className="cs-empty">No components match “{query.trim()}”</p>}
      </div>
      {isListOpen && (
        <BottomSheet
          title={`Selected (${selected.length})`}
          onClose={() => setIsListOpen(false)}
          action={
            <button type="button" className="cs-clear" onClick={() => onChange([])} disabled={!selected.length}>
              Clear all
            </button>
          }
          footer={
            <button type="button" className="bs-primary" onClick={() => setIsListOpen(false)}>
              Done
            </button>
          }
        >
          <ul className="cs-selected" aria-label="Selected components">
            {selected.map((v) => (
              <li key={v} className="cs-selected__item">
                <span>{labelFor(v)}</span>
                <button
                  type="button"
                  className="cs-remove"
                  aria-label={`Remove ${labelFor(v)}`}
                  onClick={() => toggle(v)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {selected.length === 0 && <p className="cs-empty">Nothing selected yet.</p>}
        </BottomSheet>
      )}
    </div>
  );
}

export default ComponentSelector;
