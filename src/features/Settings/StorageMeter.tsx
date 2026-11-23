import * as React from 'react';
import { css } from '@emotion/css';
import {
  ProgressBar,
  ProgressTone,
} from '../../components/ProgressBar/ProgressBar';
import {
  useSettings,
  useTransactions,
} from '../../components/StoreProvider/StoreProvider';
import { measureStorage } from '../../utilities/storage';
import { TABULAR_STYLE } from '../../utilities/styles';
import { formatCount } from '../../utilities/text';

const PERCENT = 100;
const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;
const WARNING_RATIO = 0.8;
const DANGER_RATIO = 0.95;

const styles = {
  header: css`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  `,
  free: css`
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.03em;
  `,
  used: css`
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
  note: css`
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
};

/**
 * Shows how much of the device's storage for this app is used and how much
 * is left, so it is clear well ahead of time when a bigger kind of storage
 * would be needed.
 */
export const StorageMeter: React.FC = () => {
  const transactions = useTransactions();
  // Saved settings take up space too, so a change to them is a reason to
  // measure again.
  useSettings();
  const usage = measureStorage(transactions.length);
  const freePercent = formatPercent(1 - usage.usedRatio);

  return (
    <>
      <div className={styles.header}>
        <span className={styles.free}>{freePercent}% free</span>
        <span className={`${styles.used} ${TABULAR_STYLE}`}>
          {formatBytes(usage.usedBytes)} of {formatBytes(usage.quotaBytes)} used
        </span>
      </div>
      <ProgressBar
        ratio={usage.usedRatio}
        label='Storage used'
        tone={getTone(usage.usedRatio)}
      />
      <p className={styles.note}>
        {formatCount(transactions.length, 'transaction')} saved. Room for about{' '}
        {formatCount(usage.remainingTransactions, 'more transaction')}.
      </p>
    </>
  );
};

function getTone(usedRatio: number): ProgressTone {
  if (usedRatio >= DANGER_RATIO) {
    return ProgressTone.Danger;
  }
  return usedRatio >= WARNING_RATIO
    ? ProgressTone.Warning
    : ProgressTone.Neutral;
}

/** Rounds down, so the free space shown is never more than there is. */
function formatPercent(ratio: number): string {
  const percent = ratio * PERCENT;
  return percent > 99 && percent < PERCENT
    ? (Math.floor(percent * 10) / 10).toFixed(1)
    : String(Math.floor(percent));
}

function formatBytes(bytes: number): string {
  if (bytes < KILOBYTE) {
    return `${bytes} B`;
  }
  if (bytes < MEGABYTE) {
    return `${(bytes / KILOBYTE).toFixed(1)} KB`;
  }
  const megabytes = bytes / MEGABYTE;
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(2)} MB`;
}
