import * as React from 'react';
import { css } from '@emotion/css';
import { Delete } from 'lucide-react';
import {
  BACKSPACE_KEY,
  DECIMAL_KEY,
  KEYPAD_KEYS,
  type KeypadKey,
} from '../../utilities/amountInput';

const KEY_LABELS: Partial<Record<KeypadKey, string>> = {
  [DECIMAL_KEY]: 'Decimal point',
  [BACKSPACE_KEY]: 'Delete last digit',
};

const styles = {
  root: css`
    display: grid;
    flex-shrink: 0;
    grid-template-columns: repeat(3, 1fr);
    /* Keys shrink on short screens so the whole form fits without scrolling. */
    grid-auto-rows: clamp(44px, 6.6dvh, 58px);
    gap: 6px;
  `,
  key: css`
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-m);
    background: var(--color-surface);
    font-size: 24px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    transition:
      background-color 80ms ease,
      transform 80ms ease;

    &:active {
      background: var(--color-surface-raised);
      transform: scale(0.97);
    }
  `,
};

export interface KeypadProps {
  onKey: (key: KeypadKey) => void;
}

/**
 * An on-screen number pad. It is used instead of the system keyboard, which
 * is slow to appear and would cover half of the form.
 */
export const Keypad: React.FC<KeypadProps> = ({ onKey }) => {
  return (
    <div role='group' aria-label='Amount keypad' className={styles.root}>
      {KEYPAD_KEYS.map((key) => (
        <button
          key={key}
          type='button'
          aria-label={KEY_LABELS[key]}
          className={styles.key}
          onClick={() => onKey(key)}
        >
          {key === BACKSPACE_KEY ? (
            <Delete size={24} strokeWidth={1.75} aria-hidden='true' />
          ) : (
            key
          )}
        </button>
      ))}
    </div>
  );
};
