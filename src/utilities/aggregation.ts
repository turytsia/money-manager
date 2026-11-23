import { getBucketStart } from './dates';
import { Granularity, type DayKey, type Transaction } from './types';

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

export interface BucketSum {
  amount: number;
  count: number;
}

/** Sums for one period, by category id. */
export type BucketTotals = ReadonlyMap<number, Readonly<BucketSum>>;

/** Totals for each period, keyed by the first day of the period. */
export type BucketIndex = ReadonlyMap<DayKey, BucketTotals>;

type MutableTotals = Map<number, BucketSum>;

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
  const index = new Map<DayKey, MutableTotals>();
  dailyIndex.forEach((dayTotals, day) => {
    const totals = getTotals(index, getBucketStart(day, granularity));
    dayTotals.forEach(({ amount, count }, categoryId) =>
      addToTotals(totals, categoryId, amount, count),
    );
  });
  cache.set(granularity, index);
  return index;
}

/** Adds up one period for the given categories. */
export function sumBucket(
  totals: BucketTotals | undefined,
  categoryIds: Iterable<number>,
): BucketSum {
  let amount = 0;
  let count = 0;
  if (!totals) {
    return { amount, count };
  }
  for (const categoryId of categoryIds) {
    const sum = totals.get(categoryId);
    amount += sum?.amount ?? 0;
    count += sum?.count ?? 0;
  }
  return { amount, count };
}

function getDailyIndex(transactions: ReadonlyArray<Transaction>): BucketIndex {
  const cached = DAILY_INDEX_CACHE.get(transactions);
  if (cached) {
    return cached;
  }
  const index = new Map<DayKey, MutableTotals>();
  for (const { day, categoryId, amount } of transactions) {
    addToTotals(getTotals(index, day), categoryId, amount, 1);
  }
  DAILY_INDEX_CACHE.set(transactions, index);
  return index;
}

function getTotals(
  index: Map<DayKey, MutableTotals>,
  key: DayKey,
): MutableTotals {
  const existing = index.get(key);
  if (existing) {
    return existing;
  }
  const totals: MutableTotals = new Map();
  index.set(key, totals);
  return totals;
}

function addToTotals(
  totals: MutableTotals,
  categoryId: number,
  amount: number,
  count: number,
): void {
  const sum = totals.get(categoryId);
  if (sum) {
    sum.amount += amount;
    sum.count += count;
    return;
  }
  totals.set(categoryId, { amount, count });
}
