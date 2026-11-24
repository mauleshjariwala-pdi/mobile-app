/**
 * LogbookReview.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import { ALARM_PLACEHOLDER } from './logbookOptions';

/**
 * @typedef {object} ReviewItem
 * @property {string} name - field name
 * @property {string} label - label shown above the value
 * @property {string} value - formatted value
 * @property {boolean} [wide] - spans the full row
 *
 * @typedef {object} ReviewSection
 * @property {string} title - section title
 * @property {ReviewItem[]} items - values in form order
 */

// Constants
const EMPTY = '—';
// Repair fields grouped like the review mockup. Fields before Re-Use Liners (components, brands and
// liner size) belong to Basic Information; the rest up to the mud fields to Inspection and Re-use
const FIRST_INSPECTION_FIELD = 'reUseLiners';
const MUD_AND_OIL_FIELDS = ['mudType', 'mudWeight', 'lgsContent', 'mudTemp', 'numberofGaskets', 'oilFilterChanged'];
const ALARM_AND_COMMENT_FIELDS = ['KCF', 'comments'];
// Pre-charge readings get their own section; the other purposes list their fields in Basic Information
const SECTION_TITLE = { Precharge: 'Dampener Pre-charge' };
// Colour of the alarm status icon
const ALARM_TONE = {
  Alarm: 'critical',
  'Missed Alarm': 'critical',
  Warning: 'warning',
  'No Alarm': 'ok',
  'Preventative Maintenance': 'info',
};

/**
 * Format a field value for the review, e.g. "8.33 ppg", "Liner 1, Liner 2" or "—" when empty
 * @param {import('./logbookConfig').FieldConfig} field - field definition
 * @param {*} value - form value
 * @returns {string} formatted value
 */
function formatValue(field, value) {
  switch (field.type) {
    case 'multipicker':
      return value?.length ? value.join(', ') : EMPTY;
    case 'select': {
      if (value === '' || value === ALARM_PLACEHOLDER) return EMPTY;
      const option = field.options.find((o) => String(typeof o === 'object' ? o.value : o) === String(value));
      return String(typeof option === 'object' ? option.label : value);
    }
    case 'number': {
      // Numeric Repair defaults are 0, which the form shows as empty
      if (value === '' || value === 0 || value === '0') return EMPTY;
      if (!field.unit) return String(value);
      return field.unit === '%' ? `${value}%` : `${value} ${field.unit}`;
    }
    case 'toggle':
      if (field.name === 'oilFilterChanged') return value === 'Yes' ? 'Changed' : 'Not changed';
      return value || EMPTY;
    default:
      return String(value ?? '').trim() || EMPTY;
  }
}

/**
 * Format the date-time input value for the review, e.g. "2026-10-29 | 16:03:16"
 * @param {string} dateTime - value of the datetime-local input
 * @returns {string} formatted date and time
 */
function formatDateTime(dateTime) {
  if (!dateTime) return EMPTY;
  const [date, time = ''] = dateTime.split('T');
  // The input drops the seconds when they are zero
  return `${date} | ${time.length === 5 ? `${time}:00` : time}`;
}

/**
 * Group the visible fields into the review sections, starting with Basic Information
 * @param {object} entry - the entry
 * @param {import('./logbookConfig').Purpose} entry.purpose - selected purpose
 * @param {import('./logbookConfig').FieldConfig[]} entry.fields - visible fields in form order
 * @param {object} entry.values - form values
 * @param {string} entry.mudpump - selected mud pump
 * @param {string} entry.dateTime - value of the datetime-local input
 * @returns {ReviewSection[]} sections that have at least one value
 */
