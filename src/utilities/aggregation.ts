import { CATEGORY_SLOT_COUNT, getCategoriesOfKind } from './categories';
import { getBucketStart } from './dates';
import {
  Granularity,
  type DayKey,
  type Transaction,
  type TransactionKind,
} from './types';

// Both caches are keyed by object identity. The transaction list is replaced
// (never mutated) on every change, so entries can never go stale, and they
// are freed together with the list they belong to.
const DAILY_INDEX_CACHE = new WeakMap<
  ReadonlyArray<Transaction>,
  BucketIndex
>();
const BUCKET_INDEX_CACHE = new WeakMap<
  BucketIndex,
  Map<Granularity, BucketIndex>
>();

/** Sums for one period. Both arrays are indexed by category id. */
export interface BucketTotals {
  amounts: Array<number>;
  counts: Array<number>;
}

/** Totals for each period, keyed by the first day of the period. */
export type BucketIndex = ReadonlyMap<DayKey, BucketTotals>;

export interface BucketSum {
  amount: number;
  count: number;
}

/**
 * Totals for every day, week, month or year that has transactions.
 *
 * All transactions are read once to build per-day totals. Larger periods
 * are then built from the days, so switching between them is cheap.
 */
export function getBucketIndex(
  transactions: ReadonlyArray<Transaction>,
  granularity: Granularity,
): BucketIndex {
  const dailyIndex = getDailyIndex(transactions);
  if (granularity === Granularity.Day) {
    return dailyIndex;
  }
  const cache = BUCKET_INDEX_CACHE.get(dailyIndex) ?? new Map();
  BUCKET_INDEX_CACHE.set(dailyIndex, cache);
  const cached = cache.get(granularity);
  if (cached) {
    return cached;
  }
  const index = new Map<DayKey, BucketTotals>();
  dailyIndex.forEach((dayTotals, day) => {
    addTotals(getTotals(index, getBucketStart(day, granularity)), dayTotals);
  });
  cache.set(granularity, index);
  return index;
}

/** Adds up one period for a kind, or for a single category of that kind. */
export function sumBucket(
  totals: BucketTotals | undefined,
  kind: TransactionKind,
  categoryId: number | null,
): BucketSum {
  if (!totals) {
    return { amount: 0, count: 0 };
  }
  if (categoryId !== null) {
    return {
      amount: totals.amounts[categoryId] ?? 0,
      count: totals.counts[categoryId] ?? 0,
    };
  }
  return getCategoriesOfKind(kind).reduce<BucketSum>(
    (sum, { id }) => ({
      amount: sum.amount + totals.amounts[id],
      count: sum.count + totals.counts[id],
    }),
    { amount: 0, count: 0 },
  );
}

function getDailyIndex(transactions: ReadonlyArray<Transaction>): BucketIndex {
  const cached = DAILY_INDEX_CACHE.get(transactions);
  if (cached) {
    return cached;
  }
  const index = new Map<DayKey, BucketTotals>();
  for (const { day, categoryId, amount } of transactions) {
    const totals = getTotals(index, day);
    totals.amounts[categoryId] += amount;
    totals.counts[categoryId] += 1;
  }
  DAILY_INDEX_CACHE.set(transactions, index);
  return index;
}

function getTotals(
  index: Map<DayKey, BucketTotals>,
  key: DayKey,
): BucketTotals {
  const existing = index.get(key);
  if (existing) {
    return existing;
  }
  const totals: BucketTotals = {
    amounts: new Array<number>(CATEGORY_SLOT_COUNT).fill(0),
    counts: new Array<number>(CATEGORY_SLOT_COUNT).fill(0),
  };
  index.set(key, totals);
  return totals;
}

function addTotals(target: BucketTotals, source: BucketTotals): void {
  for (let slot = 0; slot < CATEGORY_SLOT_COUNT; slot += 1) {
    target.amounts[slot] += source.amounts[slot];
    target.counts[slot] += source.counts[slot];
  }
}
