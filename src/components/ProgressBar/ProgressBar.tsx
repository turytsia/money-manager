import * as React from 'react';
import { css, cx } from '@emotion/css';

const PERCENT = 100;

// A tiny value still gets a visible sliver instead of disappearing.
const MIN_VISIBLE_PERCENT = 2;

const styles = {
  root: css`
    width: 100%;
    color: var(--color-fg);
  `,
  // The track is a faint step of the fill color, so the state reads across
  // the whole bar and not only on the filled part.
  track: css`
    fill: currentColor;
    opacity: 0.14;
  `,
  fill: css`
    fill: currentColor;
    transition: width 400ms var(--ease-out);
  `,
};

export interface ProgressBarProps {
  /** How full the bar is, from 0 to 1. */
  ratio: number;
  /** Says what the bar shows, for screen readers. */
  label: string;
  height?: number;
  /** Sets the color of the bar through the text color. */
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  ratio,
  label,
  height = 8,
  className,
}) => {
  const percent = toPercent(ratio);

  return (
    <svg
      role='progressbar'
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={PERCENT}
      aria-valuenow={Math.round(percent)}
      height={height}
      className={cx(styles.root, className)}
    >
      <rect
        className={styles.track}
        width='100%'
        height={height}
        rx={height / 2}
      />
      <rect
        className={styles.fill}
        width={`${percent}%`}
        height={height}
        rx={height / 2}
      />
    </svg>
  );
};

function toPercent(ratio: number): number {
  if (!(ratio > 0)) {
    return 0;
  }
  return Math.min(PERCENT, Math.max(MIN_VISIBLE_PERCENT, ratio * PERCENT));
}
