import { describe, expect, it } from 'vitest';
import { createTransaction } from '../../test/mocks/transaction';
import { Granularity, TransactionKind } from '../../utilities/types';
import { buildInsights, getNiceCeiling, type InsightsQuery } from './insights';

const FOOD = 1;
const GROCERIES = 2;
const SALARY = 10;

// "Today" is Monday, 23 November 2026.
const TODAY = 20261123;

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
  createTransaction({ id: 'a3', day: 20261120, categoryId: FOOD, amount: 500 }),
  createTransaction({
    id: 'a4',
    day: 20261015,
    categoryId: FOOD,
    amount: 2000,
  }),
  createTransaction({
    id: 'a5',
    day: 20261101,
    categoryId: SALARY,
    amount: 90000,
  }),
];

describe('buildInsights', () => {
  describe('when nothing is selected', () => {
    it('should describe the period that contains today', () => {
      const insights = buildInsights(createQuery());

      expect(insights).toMatchObject({
        selectedStart: 20261101,
        label: 'November 2026',
        total: 4500,
        count: 3,
        previousTotal: 2000,
        averagePerDay: 196,
        scaleMax: 5000,
        canGoBack: true,
        canGoForward: false,
      });
    });

    it('should end the chart on the current period', () => {
      const { bars } = buildInsights(createQuery());

      expect(bars).toHaveLength(12);
      expect(bars[0]).toMatchObject({
        start: 20251201,
        amount: 0,
        tick: 'Dec',
      });
      expect(bars[10]).toMatchObject({ start: 20261001, amount: 2000 });
      expect(bars[11]).toMatchObject({ start: 20261101, amount: 4500 });
    });

    it('should rank the categories of the period by amount', () => {
      const { breakdown } = buildInsights(createQuery());

      expect(
        breakdown.map(({ category, amount, count, share }) => ({
          slug: category.slug,
          amount,
          count,
          share,
        })),
      ).toEqual([
        { slug: 'groceries', amount: 3000, count: 1, share: 3000 / 4500 },
        { slug: 'food', amount: 1500, count: 2, share: 1500 / 4500 },
      ]);
    });
  });

  describe('when a category filter is on', () => {
    it('should narrow the totals and the chart but not the breakdown', () => {
      const insights = buildInsights(createQuery({ categoryId: FOOD }));

      expect(insights.total).toBe(1500);
      expect(insights.count).toBe(2);
      expect(insights.bars[11].amount).toBe(1500);
      expect(insights.breakdown).toHaveLength(2);
    });
  });

  it('should show income when that kind is asked for', () => {
    const insights = buildInsights(
      createQuery({ kind: TransactionKind.Income }),
    );

    expect(insights.total).toBe(90000);
    expect(insights.breakdown).toHaveLength(1);
  });

  it('should not give a daily average for a single day', () => {
    const insights = buildInsights(
      createQuery({ granularity: Granularity.Day }),
    );

    expect(insights.total).toBe(4000);
    expect(insights.averagePerDay).toBeNull();
  });

  describe('when an older period is selected', () => {
    it('should show the page of the chart that contains it', () => {
      const { bars, selectedStart } = buildInsights(
        createQuery({ granularity: Granularity.Day, selectedStart: 20261020 }),
      );

      expect(selectedStart).toBe(20261020);
      expect(bars).toHaveLength(14);
      expect(bars[0].start).toBe(20261013);
      expect(bars[13].start).toBe(20261026);
    });

    it('should not go further back than the first transaction', () => {
      const insights = buildInsights(createQuery({ selectedStart: 20200101 }));

      expect(insights.selectedStart).toBe(20261001);
      expect(insights.canGoBack).toBe(false);
      expect(insights.canGoForward).toBe(true);
    });
  });

  it('should still work when there are no transactions', () => {
    const insights = buildInsights(createQuery({ transactions: [] }));

    expect(insights).toMatchObject({
      selectedStart: 20261101,
      total: 0,
      count: 0,
      breakdown: [],
      canGoBack: false,
      canGoForward: false,
    });
  });
});

describe('getNiceCeiling', () => {
  it.each([
    [0, 100],
    [100, 100],
    [1234, 1500],
    [250, 300],
    [260, 300],
    [4500, 5000],
    [9001, 10000],
  ])('should round %i up to %i', (value, expected) => {
    expect(getNiceCeiling(value)).toBe(expected);
  });
});

function createQuery(overrides: Partial<InsightsQuery> = {}): InsightsQuery {
  return {
    transactions: TRANSACTIONS,
    granularity: Granularity.Month,
    kind: TransactionKind.Expense,
    selectedStart: null,
    categoryId: null,
    today: TODAY,
    ...overrides,
  };
}