function buildReviewSections({ purpose, fields, values, mudpump, dateTime }) {
  const toItem = (field) => ({
    name: field.name,
    // Units are part of the value here, so "Liner Size [in]" becomes "Liner Size"
    label: field.label.replace(/\s*\[.*\]$/, ''),
    value: formatValue(field, values[field.name]),
    // Alarm Status also spans the row so its icon and longer values fit
    wide: field.type === 'multipicker' || field.type === 'textarea' || field.name === 'KCF',
  });
  const pick = (test) => fields.filter(test).map(toItem);
  const basicItems = [
    { name: 'equipment', label: 'Equipment', value: `Mud Pump ${mudpump}`, wide: true },
    { name: 'dateTime', label: 'Date & Time', value: formatDateTime(dateTime) },
    { name: 'purpose', label: 'Purpose', value: purpose.label },
  ];
  let sections;
  if (purpose.dynamic) {
    const inspectionStart = fields.findIndex((f) => f.name === FIRST_INSPECTION_FIELD);
    const isGrouped = (f) => MUD_AND_OIL_FIELDS.includes(f.name) || ALARM_AND_COMMENT_FIELDS.includes(f.name);
    const isBasic = (f, i) => inspectionStart === -1 || i < inspectionStart;
    sections = [
      { title: 'Basic Information', items: [...basicItems, ...pick((f, i) => !isGrouped(f) && isBasic(f, i))] },
      { title: 'Inspection and Re-use', items: pick((f, i) => !isGrouped(f) && !isBasic(f, i)) },
      { title: 'Mud & Oil Information', items: pick((f) => MUD_AND_OIL_FIELDS.includes(f.name)) },
      { title: 'Alarm & Comments', items: pick((f) => ALARM_AND_COMMENT_FIELDS.includes(f.name)) },
    ];
  } else {
    const mainItems = pick((f) => f.name !== 'comments');
    const ownSection = SECTION_TITLE[purpose.value];
    sections = [
      { title: 'Basic Information', items: ownSection ? basicItems : [...basicItems, ...mainItems] },
      ...(ownSection ? [{ title: ownSection, items: mainItems }] : []),
      { title: 'Comments', items: pick((f) => f.name === 'comments') },
    ];
  }
  return sections.filter((s) => s.items.length);
}

/**
 * Render the alarm status icon: red diamond, yellow triangle, green tick or blue dot
 * @param {object} props - component props
 * @param {string} props.status - alarm status
 * @returns {JSX.Element | null} svg icon
 */
function AlarmIcon({ status }) {
  const tone = ALARM_TONE[status];
  if (!tone) return null;
  return (
    <svg className={`lr-alarm lr-alarm--${tone}`} viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
      {tone === 'critical' && (
        <>
          <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" transform="rotate(45 12 12)" fill="currentColor" />
          <path className="lr-alarm__cut" d="m9.4 9.4 5.2 5.2m0-5.2-5.2 5.2" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {tone === 'warning' && (
        <>
          <path d="M10.27 3.5a2 2 0 0 1 3.46 0l8.4 14.75a2 2 0 0 1-1.73 3H3.6a2 2 0 0 1-1.73-3z" fill="currentColor" />
          <path className="lr-alarm__cut" d="M12 9v4.6m0 3.4h.01" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {tone === 'ok' && (
        <>
          <circle cx="12" cy="12" r="10.5" fill="currentColor" />
          <path className="lr-alarm__cut" d="m7.5 12.2 3 3 6-6.2" fill="none" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
      {tone === 'info' && <circle cx="12" cy="12" r="6" fill="currentColor" />}
    </svg>
  );
}

/**
 * Render the Review Logbook page: Basic Information, the entry grouped into sections, and Submit
 * @param {object} props - component props
 * @param {import('./logbookConfig').Purpose} props.purpose - selected purpose
 * @param {import('./logbookConfig').FieldConfig[]} props.fields - visible fields in form order
 * @param {object} props.values - form values
 * @param {string} props.mudpump - selected mud pump
 * @param {string} props.dateTime - value of the datetime-local input
 * @param {boolean} props.isSubmitting - true while the entry is being sent
 * @returns {JSX.Element} review sections and the Submit button (the parent form handles submit)
 */
function LogbookReview({ purpose, fields, values, mudpump, dateTime, isSubmitting }) {
  const sections = buildReviewSections({ purpose, fields, values, mudpump, dateTime });
  return (
    <>
      {sections.map((section) => (
        <section key={section.title} className="lr-section" aria-label={section.title}>
          <h2 className="lr-section__title">{section.title}</h2>
          <dl className="lr-card">
            {section.items.map((item) => (
              <div key={item.name} className={`lr-item${item.wide ? ' lr-item--wide' : ''}`}>
                <dt className="lr-item__label">{item.label}</dt>
                <dd className="lr-item__value">
                  {item.name === 'KCF' && <AlarmIcon status={values.KCF} />}
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <button type="submit" className="lb-btn lb-btn--primary" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting…' : 'Submit'}
      </button>
    </>
  );
}

export default LogbookReview;
