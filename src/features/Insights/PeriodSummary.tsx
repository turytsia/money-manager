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
import { TransactionKind, type Granularity } from '../../utilities/types';
import { SERIES_LABELS } from './BucketChart';
import type { SeriesSummary } from './insights';

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
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    text-align: center;
  `,
  series: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
  `,
  row: css`
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: baseline;
    column-gap: 8px;
  `,
  // The square in the color of the series' bars. Together with the name
  // beside it, it is the chart's legend.
  swatch: css`
    width: 10px;
    height: 10px;
    border-radius: 3px;
  `,
  [TransactionKind.Income]: css`
    background: var(--color-series-earned);
  `,
  [TransactionKind.Expense]: css`
    background: var(--color-series-spent);
  `,
  name: css`
    color: var(--color-fg-secondary);
    font-size: 14px;
  `,
  total: css`
    font-size: 24px;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.03em;
  `,
  comparison: css`
    display: flex;
    grid-column: 2 / -1;
    align-items: center;
    gap: 6px;
    min-height: 18px;
    color: var(--color-fg-tertiary);
    font-size: 12px;
  `,
  // Shown with an arrow and words, so the meaning never rests on color alone.
  better: css`
    color: var(--color-success);
  `,
  worse: css`
    color: var(--color-danger);
  `,
};

export interface PeriodSummaryProps {
  label: string;
  /** One entry per series drawn in the chart. */
  series: ReadonlyArray<SeriesSummary>;
  granularity: Granularity;
  currency: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onStep: (direction: -1 | 1) => void;
}

interface SeriesRowProps {
  summary: SeriesSummary;
  granularity: Granularity;
  currency: string;
}

/**
 * The selected period: its name, what was earned and spent in it, and how
 * each compares with the period before.
 */
export const PeriodSummary: React.FC<PeriodSummaryProps> = ({
  label,
  series,
  granularity,
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
        <h2 className={styles.period}>{label}</h2>
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
      <div className={styles.series}>
        {series.map((summary) => (
          <SeriesRow
            key={summary.kind}
            summary={summary}
            granularity={granularity}
            currency={currency}
          />
        ))}
      </div>
    </div>
  );
};

const SeriesRow: React.FC<SeriesRowProps> = ({
  summary,
  granularity,
  currency,
}) => {
  const { kind, categoryLabel, total, previousTotal } = summary;
  const isHigher = total > previousTotal;
  // Spending more is the bad direction; earning more is the good one.
  const isBetter = isHigher === (kind === TransactionKind.Income);
  const hasChange = previousTotal > 0 && total !== previousTotal;

  return (
    <div className={styles.row}>
      <span className={cx(styles.swatch, styles[kind])} aria-hidden='true' />
      <span className={styles.name}>
        {categoryLabel ?? SERIES_LABELS[kind]}
      </span>
      <span className={cx(styles.total, TABULAR_STYLE)}>
        {formatMoney(total, currency)}
      </span>
      <span className={styles.comparison}>
        {hasChange && isHigher && (
          <TrendingUp
            size={14}
            aria-hidden='true'
            className={isBetter ? styles.better : styles.worse}
          />
        )}
        {hasChange && !isHigher && (
          <TrendingDown
            size={14}
            aria-hidden='true'
            className={isBetter ? styles.better : styles.worse}
          />
        )}
        {getComparison(total, previousTotal, granularity)}
      </span>
    </div>
  );
};

function getComparison(
  total: number,
  previousTotal: number,
  granularity: Granularity,
): string {
  if (previousTotal === 0) {
    return `Nothing in the previous ${granularity}`;
  }
  if (total === previousTotal) {
    return `Same as the previous ${granularity}`;
  }
  const percent = Math.round(
    (Math.abs(total - previousTotal) / previousTotal) * PERCENT,
  );
  const direction = total > previousTotal ? 'more' : 'less';
  return `${percent.toLocaleString('en-US')}% ${direction} than the previous ${granularity}`;
}
