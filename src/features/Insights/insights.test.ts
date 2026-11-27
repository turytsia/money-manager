import { describe, expect, it } from 'vitest';
import { createTransaction } from '../../test/mocks/transaction';
import { createCatalog } from '../../utilities/categories';
import { Granularity, TransactionKind } from '../../utilities/types';
import { buildInsights, getNiceCeiling, type InsightsQuery } from './insights';

const FOOD = 1;
const GROCERIES = 2;
const UNCATEGORIZED = 9;
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
        scaleMax: 100000,
        canGoBack: true,
        canGoForward: false,
      });
    });

    it('should total what was earned and what was spent, in that order', () => {
      const { series } = buildInsights(createQuery());

      expect(series).toEqual([
        {
          kind: TransactionKind.Income,
          total: 90000,
          previousTotal: 0,
        },
        {
          kind: TransactionKind.Expense,
          total: 4500,
          previousTotal: 2000,
        },
      ]);
    });

    it('should end the chart on the current period', () => {
      const { bars } = buildInsights(createQuery());

      expect(bars).toHaveLength(12);
      expect(bars[0]).toMatchObject({
        start: 20251201,
        amounts: { expense: 0, income: 0 },
        tick: 'Dec',
      });
      expect(bars[10]).toMatchObject({
        start: 20261001,
        amounts: { expense: 2000, income: 0 },
      });
      expect(bars[11]).toMatchObject({
        start: 20261101,
        amounts: { expense: 4500, income: 90000 },
      });
    });

    it('should rank the categories of the period by amount for each kind', () => {
      const { breakdown } = buildInsights(createQuery());

      expect(toRows(breakdown[TransactionKind.Expense])).toEqual([
        ['Groceries', 3000, 3000 / 4500],
        ['Food', 1500, 1500 / 4500],
      ]);
      expect(toRows(breakdown[TransactionKind.Income])).toEqual([
        ['Salary', 90000, 1],
      ]);
    });
  });

  describe('when there are custom categories', () => {
    it('should count them in the totals and the breakdown', () => {
      const insights = buildInsights(
        createQuery({
          transactions: [
            ...TRANSACTIONS,
            createTransaction({
              id: 'a6',
              day: 20261110,
              categoryId: 1000,
              amount: 5500,
            }),
          ],
          categories: createCatalog([
            {
              id: 1000,
              kind: TransactionKind.Expense,
              label: 'Pets',
              icon: 'dog',
            },
          ]),
        }),
      );

      expect(insights.series[1].total).toBe(10000);
      expect(
        insights.breakdown[TransactionKind.Expense].map(
          ({ category }) => category.label,
        ),
      ).toEqual(['Pets', 'Groceries', 'Food']);
    });
  });

  describe('when a transaction has no category', () => {
    it('should still count it, as Uncategorized', () => {
      const insights = buildInsights(
        createQuery({
          transactions: [
            createTransaction({ categoryId: UNCATEGORIZED, amount: 700 }),
          ],
        }),
      );

      expect(insights.series[1].total).toBe(700);
      expect(toRows(insights.breakdown[TransactionKind.Expense])).toEqual([
        ['Uncategorized', 700, 1],
      ]);
    });
  });

  it('should group by day when asked to', () => {
    const insights = buildInsights(
      createQuery({ granularity: Granularity.Day }),
    );

    expect(insights.label).toBe('Today');
    expect(insights.series.map(({ total }) => total)).toEqual([0, 4000]);
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
      series: [{ total: 0 }, { total: 0 }],
      scaleMax: 100,
      breakdown: { expense: [], income: [] },
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
    categories: createCatalog([]),
    granularity: Granularity.Month,
    selectedStart: null,
    today: TODAY,
    ...overrides,
  };
}

function toRows(
  items: ReturnType<typeof buildInsights>['breakdown'][TransactionKind],
): Array<[string, number, number]> {
  return items.map(({ category, amount, share }) => [
    category.label,
    amount,
    share,
  ]);
}
