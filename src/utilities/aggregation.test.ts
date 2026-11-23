import { describe, expect, it } from 'vitest';
import { createTransaction } from '../test/mocks/transaction';
import { getBucketIndex, sumBucket } from './aggregation';
import { Granularity, TransactionKind } from './types';

const FOOD = 1;
const GROCERIES = 2;
const SALARY = 10;

// 23 November 2026 is a Monday, so the 22nd belongs to the week before.
const TRANSACTIONS = [
  createTransaction({
    id: 'a1',
    day: 20261123,
    categoryId: FOOD,
    amount: 1000,
  }),
  createTransaction({
    id: 'a2',
    day: 20261123,
    categoryId: GROCERIES,
    amount: 3000,
  }),
  createTransaction({ id: 'a3', day: 20261122, categoryId: FOOD, amount: 500 }),
  createTransaction({
    id: 'a4',
    day: 20261015,
    categoryId: FOOD,
    amount: 2000,
  }),
  createTransaction({ id: 'a5', day: 20251231, categoryId: FOOD, amount: 700 }),
  createTransaction({
    id: 'a6',
    day: 20261101,
    categoryId: SALARY,
    amount: 90000,
  }),
];

describe('aggregation', () => {
  it.each([
    [Granularity.Day, 20261123, 4000, 2],
    [Granularity.Week, 20261123, 4000, 2],
    [Granularity.Week, 20261116, 500, 1],
    [Granularity.Month, 20261101, 4500, 3],
    [Granularity.Year, 20260101, 6500, 4],
    [Granularity.Year, 20250101, 700, 1],
  ])(
    'should total expenses per %s: the one starting %i is %i over %i transactions',
    (granularity, start, amount, count) => {
      const totals = getBucketIndex(TRANSACTIONS, granularity).get(start);

      expect(sumBucket(totals, TransactionKind.Expense, null)).toEqual({
        amount,
        count,
      });
    },
  );

  it('should keep income apart from expenses', () => {
    const totals = getBucketIndex(TRANSACTIONS, Granularity.Month).get(
      20261101,
    );

    expect(sumBucket(totals, TransactionKind.Income, null)).toEqual({
      amount: 90000,
      count: 1,
    });
  });

  it('should total a single category when one is given', () => {
    const totals = getBucketIndex(TRANSACTIONS, Granularity.Month).get(
      20261101,
    );

    expect(sumBucket(totals, TransactionKind.Expense, FOOD)).toEqual({
      amount: 1500,
      count: 2,
    });
  });

  it('should total a period without transactions as zero', () => {
    const totals = getBucketIndex(TRANSACTIONS, Granularity.Month).get(
      20260901,
    );

    expect(sumBucket(totals, TransactionKind.Expense, null)).toEqual({
      amount: 0,
      count: 0,
    });
  });

  it('should reuse the result while the transactions are unchanged', () => {
    expect(getBucketIndex(TRANSACTIONS, Granularity.Week)).toBe(
      getBucketIndex(TRANSACTIONS, Granularity.Week),
    );
  });
});
