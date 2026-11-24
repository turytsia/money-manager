import * as React from 'react';
import { css, cx } from '@emotion/css';

const styles = {
  root: css`
    position: relative;
    flex-shrink: 0;
    width: 44px;
    height: 26px;
    border: 1px solid var(--color-border-strong);
    border-radius: 13px;
    background: var(--color-surface-raised);
    transition:
      background-color 180ms ease,
      border-color 180ms ease;

    /* Makes the area that reacts to a tap bigger than the switch looks. */
    &::before {
      content: '';
      position: absolute;
      inset: -10px -8px;
    }

    &::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--color-fg-secondary);
      transition:
        background-color 180ms ease,
        transform 200ms var(--ease-out);
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `,
  on: css`
    border-color: var(--color-fg);
    background: var(--color-fg);

    &::after {
      background: var(--color-inverse-fg);
      transform: translateX(18px);
    }
  `,
};

export interface SwitchProps {
  /** Says what the switch controls, for screen readers. It is not shown. */
  label: string;
  isOn: boolean;
  isDisabled?: boolean;
  onChange: (isOn: boolean) => void;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  isOn,
  isDisabled = false,
  onChange,
}) => {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={isOn}
      aria-label={label}
      disabled={isDisabled}
      className={cx(styles.root, isOn && styles.on)}
      onClick={() => onChange(!isOn)}
    />
  );
};
