import { describe, expect, it } from 'vitest';
import { createTransaction } from '../../test/mocks/transaction';
import { createCatalog } from '../../utilities/categories';
import { TransactionKind } from '../../utilities/types';
import { buildActivity, type ActivityQuery } from './activity';

const FOOD = 1;
const GROCERIES = 2;
const UNCATEGORIZED = 9;
const SALARY = 10;
const PETS = 1000;

// Newest first, the way the store keeps them.
const TRANSACTIONS = [
  createTransaction({ id: 'a1', day: 20261123, categoryId: GROCERIES }),
  createTransaction({ id: 'a2', day: 20261123, categoryId: FOOD }),
  createTransaction({ id: 'a3', day: 20261120, categoryId: SALARY }),
  createTransaction({ id: 'a4', day: 20261118, categoryId: FOOD }),
];

describe('buildActivity', () => {
  describe('when no category is picked', () => {
    it('should list every transaction by day', () => {
      const { groups, count, selectedIds } = buildActivity(createQuery());

      expect(groups.map(({ day }) => day)).toEqual([
        20261123, 20261120, 20261118,
      ]);
      expect(count).toBe(4);
      expect(selectedIds.size).toBe(0);
    });

    it('should offer the categories in use, spent before earned', () => {
      const { filterCategories } = buildActivity(createQuery());

      expect(filterCategories.map(({ label }) => label)).toEqual([
        'Food',
        'Groceries',
        'Salary',
      ]);
    });
  });

  describe('when categories are picked', () => {
    it('should keep only their transactions, with totals to match', () => {
      const { groups, count } = buildActivity(
        createQuery({ categoryIds: new Set([FOOD, SALARY]) }),
      );

      expect(
        groups.map(({ day, transactions }) => [
          day,
          transactions.map(({ id }) => id),
        ]),
      ).toEqual([
        [20261123, ['a2']],
        [20261120, ['a3']],
        [20261118, ['a4']],
      ]);
      expect(groups[0]).toMatchObject({ expenseTotal: 1250, incomeTotal: 0 });
      expect(count).toBe(3);
    });

    it('should keep offering a picked category that is no longer in use', () => {
      const { filterCategories, groups } = buildActivity(
        createQuery({ categoryIds: new Set([SALARY]), transactions: [] }),
      );

      expect(filterCategories.map(({ label }) => label)).toEqual(['Salary']);
      expect(groups).toEqual([]);
    });

    it('should drop a picked category that was deleted', () => {
      const { selectedIds, count } = buildActivity(
        createQuery({ categoryIds: new Set([PETS]) }),
      );

      expect(selectedIds.size).toBe(0);
      expect(count).toBe(4);
    });
  });

  describe('when a transaction has an unknown category', () => {
    it('should file it under Uncategorized', () => {
      const transactions = [
        createTransaction({ id: 'b1', categoryId: 4242 }),
        createTransaction({ id: 'b2', categoryId: FOOD }),
      ];

      const { filterCategories, groups } = buildActivity(
        createQuery({
          transactions,
          categoryIds: new Set([UNCATEGORIZED]),
        }),
      );

      expect(filterCategories.map(({ id }) => id)).toEqual([
        FOOD,
        UNCATEGORIZED,
      ]);
      expect(groups[0].transactions.map(({ id }) => id)).toEqual(['b1']);
    });
  });

  it('should offer custom categories after the built-in ones of their kind', () => {
    const { filterCategories } = buildActivity(
      createQuery({
        transactions: [
          ...TRANSACTIONS,
          createTransaction({ id: 'a5', categoryId: PETS }),
        ],
        categories: createCatalog([
          {
            id: PETS,
            kind: TransactionKind.Expense,
            label: 'Pets',
            icon: 'dog',
          },
        ]),
      }),
    );

    expect(filterCategories.map(({ label }) => label)).toEqual([
      'Food',
      'Groceries',
      'Pets',
      'Salary',
    ]);
  });
});

function createQuery(overrides: Partial<ActivityQuery> = {}): ActivityQuery {
  return {
    transactions: TRANSACTIONS,
    categories: createCatalog([]),
    categoryIds: new Set(),
    ...overrides,
  };
}
