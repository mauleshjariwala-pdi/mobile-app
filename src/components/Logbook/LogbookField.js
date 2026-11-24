/**
 * LogbookField.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// Prescient Devices imports
import OptionPicker from './OptionPicker';

/**
 * Render one labelled form field; the control depends on field.type
 * @param {object} props - component props
 * @param {import('./logbookConfig').FieldConfig} props.field - field definition
 * @param {*} props.value - current value
 * @param {(value: *) => void} props.onChange - called with the new value
 * @returns {JSX.Element} field row
 */
function LogbookField({ field, value, onChange }) {
  const id = `lb-${field.name}`;
  const labelId = `${id}-label`;
  let control = null;
  switch (field.type) {
    case 'select':
      control = (
        <select
          id={id}
          className="lb-input lb-select"
          value={String(value)}
          aria-required={field.required || undefined}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value={field.placeholderValue ?? ''}>Choose</option>
          {field.options.map(toOption).map((option) => (
            <option key={option.value} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'picker':
    case 'multipicker':
      control = (
        <OptionPicker
          id={id}
          labelId={labelId}
          label={field.label}
          options={field.options}
          groups={field.groups}
          value={value}
          onChange={onChange}
          multiple={field.type === 'multipicker'}
          placeholder={field.placeholder}
        />
      );
      break;
    case 'number':
      control = (
        <div className="lb-input-group">
          <input
            id={id}
            className="lb-input"
            type="number"
            aria-required={field.required || undefined}
            inputMode={field.integer ? 'numeric' : 'decimal'}
            step={field.integer ? 1 : 'any'}
            min={field.integer ? 0 : undefined}
            placeholder="0"
            // Numeric defaults are 0; show the placeholder instead so the user does not have to delete it
            value={value === 0 ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby={field.hint ? `${id}-hint` : undefined}
          />
          {field.unit && <span className="lb-input-group__unit">{field.unit}</span>}
        </div>
      );
      break;
    case 'toggle':
      control = (
        <div className="lb-segmented" role="radiogroup" aria-labelledby={labelId}>
          {['Yes', 'No'].map((option) => (
            <label
              key={option}
              className={`lb-segmented__option${value === option ? ' lb-segmented__option--active' : ''}`}
            >
              <input
                type="radio"
                name={id}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
      break;
    case 'textarea':
      control = (
        <textarea
          id={id}
          className="lb-input lb-textarea"
          rows={4}
          placeholder="Add any notes…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    default:
      break;
  }
  // Toggles and pickers are labelled through aria-labelledby, so their label is not a <label for>
  const usesLabelElement = !['toggle', 'picker', 'multipicker'].includes(field.type);
  const requiredMark = field.required && (
    <span className="lb-field__required" aria-hidden="true">
      {' '}
      *
    </span>
  );
  return (
    <div className="lb-field">
      {usesLabelElement ? (
        <label id={labelId} htmlFor={id} className="lb-field__label">
          {field.label}
          {requiredMark}
        </label>
      ) : (
        <span id={labelId} className="lb-field__label">
          {field.label}
          {requiredMark}
        </span>
      )}
      <div className="lb-field__control">
        {control}
        {field.hint && (
          <p id={`${id}-hint`} className="lb-field__hint">
            {field.hint}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Normalise an option given as a string or as { label, value }
 * @param {string | import('./logbookOptions').Option} option - option
 * @returns {import('./logbookOptions').Option} option object
 */
function toOption(option) {
  return typeof option === 'object' ? option : { label: option, value: option };
}

export default LogbookField;
