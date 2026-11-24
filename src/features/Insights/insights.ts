import {
  getBucketIndex,
  sumBucket,
  type BucketTotals,
} from '../../utilities/aggregation';
import type { Category, CategoryCatalog } from '../../utilities/categories';
import {
  countBucketsBetween,
  formatBucket,
  formatBucketRange,
  formatBucketTick,
  getBucketStart,
  shiftBucket,
} from '../../utilities/dates';
import {
  TransactionKind,
  type DayKey,
  type Granularity,
  type Transaction,
} from '../../utilities/types';

/** The order the two series are shown in: earned first, then spent. */
export const SERIES_KINDS: ReadonlyArray<TransactionKind> = [
  TransactionKind.Income,
  TransactionKind.Expense,
];

/** How many periods the chart shows at once for each way of grouping. */
export const WINDOW_SIZES: Readonly<Record<Granularity, number>> = {
  day: 14,
  week: 12,
  month: 12,
  year: 6,
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
  /** First day of the chosen period, or null for the one containing today. */
  selectedStart: DayKey | null;
  /** Narrows the chart and totals to one category. */
  categoryId: number | null;
  today: DayKey;
}

export type KindAmounts = Readonly<Record<TransactionKind, number>>;

/** One period of the chart, with what was earned and spent in it. */
export interface ChartBar {
  start: DayKey;
  amounts: KindAmounts;
  /** Short text under the bars. */
  tick: string;
  /** Full name of the period. */
  label: string;
}

/** The figures of one series for the selected period. */
export interface SeriesSummary {
  kind: TransactionKind;
  /** The category the series is narrowed to, while a filter is on. */
  categoryLabel: string | undefined;
  total: number;
  /** Total of the period right before the selected one. */
  previousTotal: number;
}

export interface BreakdownItem {
  category: Category;
  amount: number;
  /** Part of the period's total for that kind, from 0 to 1. */
  share: number;
}

export interface Insights {
  selectedStart: DayKey;
  label: string;
  /** The span of time covered by all periods of the chart. */
  rangeLabel: string;
  /** Both series, or only the one a category filter belongs to. */
  series: Array<SeriesSummary>;
  bars: Array<ChartBar>;
  /** A round number at or above the tallest bar, for the chart's scale. */
  scaleMax: number;
  /** Categories of the selected period for each kind, largest first. */
  breakdown: Readonly<Record<TransactionKind, Array<BreakdownItem>>>;
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
  selectedStart,
  categoryId,
  today,
}: InsightsQuery): Insights {
  const index = getBucketIndex(transactions, granularity);
  const filter =
    categoryId === null ? undefined : categories.byId.get(categoryId);
  const kinds = filter ? [filter.kind] : SERIES_KINDS;
  const getIds = (kind: TransactionKind): Array<number> =>
    filter
      ? [filter].filter((category) => category.kind === kind).map(getId)
      : categories.byKind[kind].map(getId);
  const idsByKind: Readonly<Record<TransactionKind, Array<number>>> = {
    [TransactionKind.Expense]: getIds(TransactionKind.Expense),
    [TransactionKind.Income]: getIds(TransactionKind.Income),
  };
  const getAmounts = (start: DayKey): KindAmounts => {
    const totals = index.get(start);
    return {
      [TransactionKind.Expense]: sumBucket(
        totals,
        idsByKind[TransactionKind.Expense],
      ).amount,
      [TransactionKind.Income]: sumBucket(
        totals,
        idsByKind[TransactionKind.Income],
      ).amount,
    };
  };

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
      amounts: getAmounts(start),
      tick: formatBucketTick(start, granularity),
      label: formatBucket(start, granularity, today),
    };
  });

  const selectedAmounts = getAmounts(selected);
  const previousAmounts = getAmounts(shiftBucket(selected, granularity, -1));
  const selectedTotals = index.get(selected);

  return {
    selectedStart: selected,
    label: formatBucket(selected, granularity, today),
    rangeLabel: formatBucketRange(
      bars[0].start,
      bars[windowSize - 1].start,
      granularity,
    ),
    series: kinds.map((kind) => ({
      kind,
      categoryLabel: filter?.label,
      total: selectedAmounts[kind],
      previousTotal: previousAmounts[kind],
    })),
    bars,
    scaleMax: getNiceCeiling(
      Math.max(
        ...bars.flatMap(({ amounts }) => kinds.map((kind) => amounts[kind])),
      ),
    ),
    breakdown: {
      [TransactionKind.Expense]: getBreakdown(
        selectedTotals,
        categories.byKind[TransactionKind.Expense],
      ),
      [TransactionKind.Income]: getBreakdown(
        selectedTotals,
        categories.byKind[TransactionKind.Income],
      ),
    },
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
  const kindTotal = sumBucket(totals, kindCategories.map(getId)).amount;
  return kindCategories
    .flatMap((category) => {
      const amount = totals.get(category.id)?.amount ?? 0;
      return amount > 0
        ? [{ category, amount, share: amount / kindTotal }]
        : [];
    })
    .sort((a, b) => b.amount - a.amount);
}

function getId({ id }: Category): number {
  return id;
}
