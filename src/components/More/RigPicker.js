/**
 * RigPicker.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useState } from 'react';
// Prescient Devices imports
import Icon from '../Icon/Icon';
import './More.css';

/**
 * Render the rig picker of Switch Rigs and the first-time page: rig tiles like the logbook mud pump
 * tiles, the active rig selected, and Save (disabled until a different rig is picked)
 * @param {object} props - component props
 * @param {string} props.activeRig - rig the app works on; empty before the first choice
 * @param {string[]} props.rigs - rigs the user can pick
 * @param {(rig: string) => void} props.onSave - switches to the picked rig
 * @param {string} [props.intro] - text under the heading, e.g. on the first-time page
 * @param {'loading' | 'ready' | 'error'} [props.status] - load state of the rigs (read by country)
 * @param {string} [props.error] - why the rigs could not be loaded
 * @param {() => void} [props.onRetry] - loads the rigs again after an error
 * @returns {JSX.Element} rig picker
 */
function RigPicker({ activeRig, rigs, onSave, intro, status = 'ready', error = '', onRetry }) {
  const [selected, setSelected] = useState(activeRig);
  const [query, setQuery] = useState('');
  // Rig numbers or names containing the typed text, in any letter case
  const search = query.trim().toLowerCase();
  const shownRigs = search ? rigs.filter((rig) => String(rig).toLowerCase().includes(search)) : rigs;
  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(selected);
  };
  return (
    <form className="mr-rigs" onSubmit={handleSubmit}>
      <h2 id="mr-rigs-heading" className="mr-rigs__heading">
        Select rig
      </h2>
      {intro && <p className="mr-rigs__intro">{intro}</p>}
      <div className="mr-equipment">
        <span id="mr-rigs-label" className="mr-equipment__label">
          Rigs
        </span>
        {status === 'ready' && rigs.length > 0 && (
          <div className="mr-search">
            <Icon name="search" size={20} strokeWidth={2.4} />
            <input
              type="search"
              className="mr-search__input"
              placeholder="Search rigs..."
              aria-label="Search rigs"
              autoComplete="off"
              inputMode="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // Enter only searches; it must not save the rig
              onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}
            />
            {query && (
              <button type="button" className="mr-search__clear" aria-label="Clear search" onClick={() => setQuery('')}>
                <Icon name="close" size={18} strokeWidth={2.4} />
              </button>
            )}
          </div>
        )}
        {status === 'loading' ? (
          <p className="mr-rigs__empty" role="status">
            Loading your rigs…
          </p>
        ) : status === 'error' ? (
          <div className="mr-rigs__empty" role="alert">
            <p>{error || 'Unable to load your rigs.'}</p>
            {onRetry && (
              <button type="button" className="mr-link" onClick={onRetry}>
                Try again
              </button>
            )}
          </div>
        ) : shownRigs.length > 0 ? (
          <div className="mr-rig-grid" role="radiogroup" aria-labelledby="mr-rigs-label">
            {shownRigs.map((rig) => {
              const isSelected = rig === selected;
              return (
                <label key={rig} className={`mr-rig-tile${isSelected ? ' mr-rig-tile--selected' : ''}`}>
                  <input
                    type="radio"
                    name="mr-rig"
                    value={rig}
                    checked={isSelected}
                    aria-label={`Rig ${rig}${rig === activeRig ? ' (active)' : ''}`}
                    onChange={() => setSelected(rig)}
                  />
                  <span aria-hidden="true">{rig}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="mr-rigs__empty" role={rigs.length > 0 ? 'status' : undefined}>
            {rigs.length > 0 ? `No rigs match "${query.trim()}".` : 'No rigs available.'}
          </p>
        )}
      </div>
      {status === 'ready' && !selected && rigs.length > 0 && (
        <p id="mr-rigs-required" className="mr-rigs__required">
          Select a rig to continue.
        </p>
      )}
      <button
        type="submit"
        className="mr-btn mr-btn--primary mr-btn--block"
        disabled={!selected || selected === activeRig}
        aria-describedby={selected ? undefined : 'mr-rigs-required'}
      >
        Save
      </button>
    </form>
  );
}

export default RigPicker;
