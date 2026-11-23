import * as React from 'react';
import { css, cx } from '@emotion/css';
import {
  CATEGORY_ICON_NAMES,
  CATEGORY_ICONS,
  getIconLabel,
  type CategoryIconName,
} from '../../utilities/categoryIcons';

const ICON_SIZE = 20;

const styles = {
  root: css`
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
  `,
  option: css`
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    border: 1px solid transparent;
    border-radius: 10px;
    color: var(--color-fg-secondary);
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease,
      transform 80ms ease;

    &:active {
      background: var(--color-surface-raised);
      transform: scale(0.94);
    }
  `,
  optionSelected: css`
    border-color: var(--color-fg);
    background: var(--color-surface-raised);
    color: var(--color-fg);
  `,
};

export interface IconPickerProps {
  value: CategoryIconName;
  onChange: (icon: CategoryIconName) => void;
}

export const IconPicker: React.FC<IconPickerProps> = ({ value, onChange }) => {
  return (
    <div role='radiogroup' aria-label='Icon' className={styles.root}>
      {CATEGORY_ICON_NAMES.map((name) => {
        const Icon = CATEGORY_ICONS[name];
        return (
          <button
            key={name}
            type='button'
            role='radio'
            aria-checked={name === value}
            aria-label={getIconLabel(name)}
            className={cx(
              styles.option,
              name === value && styles.optionSelected,
            )}
            onClick={() => onChange(name)}
          >
            <Icon size={ICON_SIZE} strokeWidth={1.75} aria-hidden='true' />
          </button>
        );
      })}
    </div>
  );
};
