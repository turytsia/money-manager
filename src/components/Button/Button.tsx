import * as React from 'react';
import { css, cx } from '@emotion/css';

const styles = {
  base: css`
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 44px;
    padding: 0 16px;
    overflow: hidden;
    border: 1px solid transparent;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: -0.01em;
    white-space: nowrap;
    transition:
      background-color 150ms ease,
      color 150ms ease,
      opacity 150ms ease,
      transform 100ms ease;

    &:active:not(:disabled) {
      transform: scale(0.98);
    }

    &:disabled {
      cursor: default;
    }
  `,
  large: css`
    height: 52px;
    border-radius: var(--radius-m);
    font-size: 16px;
    font-weight: 600;
  `,
  block: css`
    flex: 1;
    width: 100%;
  `,
  primary: css`
    background: var(--color-fg);
    color: var(--color-inverse-fg);

    &:active:not(:disabled) {
      opacity: 0.85;
    }

    &:disabled {
      background: var(--color-surface-raised);
      color: var(--color-fg-tertiary);
    }
  `,
  secondary: css`
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-fg);

    &:active:not(:disabled) {
      background: var(--color-surface-raised);
    }

    &:disabled {
      color: var(--color-fg-tertiary);
    }
  `,
  danger: css`
    border-color: color-mix(in srgb, var(--color-danger) 45%, transparent);
    color: var(--color-danger);

    &:active:not(:disabled) {
      background: color-mix(in srgb, var(--color-danger) 14%, transparent);
    }

    &:disabled {
      border-color: var(--color-border);
      color: var(--color-fg-tertiary);
    }
  `,
};

export enum ButtonVariant {
  Primary = 'primary',
  Secondary = 'secondary',
  Danger = 'danger',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLarge?: boolean;
  /** Stretches the button to fill the space it is given. */
  isBlock?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = ButtonVariant.Secondary,
  isLarge = false,
  isBlock = false,
  className,
  children,
  ...buttonProps
}) => {
  return (
    <button
      type='button'
      className={cx(
        styles.base,
        styles[variant],
        isLarge && styles.large,
        isBlock && styles.block,
        className,
      )}
      {...buttonProps}
    >
      {children}
    </button>
  );
};
