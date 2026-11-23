import {
  getBucketIndex,
  sumBucket,
  type BucketTotals,
} from '../../utilities/aggregation';
import type { Category, CategoryCatalog } from '../../utilities/categories';
import {
  countBucketsBetween,
  countElapsedDays,
  formatBucket,
  formatBucketRange,
  formatBucketTick,
  getBucketStart,
  shiftBucket,
} from '../../utilities/dates';
import {
  Granularity,
  type DayKey,
  type Transaction,
  type TransactionKind,
} from '../../utilities/types';

/** How many bars the chart shows at once for each way of grouping. */
export const WINDOW_SIZES: Readonly<Record<Granularity, number>> = {
  [Granularity.Day]: 14,
  [Granularity.Week]: 12,
  [Granularity.Month]: 12,
  [Granularity.Year]: 6,
};

// Every step, and half of it, is a clean number, so the chart's scale and
// its midline can both be labelled without rounding.
const NICE_STEPS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10] as const;

/** The scale used while there is nothing to show yet (1.00 in money). */
const EMPTY_SCALE_MAX = 100;

export interface InsightsQuery {
  transactions: ReadonlyArray<Transaction>;
  categories: CategoryCatalog;
  granularity: Granularity;
  kind: TransactionKind;
  /** First day of the chosen period, or null for the one containing today. */
  selectedStart: DayKey | null;
  /** Narrows the chart and totals to one category. */
  categoryId: number | null;
  today: DayKey;
}

export interface ChartBar {
  start: DayKey;
  amount: number;
  /** Short text under the bar. */
  tick: string;
  /** Full name of the period. */
  label: string;
}

export interface BreakdownItem {
  category: Category;
  amount: number;
  count: number;
  /** Part of the period's total, from 0 to 1. */
  share: number;
}

export interface Insights {
  selectedStart: DayKey;
  label: string;
  /** The span of time covered by all bars of the chart. */
  rangeLabel: string;
  bars: Array<ChartBar>;
  /** A round number at or above the tallest bar, for the chart's scale. */
  scaleMax: number;
  total: number;
  count: number;
  /** Total of the period right before the selected one. */
  previousTotal: number;
  /** Null for single days, where an average per day says nothing. */
  averagePerDay: number | null;
  /** Categories of the selected period, largest first. */
  breakdown: Array<BreakdownItem>;
  canGoBack: boolean;
  canGoForward: boolean;
}

/**
 * Works out everything the Insights screen shows for one selection.
 *
 * The chart shows a fixed-size page of periods. Pages are counted back from
 * the latest period, so the selected period always lands on the same page
 * and bars do not shift around while stepping through time.
 */
export function buildInsights({
  transactions,
  categories,
  granularity,
  kind,
  selectedStart,
  categoryId,
  today,
}: InsightsQuery): Insights {
  const index = getBucketIndex(transactions, granularity);
  const kindCategories = categories.byKind[kind];
  const categoryIds =
    categoryId === null ? kindCategories.map(({ id }) => id) : [categoryId];
  const currentStart = getBucketStart(today, granularity);
  const starts = [...index.keys()];
  const earliestStart = starts.reduce(
    (earliest, start) => Math.min(earliest, start),
    currentStart,
  );
  const latestStart = starts.reduce(
    (latest, start) => Math.max(latest, start),
    currentStart,
  );
  const selected = Math.min(
    latestStart,
    Math.max(earliestStart, selectedStart ?? currentStart),
  );

  const windowSize = WINDOW_SIZES[granularity];
  const pageIndex = Math.floor(
    countBucketsBetween(selected, latestStart, granularity) / windowSize,
  );
  const windowEnd = shiftBucket(
    latestStart,
    granularity,
    -pageIndex * windowSize,
  );
  const bars = Array.from({ length: windowSize }, (_, position): ChartBar => {
    const start = shiftBucket(
      windowEnd,
      granularity,
      position - (windowSize - 1),
    );
    return {
      start,
      amount: sumBucket(index.get(start), categoryIds).amount,
      tick: formatBucketTick(start, granularity),
      label: formatBucket(start, granularity, today),
    };
  });

  const selectedTotals = index.get(selected);
  const { amount: total, count } = sumBucket(selectedTotals, categoryIds);
  const previousStart = shiftBucket(selected, granularity, -1);

  return {
    selectedStart: selected,
    label: formatBucket(selected, granularity, today),
    rangeLabel: formatBucketRange(
      bars[0].start,
      bars[windowSize - 1].start,
      granularity,
    ),
    bars,
    scaleMax: getNiceCeiling(Math.max(...bars.map(({ amount }) => amount))),
    total,
    count,
    previousTotal: sumBucket(index.get(previousStart), categoryIds).amount,
    averagePerDay:
      granularity === Granularity.Day
        ? null
        : Math.round(total / countElapsedDays(selected, granularity, today)),
    breakdown: getBreakdown(selectedTotals, kindCategories),
    canGoBack: selected > earliestStart,
    canGoForward: selected < latestStart,
  };
}

/** Rounds up to a tidy number, such as 1.5, 2 or 3 times a power of ten. */
export function getNiceCeiling(value: number): number {
  if (value <= 0) {
    return EMPTY_SCALE_MAX;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = NICE_STEPS.find((candidate) => value <= candidate * magnitude);
  return (step ?? 10) * magnitude;
}

function getBreakdown(
  totals: BucketTotals | undefined,
  kindCategories: ReadonlyArray<Category>,
): Array<BreakdownItem> {
  if (!totals) {
    return [];
  }
  const kindTotal = sumBucket(
    totals,
    kindCategories.map(({ id }) => id),
  ).amount;
  return kindCategories
    .flatMap((category) => {
      const sum = totals.get(category.id);
      if (!sum || sum.amount === 0) {
        return [];
      }
      const { amount, count } = sum;
      return [{ category, amount, count, share: amount / kindTotal }];
    })
    .sort((a, b) => b.amount - a.amount);
}
