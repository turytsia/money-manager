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
  useCategories,
  useSettings,
  useTransactions,
} from '../../components/StoreProvider/StoreProvider';
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

const GRANULARITY_OPTIONS: ReadonlyArray<SegmentedOption<Granularity>> = [
  { value: Granularity.Day, label: 'Day' },
  { value: Granularity.Week, label: 'Week' },
  { value: Granularity.Month, label: 'Month' },
  { value: Granularity.Year, label: 'Year' },
];

const CHART_TITLE = 'Earned and spent over time';

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
 * What was earned and spent, grouped by day, week, month or year, with the
 * selected period split by category. Tapping a category narrows the chart
 * to it.
 */
export const InsightsScreen: React.FC = () => {
  const transactions = useTransactions();
  const categories = useCategories();
  const { currency } = useSettings();
  const today = useToday();
  const [granularity, setGranularity] = React.useState(Granularity.Month);
  const [selectedStart, setSelectedStart] = React.useState<DayKey | null>(null);
  const [chosenCategoryId, setCategoryId] = React.useState<number | null>(null);
  // The filter turns itself off when its category gets deleted.
  const categoryId =
    chosenCategoryId !== null && categories.byId.has(chosenCategoryId)
      ? chosenCategoryId
      : null;

  // Cheap to run on every render: the heavy sums are cached per data set.
  const insights = buildInsights({
    transactions,
    categories,
    granularity,
    selectedStart,
    categoryId,
    today,
  });
  const earned = insights.breakdown[TransactionKind.Income];

  const handleGranularityChange = (next: Granularity): void => {
    setGranularity(next);
    setSelectedStart(null);
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
      <ScreenHeader title='Insights' />
      <SegmentedControl
        label='Group by'
        options={GRANULARITY_OPTIONS}
        value={granularity}
        onChange={handleGranularityChange}
      />
      <div className={styles.summary}>
        <PeriodSummary
          label={insights.label}
          series={insights.series}
          granularity={granularity}
          currency={currency}
          canGoBack={insights.canGoBack}
          canGoForward={insights.canGoForward}
          onStep={handleStep}
        />
        <BucketChart
          title={CHART_TITLE}
          bars={insights.bars}
          kinds={insights.series.map(({ kind }) => kind)}
          scaleMax={insights.scaleMax}
          selectedStart={insights.selectedStart}
          currency={currency}
          onSelect={setSelectedStart}
        />
        <p className={styles.range}>{insights.rangeLabel}</p>
      </div>
      <div className={styles.sectionHeader}>
        <h2 className={LABEL_STYLE}>Spent by category</h2>
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
        items={insights.breakdown[TransactionKind.Expense]}
        currency={currency}
        selectedCategoryId={categoryId}
        onToggle={handleCategoryToggle}
      />
      {earned.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            <h2 className={LABEL_STYLE}>Earned by category</h2>
          </div>
          <CategoryBreakdown
            items={earned}
            currency={currency}
            selectedCategoryId={categoryId}
            onToggle={handleCategoryToggle}
          />
        </>
      )}
    </section>
  );
};
