/**
 * Logbook.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { useCallback, useRef, useState } from 'react';
// Prescient Devices imports
import { createLogbookEntry } from '../../api/logbookApi';
import { useActiveRig } from '../../config/activeRig';
import Icon from '../Icon/Icon';
import MobileHeader from '../MobileHeader/MobileHeader';
import ComponentSelector from './ComponentSelector';
import './Logbook.css';
import {
  PURPOSES,
  buildLogbookBody,
  getDefaultValues,
  getMissingFields,
  toDateTimeInputValue,
  validateEntryDate,
  validateLogbookEntry,
} from './logbookConfig';
import LogbookField from './LogbookField';
import LogbookReview from './LogbookReview';
import {
  ALARM_PLACEHOLDER,
  ALARM_STATUS,
  BRAND_CATEGORIES,
  COMPONENT_GROUPS,
  COMPONENT_OPTIONS,
  LINER_SIZES,
  MUD_TYPES,
  getMudUnits,
} from './logbookOptions';
import { REPAIR_FIELDS, applyRepairResets, isRepairFieldVisible, validateRepair } from './repairRules';
import { useBrandLists } from './useBrandLists';
import { useRigLayout } from './useRigLayout';

// Constants
const SELECT_OPTIONS = { ALARM_STATUS, LINER_SIZES, MUD_TYPES };

/**
 * Track an element's height, so the content above a fixed bar can leave room for it
 * @returns {[(node: HTMLElement | null) => void, number]} ref callback and the height in px (0 when absent)
 */
function useElementHeight() {
  const [height, setHeight] = useState(0);
  const observerRef = useRef(null);
  const ref = useCallback((node) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) {
      setHeight(0);
      return;
    }
    setHeight(node.offsetHeight);
    // The banner wraps when many fields are missing; older browsers and jsdom have no ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      observerRef.current = new ResizeObserver(() => setHeight(node.offsetHeight));
      observerRef.current.observe(node);
    }
  }, []);
  return [ref, height];
}

/**
 * Render the Logbook tab: equipment, date and purpose first, then the form, the review and the result
 * @param {object} props - component props
 * @param {import('./useBrandLists').BrandApiConfig} [props.apiConfig] - enables the brand-list API
 * @param {boolean} [props.canWrite] - false for read-only users: entries cannot be started
 * @param {() => void} [props.onDone] - "Back to Alerts" on the result screen; without it the page starts over
 * @returns {JSX.Element} logbook page
 */
