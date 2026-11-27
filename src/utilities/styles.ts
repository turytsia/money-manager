import { css, keyframes } from '@emotion/css';

const FADE_IN = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

/** The scrolling area of one tab. Content scrolls under the tab bar. */
export const SCREEN_STYLE = css`
  position: absolute;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: calc(var(--safe-top) + 16px) 16px
    calc(var(--tab-bar-height) + var(--safe-bottom) + 24px);
  animation: ${FADE_IN} 180ms ease-out;
`;

export const CARD_STYLE = css`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
`;

/** Small uppercase monospace text used to label sections. */
export const LABEL_STYLE = css`
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-fg-secondary);
`;

/**
 * A one-line text field. 16px text stops iOS from zooming the page in when
 * the field is focused.
 */
export const TEXT_INPUT_STYLE = css`
  width: 100%;
  min-width: 0;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  outline: none;
  background: var(--color-bg);
  font-size: 16px;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;

  &::placeholder {
    color: var(--color-fg-tertiary);
  }

  &:focus {
    border-color: var(--color-fg);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-fg) 12%, transparent);
  }

  &[aria-invalid='true'] {
    border-color: var(--color-danger);
  }
`;

/** Digits of equal width, so columns of numbers line up. */
export const TABULAR_STYLE = css`
  font-variant-numeric: tabular-nums;
`;

export const VISUALLY_HIDDEN_STYLE = css`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;
