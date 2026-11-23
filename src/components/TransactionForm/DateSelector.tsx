import * as React from 'react';
import { css, cx } from '@emotion/css';
import { CalendarDays } from 'lucide-react';
import {
  formatShortDay,
  parseIsoDate,
  shiftDay,
  toIsoDate,
} from '../../utilities/dates';
import type { DayKey } from '../../utilities/types';

const styles = {
  root: css`
    display: flex;
    flex-shrink: 0;
    justify-content: center;
    gap: 8px;
  `,
  chip: css`
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border: 1px solid var(--color-border);
    border-radius: 17px;
    color: var(--color-fg-secondary);
    font-size: 13px;
    font-weight: 500;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  `,
  chipSelected: css`
    border-color: var(--color-fg);
    background: var(--color-surface-raised);
    color: var(--color-fg);
  `,
  // The real date field covers its chip but is invisible, so a tap on the
  // chip opens the system date picker.
  dateInput: css`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    font-size: 16px;
  `,
};

export interface DateSelectorProps {
  /** The chosen day, or null to follow today. */
  day: DayKey | null;
  today: DayKey;
  onChange: (day: DayKey | null) => void;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  day,
  today,
  onChange,
}) => {
  const selectedDay = day ?? today;
  const yesterday = shiftDay(today, -1);
  const isOtherDay = selectedDay !== today && selectedDay !== yesterday;

  const handleDateChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const pickedDay = parseIsoDate(event.target.value);
    if (pickedDay !== undefined) {
      onChange(pickedDay === today ? null : pickedDay);
    }
  };

  return (
    <div role='group' aria-label='Date' className={styles.root}>
      <button
        type='button'
        aria-pressed={selectedDay === today}
        className={cx(
          styles.chip,
          selectedDay === today && styles.chipSelected,
        )}
        onClick={() => onChange(null)}
      >
        Today
      </button>
      <button
        type='button'
        aria-pressed={selectedDay === yesterday}
        className={cx(
          styles.chip,
          selectedDay === yesterday && styles.chipSelected,
        )}
        onClick={() => onChange(yesterday)}
      >
        Yesterday
      </button>
      <label className={cx(styles.chip, isOtherDay && styles.chipSelected)}>
        <CalendarDays size={15} aria-hidden='true' />
        {isOtherDay ? formatShortDay(selectedDay) : 'Other'}
        <input
          type='date'
          aria-label='Pick a date'
          className={styles.dateInput}
          value={toIsoDate(selectedDay)}
          onChange={handleDateChange}
          onClick={openDatePicker}
        />
      </label>
    </div>
  );
};

function openDatePicker(event: React.MouseEvent<HTMLInputElement>): void {
  try {
    event.currentTarget.showPicker();
  } catch {
    // Not every browser can open the picker from code; a tap still works.
  }
}
