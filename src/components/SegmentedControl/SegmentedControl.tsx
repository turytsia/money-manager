import * as React from 'react';
import { css, cx } from '@emotion/css';
import type { LucideIcon } from 'lucide-react';

const ICON_SIZE = 15;

const styles = {
  root: css`
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-surface);
  `,
  option: css`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 36px;
    padding: 0 12px;
    border-radius: 7px;
    color: var(--color-fg-secondary);
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    transition:
      background-color 150ms ease,
      color 150ms ease;
  `,
  optionCompact: css`
    height: 28px;
    padding: 0 10px;
    font-size: 13px;
  `,
  optionSelected: css`
    background: var(--color-surface-raised);
    color: var(--color-fg);
  `,
};

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for screen readers. It is not shown. */
  label: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  isCompact?: boolean;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  isCompact = false,
  onChange,
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div role='radiogroup' aria-label={label} className={styles.root}>
      {options.map((option) => (
        <button
          key={option.value}
          type='button'
          role='radio'
          aria-checked={option.value === value}
          className={cx(
            styles.option,
            isCompact && styles.optionCompact,
            option.value === value && styles.optionSelected,
          )}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <option.icon size={ICON_SIZE} aria-hidden='true' />}
          {option.label}
        </button>
      ))}
    </div>
  );
}
