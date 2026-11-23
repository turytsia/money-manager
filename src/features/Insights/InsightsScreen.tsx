import * as React from 'react';
import { css, cx } from '@emotion/css';
import { ChartColumn } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ScreenHeader } from '../../components/ScreenHeader/ScreenHeader';
import {
  SegmentedControl,
  type SegmentedOption,
} from '../../components/SegmentedControl/SegmentedControl';
import {
  useSettings,
  useTransactions,
} from '../../components/StoreProvider/StoreProvider';
import { getCategory } from '../../utilities/categories';
import { shiftBucket } from '../../utilities/dates';
import { CARD_STYLE, LABEL_STYLE, SCREEN_STYLE } from '../../utilities/styles';
import {
  Granularity,
  TransactionKind,
  type DayKey,
} from '../../utilities/types';
import { useToday } from '../../utilities/useToday';
import { BucketChart } from './BucketChart';
import { CategoryBreakdown } from './CategoryBreakdown';
import { buildInsights } from './insights';
import { PeriodSummary } from './PeriodSummary';

const KIND_OPTIONS: ReadonlyArray<SegmentedOption<TransactionKind>> = [
  { value: TransactionKind.Expense, label: 'Spent' },
  { value: TransactionKind.Income, label: 'Earned' },
];

const GRANULARITY_OPTIONS: ReadonlyArray<SegmentedOption<Granularity>> = [
  { value: Granularity.Day, label: 'Day' },
  { value: Granularity.Week, label: 'Week' },
  { value: Granularity.Month, label: 'Month' },
  { value: Granularity.Year, label: 'Year' },
];

const CHART_TITLES: Readonly<Record<TransactionKind, string>> = {
  [TransactionKind.Expense]: 'Spending over time',
  [TransactionKind.Income]: 'Income over time',
};

const styles = {
  summary: cx(
    CARD_STYLE,
    css`
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-top: 12px;
      padding: 16px;
    `,
  ),
  range: css`
    color: var(--color-fg-tertiary);
    font-size: 12px;
    text-align: center;
  `,
  sectionHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 28px;
    margin: 24px 4px 8px;
  `,
  clearFilter: css`
    height: 28px;
    padding: 0 10px;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    color: var(--color-fg-secondary);
    font-size: 12px;
    font-weight: 500;

    &:active {
      background: var(--color-surface-raised);
    }
  `,
};

/**
 * Totals grouped by day, week, month or year, with the selected period
 * split by category. Tapping a category narrows everything to it.
 */
export const InsightsScreen: React.FC = () => {
  const transactions = useTransactions();
  const { currency } = useSettings();
  const today = useToday();
  const [granularity, setGranularity] = React.useState(Granularity.Month);
  const [kind, setKind] = React.useState(TransactionKind.Expense);
  const [selectedStart, setSelectedStart] = React.useState<DayKey | null>(null);
  const [categoryId, setCategoryId] = React.useState<number | null>(null);

  // Cheap to run on every render: the heavy sums are cached per data set.
  const insights = buildInsights({
    transactions,
    granularity,
    kind,
    selectedStart,
    categoryId,
    today,
  });

  const handleGranularityChange = (next: Granularity): void => {
    setGranularity(next);
    setSelectedStart(null);
  };

  const handleKindChange = (next: TransactionKind): void => {
    setKind(next);
    setCategoryId(null);
  };

  const handleStep = (direction: -1 | 1): void => {
    setSelectedStart(
      shiftBucket(insights.selectedStart, granularity, direction),
    );
  };

  const handleCategoryToggle = (toggledId: number): void => {
    setCategoryId((current) => (current === toggledId ? null : toggledId));
  };

  if (transactions.length === 0) {
    return (
      <section aria-label='Insights' className={SCREEN_STYLE}>
        <ScreenHeader title='Insights' />
        <EmptyState
          icon={ChartColumn}
          title='Nothing to show yet'
          description='Add a few expenses to see where your money goes.'
        />
      </section>
    );
  }

  return (
    <section aria-label='Insights' className={SCREEN_STYLE}>
      <ScreenHeader title='Insights'>
        <SegmentedControl
          label='Type'
          options={KIND_OPTIONS}
          value={kind}
          isCompact
          onChange={handleKindChange}
        />
      </ScreenHeader>
      <SegmentedControl
        label='Group by'
        options={GRANULARITY_OPTIONS}
        value={granularity}
        onChange={handleGranularityChange}
      />
      <div className={styles.summary}>
        <PeriodSummary
          label={insights.label}
          filterLabel={
            categoryId === null ? undefined : getCategory(categoryId).label
          }
          total={insights.total}
          previousTotal={insights.previousTotal}
          averagePerDay={insights.averagePerDay}
          count={insights.count}
          granularity={granularity}
          kind={kind}
          currency={currency}
          canGoBack={insights.canGoBack}
          canGoForward={insights.canGoForward}
          onStep={handleStep}
        />
        <BucketChart
          title={CHART_TITLES[kind]}
          bars={insights.bars}
          scaleMax={insights.scaleMax}
          selectedStart={insights.selectedStart}
          currency={currency}
          onSelect={setSelectedStart}
        />
        <p className={styles.range}>{insights.rangeLabel}</p>
      </div>
      <div className={styles.sectionHeader}>
        <h2 className={LABEL_STYLE}>By category</h2>
        {categoryId !== null && (
          <button
            type='button'
            className={styles.clearFilter}
            onClick={() => setCategoryId(null)}
          >
            Clear filter
          </button>
        )}
      </div>
      <CategoryBreakdown
        items={insights.breakdown}
        currency={currency}
        selectedCategoryId={categoryId}
        onToggle={handleCategoryToggle}
      />
    </section>
  );
};
