import * as React from 'react';
import { css, cx } from '@emotion/css';
import {
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatMoney } from '../../utilities/money';
import { TABULAR_STYLE } from '../../utilities/styles';
import { formatCount } from '../../utilities/text';
import { TransactionKind, type Granularity } from '../../utilities/types';

const PERCENT = 100;

const styles = {
  navigation: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  `,
  stepButton: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--color-border);
    border-radius: 18px;
    transition:
      background-color 120ms ease,
      opacity 120ms ease;

    &:active:not(:disabled) {
      background: var(--color-surface-raised);
    }

    &:disabled {
      opacity: 0.3;
      cursor: default;
    }
  `,
  period: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    text-align: center;
  `,
  filter: css`
    color: var(--color-fg-secondary);
    font-size: 12px;
    font-weight: 500;
  `,
  // The one headline number of the screen. Its digits keep their natural
  // widths, which reads better at this size than equal-width digits.
  total: css`
    margin-top: 14px;
    font-size: clamp(44px, 13.5vw, 56px);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.05em;
    text-align: center;
  `,
  comparison: css`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 20px;
    margin-top: 6px;
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
  // Shown with an arrow and words, so the meaning never rests on color alone.
  better: css`
    color: var(--color-success);
  `,
  worse: css`
    color: var(--color-danger);
  `,
  facts: css`
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2px 14px;
    margin-top: 4px;
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
};

export interface PeriodSummaryProps {
  label: string;
  /** The category the numbers are narrowed to, when a filter is on. */
  filterLabel: string | undefined;
  total: number;
  previousTotal: number;
  averagePerDay: number | null;
  count: number;
  granularity: Granularity;
  kind: TransactionKind;
  currency: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onStep: (direction: -1 | 1) => void;
}

interface ComparisonProps {
  total: number;
  previousTotal: number;
  granularity: Granularity;
  kind: TransactionKind;
}

/** The selected period: its name, total, and how it compares. */
export const PeriodSummary: React.FC<PeriodSummaryProps> = ({
  label,
  filterLabel,
  total,
  previousTotal,
  averagePerDay,
  count,
  granularity,
  kind,
  currency,
  canGoBack,
  canGoForward,
  onStep,
}) => {
  return (
    <div>
      <div className={styles.navigation}>
        <button
          type='button'
          aria-label={`Previous ${granularity}`}
          className={styles.stepButton}
          disabled={!canGoBack}
          onClick={() => onStep(-1)}
        >
          <ChevronLeft size={18} aria-hidden='true' />
        </button>
        <h2 className={styles.period}>
          {label}
          {filterLabel && <span className={styles.filter}>{filterLabel}</span>}
        </h2>
        <button
          type='button'
          aria-label={`Next ${granularity}`}
          className={styles.stepButton}
          disabled={!canGoForward}
          onClick={() => onStep(1)}
        >
          <ChevronRight size={18} aria-hidden='true' />
        </button>
      </div>
      <p className={styles.total}>{formatMoney(total, currency)}</p>
      <Comparison
        total={total}
        previousTotal={previousTotal}
        granularity={granularity}
        kind={kind}
      />
      <p className={cx(styles.facts, TABULAR_STYLE)}>
        {averagePerDay !== null && (
          <span>{formatMoney(averagePerDay, currency)} per day</span>
        )}
        <span>{formatCount(count, 'transaction')}</span>
      </p>
    </div>
  );
};

const Comparison: React.FC<ComparisonProps> = ({
  total,
  previousTotal,
  granularity,
  kind,
}) => {
  if (previousTotal === 0 || total === previousTotal) {
    return (
      <p className={styles.comparison}>
        {previousTotal === 0
          ? `Nothing in the previous ${granularity}`
          : `Same as the previous ${granularity}`}
      </p>
    );
  }
  const isHigher = total > previousTotal;
  const percent = Math.round(
    (Math.abs(total - previousTotal) / previousTotal) * PERCENT,
  );
  // Spending more is the bad direction; earning more is the good one.
  const isBetter = isHigher === (kind === TransactionKind.Income);
  const Icon = isHigher ? TrendingUp : TrendingDown;

  return (
    <p className={styles.comparison}>
      <Icon
        size={15}
        aria-hidden='true'
        className={isBetter ? styles.better : styles.worse}
      />
      {percent.toLocaleString('en-US')}% {isHigher ? 'more' : 'less'} than the
      previous {granularity}
    </p>
  );
};