function Logbook({ apiConfig, canWrite = true, onDone }) {
  const [step, setStep] = useState('start');
  const rig = useActiveRig();
  // Nothing is picked until the user chooses a pump and a purpose; the date starts at now
  const [mudpump, setMudpump] = useState('');
  const [purposeId, setPurposeId] = useState(null);
  const [dateTime, setDateTime] = useState(() => toDateTimeInputValue());
  const [values, setValues] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  // Outcome of the submit shown on the result screen: { type: 'success' | 'error', text }
  const [result, setResult] = useState(null);
  // The missing-fields banner is fixed on the bottom nav; the button sticks just above it
  const [missingRef, missingHeight] = useElementHeight();
  const purpose = PURPOSES.find((p) => p.id === purposeId);
  const isRepair = Boolean(purpose?.dynamic);
  // Mud pumps come from the rig layout (GET /rig/layout); a rig without pumps cannot get entries
  const rigLayout = useRigLayout(rig);
  const hasPumps = rigLayout.status === 'ready' && rigLayout.pumps.length > 0;
  const noPumpsId = rigLayout.status === 'ready' && !hasPumps ? 'lb-no-pumps' : undefined;
  const canStart = canWrite && hasPumps && Boolean(rigLayout.pumps.includes(mudpump) && purpose);
  const brandLists = useBrandLists(apiConfig);
  const units = getMudUnits(apiConfig?.rig);
  // Repair: fixed render order, filtered by the visibility rules
  let visibleFields = purpose?.fields ?? [];
  if (isRepair) {
    visibleFields = REPAIR_FIELDS.filter((f) => isRepairFieldVisible(f.id, { ...values, purpose: 'Repair' })).map((f) =>
      toRepairUiField(f, brandLists, units)
    );
  }
  // The component list gets the search-and-browse selector; the other fields stay in the card below it
  const selectorField = visibleFields.find((f) => f.type === 'multipicker');
  const otherFields = visibleFields.filter((f) => f !== selectorField);
  const missingFields = purpose && step === 'form' ? getMissingFields(purpose, values) : [];
  const updateValue = (name, value) =>
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      if (!isRepair) return next;
      return { ...next, ...applyRepairResets({ ...prev, purpose: 'Repair' }, { ...next, purpose: 'Repair' }) };
    });
  const showStep = (nextStep) => {
    setMessage(null);
    setStep(nextStep);
    window.scrollTo(0, 0);
  };
  const handleSelectPurpose = (id) => {
    const nextPurpose = PURPOSES.find((p) => p.id === id);
    setPurposeId(id);
    // Leaving Repair resets every Repair field; comments carry over to Inspection
    setValues((prev) => ({
      ...getDefaultValues(nextPurpose),
      ...(isRepair && nextPurpose.value === 'Inspection' ? { comments: prev.comments } : {}),
    }));
  };
  const handleNext = () => {
    // The pump and date chosen here are carried to the form and sent with the entry
    const error =
      (!mudpump && 'Please choose a mud pump.') ||
      (!purpose && 'Please choose a purpose.') ||
      validateEntryDate(dateTime);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    showStep('form');
  };
  const handleReview = (event) => {
    event.preventDefault();
    const validationError =
      (!mudpump && 'Please choose a mud pump.') ||
      validateLogbookEntry(purpose, values, dateTime) ||
      (isRepair && validateRepair(values)?.message);
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }
    showStep('review');
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await createLogbookEntry({ mudpump, body: buildLogbookBody(purpose, values, dateTime) });
      setResult({ type: 'success', text: 'Your logbook entry has been added!' });
    } catch (error) {
      setResult({ type: 'error', text: error.message || 'Failed to submit the logbook entry.' });
    } finally {
      setIsSubmitting(false);
    }
    showStep('result');
  };
  const handleDone = () => {
    if (onDone) {
      onDone();
      return;
    }
    setMudpump('');
    setPurposeId(null);
    setValues({});
    setDateTime(toDateTimeInputValue());
    setResult(null);
    showStep('start');
  };
  const messageView = message && (
    <p role={message.type === 'error' ? 'alert' : 'status'} className={`lb-message lb-message--${message.type}`}>
      {message.text}
    </p>
  );
  const header = {
    start: { title: 'Begin Logbook Entry' },
    form: { title: 'Fill Logbook Form', onBack: () => showStep('start') },
    review: { title: 'Review Logbook', onBack: () => showStep('form') },
    result: { title: 'Fill Logbook Form' },
  }[step];
  const context = purpose && step !== 'start' && (
    <p className="lb-context">
      <span>
        {[rig && `Rig ${rig}`, `Mud Pump ${mudpump}`, step !== 'review' && purpose.label].filter(Boolean).join(' • ')}
      </span>
      {step === 'result' && <span>{result?.type === 'success' ? 'Complete' : 'Not saved'}</span>}
    </p>
  );
  let content;
  if (step === 'start') {
    content = (
      <section className="lb-step" aria-labelledby="lb-equipment-heading">
        <div className="lb-block">
          <h2 id="lb-equipment-heading" className="lb-heading">
            Select equipment to begin
          </h2>
          <div className="lb-equipment">
            <span id="lb-pumps-label" className="lb-equipment__label">
              Mud pumps
            </span>
            {rigLayout.status === 'loading' && (
              <p className="lb-message lb-message--info" role="status">
                Loading mud pumps…
              </p>
            )}
            {rigLayout.status === 'error' && (
              <div id="lb-pumps-error" className="lb-message lb-message--error" role="alert">
                <p>{rigLayout.error}</p>
                <button type="button" className="lb-btn lb-btn--secondary" onClick={rigLayout.reload}>
                  Try again
                </button>
              </div>
            )}
            {rigLayout.status === 'ready' && !hasPumps && (
              <p id="lb-no-pumps" className="lb-message lb-message--error" role="alert">
                There are no mud pumps on {rig ? `rig ${rig}` : 'this rig'}, so logbook entries cannot be added.
              </p>
            )}
            {hasPumps && (
              <div className="lb-pump-grid" role="radiogroup" aria-labelledby="lb-pumps-label">
                {rigLayout.pumps.map((pump) => {
                  const isSelected = pump === mudpump;
                  return (
                    <label key={pump} className={`lb-pump${isSelected ? ' lb-pump--selected' : ''}`}>
                      <input
                        type="radio"
                        name="lb-mudpump"
                        value={pump}
                        checked={isSelected}
                        aria-label={`Mud pump ${pump}`}
                        onChange={() => setMudpump(pump)}
                      />
                      <span aria-hidden="true">{pump}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="lb-block">
          <label htmlFor="lb-dateTime" className="lb-heading">
            Date &amp; Time
          </label>
          <input
            id="lb-dateTime"
            className="lb-input"
            type="datetime-local"
            step="1"
            required
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
          />
        </div>
        <div className="lb-block">
          <h2 id="lb-purpose-heading" className="lb-heading">
            What's the purpose?
          </h2>
          <div className="lb-purpose-list" role="radiogroup" aria-labelledby="lb-purpose-heading">
            {PURPOSES.map((p) => {
              const isSelected = p.id === purposeId;
              return (
                <label key={p.id} className={`lb-purpose${isSelected ? ' lb-purpose--selected' : ''}`}>
                  <input
                    type="radio"
                    name="lb-purpose"
                    value={p.id}
                    checked={isSelected}
                    onChange={() => handleSelectPurpose(p.id)}
                  />
                  <Icon name={p.icon} size={24} strokeWidth={2.2} />
                  <span className="lb-purpose__label">{p.label}</span>
                </label>
              );
            })}
          </div>
        </div>
        {messageView}
        {!canWrite && (
          <p id="lb-read-only" className="lb-message lb-message--error" role="note">
            Your account can view the logbook but cannot add entries.
          </p>
        )}
        <button
          type="button"
          className="lb-btn lb-btn--primary"
          disabled={!canStart}
          aria-describedby={!canWrite ? 'lb-read-only' : noPumpsId}
          onClick={handleNext}
        >
          {canStart ? 'Start Logging' : 'Next'}
        </button>
      </section>
    );
  } else if (step === 'form') {
    content = (
      <form className="lb-step" onSubmit={handleReview} noValidate>
        {selectorField && (
          <section className="lb-block" aria-labelledby="lb-components-heading">
            <h2 id="lb-components-heading" className="lb-heading">
              Select {selectorField.label.toLowerCase()}
            </h2>
            <ComponentSelector
              id={`lb-${selectorField.name}`}
              headingId="lb-components-heading"
              options={selectorField.options}
              groups={selectorField.groups}
              value={values[selectorField.name]}
              onChange={(value) => updateValue(selectorField.name, value)}
            />
          </section>
        )}
        {otherFields.length > 0 && (
          <div className="lb-card">
            {otherFields.map((field) => (
              <LogbookField
                key={`${purpose.id}-${field.name}`}
                field={field}
                value={values[field.name]}
                onChange={(value) => updateValue(field.name, value)}
              />
            ))}
          </div>
        )}
        {messageView}
        {/* The missing-fields banner is fixed on top of the bottom nav; the button sticks above it */}
        <div
          className={`lb-actions${missingFields.length > 0 ? ' lb-actions--missing' : ''}`}
          style={{ '--lb-missing-height': `${missingHeight}px` }}
        >
          <button
            type="submit"
            className="lb-btn lb-btn--primary"
            disabled={missingFields.length > 0}
            aria-describedby={missingFields.length > 0 ? 'lb-missing' : undefined}
          >
            Review &amp; Submit
          </button>
          {missingFields.length > 0 && (
            <p id="lb-missing" ref={missingRef} className="lb-missing">
              <Icon name="warning" size={16} strokeWidth={2.4} />
              {missingFields.length} {missingFields.length === 1 ? 'field' : 'fields'} missing:{' '}
              {missingFields.join(', ')}
            </p>
          )}
        </div>
      </form>
    );
  } else if (step === 'review') {
    content = (
      <form className="lb-step" onSubmit={handleSubmit}>
        <LogbookReview
          purpose={purpose}
          fields={visibleFields}
          values={values}
          mudpump={mudpump}
          dateTime={dateTime}
          isSubmitting={isSubmitting}
        />
      </form>
    );
  } else {
    const isSuccess = result?.type === 'success';
    content = (
      <section className="lb-step" aria-label="Result">
        <div className={`lb-result lb-result--${result?.type}`} role={isSuccess ? 'status' : 'alert'}>
          <span className="lb-result__icon">
            <Icon name={isSuccess ? 'check' : 'close'} size={30} strokeWidth={3} />
          </span>
          <p className="lb-result__title">{isSuccess ? result.text : 'Your logbook entry was not added'}</p>
          {!isSuccess && <p className="lb-result__text">{result?.text}</p>}
        </div>
        {!isSuccess && (
          <button type="button" className="lb-btn lb-btn--secondary" onClick={() => showStep('review')}>
            Review and try again
          </button>
        )}
        <button type="button" className="lb-btn lb-btn--primary" onClick={handleDone}>
          Back to Alerts
        </button>
      </section>
    );
  }
  return (
    <div className="logbook">
      <MobileHeader title={header.title} onBack={header.onBack} />
      {context}
      <main className="logbook__content">{content}</main>
    </div>
  );
}

/**
 * Map a Repair field definition to the field config used by LogbookField
 * @param {import('./repairRules').RepairField} field - repair field
 * @param {Object<string, import('./logbookOptions').Option[]>} brandLists - brand options per category
 * @param {{ mudWeight: string, mudTemperature: string }} units - mud units
 * @returns {import('./logbookConfig').FieldConfig} field config
 */
function toRepairUiField(field, brandLists, units) {
  const base = { name: field.id, label: field.label };
  switch (field.control) {
    case 'multiselect':
      return {
        ...base,
        type: 'multipicker',
        options: COMPONENT_OPTIONS,
        groups: COMPONENT_GROUPS,
        placeholder: 'Choose components',
      };
    case 'select':
      if (BRAND_CATEGORIES.includes(field.options)) {
        return { ...base, type: 'picker', options: brandLists[field.options] };
      }
      return {
        ...base,
        type: 'select',
        options: SELECT_OPTIONS[field.options],
        placeholderValue: field.id === 'KCF' ? ALARM_PLACEHOLDER : '',
        required: field.id === 'KCF',
      };
    case 'yesno':
      return { ...base, type: 'toggle' };
    case 'number': {
      const unitById = { lgsContent: '%', mudTemp: units.mudTemperature, mudWeight: units.mudWeight };
      const unit = unitById[field.id] ?? (field.id.endsWith('Hours') ? 'hrs' : undefined);
      return {
        ...base,
        type: 'number',
        unit,
        integer: field.id === 'numberofGaskets',
        required: field.id.endsWith('Hours'),
      };
    }
    default:
      return { ...base, type: 'textarea' };
  }
}

export default Logbook;
