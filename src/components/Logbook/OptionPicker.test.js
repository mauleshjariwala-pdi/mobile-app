/**
 * OptionPicker.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
// Prescient Devices imports
import OptionPicker from './OptionPicker';

// More than 8 options, so the sheet has a search box
const BRANDS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India'].map((b) => ({
  label: b,
  value: b.toLowerCase(),
}));

/**
 * Picker that keeps its own value, like the logbook form
 * @param {object} props - OptionPicker props; initial is the starting value
 * @returns {JSX.Element} picker with a label
 */
function Harness({ initial, onChange = () => {}, ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <span id="brand-label">Brand</span>
      <OptionPicker
        id="brand"
        labelId="brand-label"
        label="Brand"
        options={BRANDS}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
        {...props}
      />
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: /^Brand/ });
const sheet = () => screen.getByRole('dialog', { name: 'Brand' });
const search = () => screen.getByRole('combobox', { name: 'Search Brand' });
const optionNames = () =>
  within(sheet())
    .getAllByRole('option')
    .map((o) => o.textContent);

test('single mode: shows the placeholder, then the picked label, and closes on pick', () => {
  const onChange = jest.fn();
  render(<Harness initial="" onChange={onChange} placeholder="Choose a brand" />);
  expect(trigger()).toHaveTextContent('Choose a brand');
  expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger());
  expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(within(sheet()).getByRole('option', { name: 'Delta' }));
  expect(onChange).toHaveBeenCalledWith('delta');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger()).toHaveTextContent('Delta');
  expect(trigger()).toHaveFocus();
});

test('search filters the options and says when nothing matches', () => {
  render(<Harness initial="" />);
  fireEvent.click(trigger());
  fireEvent.change(search(), { target: { value: '  ECH ' } });
  expect(optionNames()).toEqual(['Echo']);
  fireEvent.change(search(), { target: { value: 'zulu' } });
  expect(within(sheet()).queryAllByRole('option')).toHaveLength(0);
  expect(within(sheet()).getByText(/No matches for/)).toHaveTextContent('zulu');
  expect(search()).not.toHaveAttribute('aria-activedescendant');
});

test('arrow keys move the highlight within the list and Enter in the search box picks it', () => {
  const onChange = jest.fn();
  render(<Harness initial="" onChange={onChange} />);
  fireEvent.click(trigger());
  expect(search()).toHaveAttribute('aria-activedescendant', 'brand-option-0');
  fireEvent.keyDown(search(), { key: 'ArrowUp' });
  expect(search()).toHaveAttribute('aria-activedescendant', 'brand-option-0');
  fireEvent.keyDown(search(), { key: 'ArrowDown' });
  fireEvent.keyDown(search(), { key: 'ArrowDown' });
  expect(search()).toHaveAttribute('aria-activedescendant', 'brand-option-2');
  expect(within(sheet()).getByRole('option', { name: 'Charlie' })).toHaveClass('bs-option--active');
  // Hovering moves the highlight too
  fireEvent.mouseEnter(within(sheet()).getByRole('option', { name: 'Bravo' }));
  expect(search()).toHaveAttribute('aria-activedescendant', 'brand-option-1');
  // Down stops at the last option
  for (let i = 0; i < 20; i += 1) fireEvent.keyDown(search(), { key: 'ArrowDown' });
  expect(search()).toHaveAttribute('aria-activedescendant', `brand-option-${BRANDS.length - 1}`);
  fireEvent.keyDown(search(), { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('india');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('Enter with no match picks nothing; Escape closes the sheet', () => {
  const onChange = jest.fn();
  render(<Harness initial="" onChange={onChange} />);
  fireEvent.click(trigger());
  fireEvent.change(search(), { target: { value: 'zulu' } });
  fireEvent.keyDown(search(), { key: 'Enter' });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(sheet(), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('multiple mode: checkboxes, chips with Remove, Clear all and Done', () => {
  render(<Harness initial={[]} multiple />);
  expect(trigger()).toHaveTextContent('Choose');
  fireEvent.click(trigger());
  expect(within(sheet()).getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
  expect(within(sheet()).getByRole('button', { name: 'Clear all' })).toBeDisabled();
  fireEvent.click(within(sheet()).getByRole('option', { name: 'Golf' }));
  fireEvent.click(within(sheet()).getByRole('option', { name: 'Alpha' }));
  // The sheet stays open and keeps the picking order
  expect(within(sheet()).getByRole('option', { name: 'Golf' })).toHaveAttribute('aria-selected', 'true');
  expect(within(sheet()).getByText('2 selected')).toBeInTheDocument();
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Done (2)' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger()).toHaveTextContent('2 selected');
  const chips = () => screen.getByRole('list', { name: 'Selected Brand' });
  const chipNames = () =>
    within(chips())
      .getAllByRole('listitem')
      .map((c) => c.textContent);
  expect(chipNames()).toEqual(['Golf', 'Alpha']);
  // Removing a chip unpicks it
  fireEvent.click(screen.getByRole('button', { name: 'Remove Golf' }));
  expect(chipNames()).toEqual(['Alpha']);
  fireEvent.click(trigger());
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Clear all' }));
  expect(within(sheet()).getByRole('button', { name: 'Done' })).toBeInTheDocument();
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('list', { name: 'Selected Brand' })).not.toBeInTheDocument();
});

test('groups show headings; short lists have no search box; unknown values show as they are', () => {
  const groups = [
    { group: 'Ceramic', options: BRANDS.slice(0, 2) },
    { group: 'Steel', options: BRANDS.slice(2, 3) },
  ];
  render(<Harness initial="legacy-brand" options={BRANDS.slice(0, 3)} groups={groups} />);
  expect(trigger()).toHaveTextContent('legacy-brand');
  fireEvent.click(trigger());
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(within(sheet()).getByRole('group', { name: 'Ceramic' })).toHaveTextContent('AlphaBravo');
  expect(within(sheet()).getByRole('group', { name: 'Steel' })).toHaveTextContent('Charlie');
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
