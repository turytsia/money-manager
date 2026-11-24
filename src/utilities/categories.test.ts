import { describe, expect, it } from 'vitest';
import {
  canHideCategory,
  createCatalog,
  createCategoryId,
  getCategory,
  normalizeLabel,
  parseCategoryIds,
  parseCustomCategories,
  parseCustomSlug,
  validateCategoryLabel,
} from './categories';
import { TransactionKind, type CustomCategory } from './types';

const TRANSPORT = 3;
const UNCATEGORIZED = 9;

const COFFEE: CustomCategory = {
  id: 1000,
  kind: TransactionKind.Expense,
  label: 'Coffee',
  icon: 'coffee',
};

const TIPS: CustomCategory = {
  id: 1001,
  kind: TransactionKind.Income,
  label: 'Tips',
  icon: 'coins',
};

describe('categories', () => {
  describe('when a catalog is created', () => {
    it('should list custom categories after the built-in ones, with Uncategorized last', () => {
      const catalog = createCatalog([COFFEE, TIPS]);

      expect(
        catalog.byKind[TransactionKind.Expense].map(({ label }) => label),
      ).toEqual([
        'Food',
        'Groceries',
        'Transport',
        'Home',
        'Bills',
        'Health',
        'Fun',
        'Shopping',
        'Coffee',
        'Uncategorized',
      ]);
      expect(
        catalog.byKind[TransactionKind.Income].map(({ label }) => label),
      ).toEqual(['Salary', 'Freelance', 'Gift', 'Tips', 'Uncategorized']);
    });

    it('should give a custom category a stable slug for backups', () => {
      const coffee = getCategory(createCatalog([COFFEE]), 1000);

      expect(coffee).toMatchObject({
        slug: 'custom-1000',
        label: 'Coffee',
        iconName: 'coffee',
        isCustom: true,
      });
    });
  });

  describe('when categories are hidden', () => {
    it('should leave them out of what is offered but keep them known', () => {
      const catalog = createCatalog([COFFEE], [TRANSPORT, COFFEE.id]);

      expect(
        catalog.visibleByKind[TransactionKind.Expense].map(
          ({ label }) => label,
        ),
      ).toEqual([
        'Food',
        'Groceries',
        'Home',
        'Bills',
        'Health',
        'Fun',
        'Shopping',
      ]);
      expect(getCategory(catalog, TRANSPORT).label).toBe('Transport');
      expect(catalog.byKind[TransactionKind.Expense]).toHaveLength(10);
    });

    it('should keep one category of each type on, so there is one to pick', () => {
      const catalog = createCatalog([], [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12]);

      expect(
        catalog.visibleByKind[TransactionKind.Expense].map(
          ({ label }) => label,
        ),
      ).toEqual(['Food']);
      expect(
        catalog.visibleByKind[TransactionKind.Income].map(({ label }) => label),
      ).toEqual(['Salary']);
      expect(catalog.hiddenIds.has(1)).toBe(false);
    });

    it('should forget hidden ids of categories that no longer exist', () => {
      expect(createCatalog([], [COFFEE.id]).hiddenIds.size).toBe(0);
    });
  });

  describe('when a transaction has no category of its own', () => {
    it('should show an unknown category as Uncategorized', () => {
      expect(getCategory(createCatalog([]), 1000)).toMatchObject({
        slug: 'other',
        label: 'Uncategorized',
        kind: TransactionKind.Expense,
        isFallback: true,
      });
    });

    it('should never offer Uncategorized as something to pick or turn off', () => {
      const catalog = createCatalog([], [UNCATEGORIZED, 13]);

      expect(
        Object.values(catalog.visibleByKind)
          .flat()
          .some(({ isFallback }) => isFallback),
      ).toBe(false);
      expect(catalog.hiddenIds.size).toBe(0);
      expect(canHideCategory(UNCATEGORIZED)).toBe(false);
      expect(canHideCategory(TRANSPORT)).toBe(true);
    });
  });

  describe('when an id for a new custom category is made', () => {
    it('should base it on the time, so two devices do not pick the same', () => {
      const fiveSecondsIn = Date.UTC(2025, 0, 1, 0, 0, 5);

      expect(createCategoryId([], fiveSecondsIn)).toBe(1005);
    });

    it('should stay above every id that is already in use', () => {
      const future = { ...COFFEE, id: 9_000_000_000 };

      expect(createCategoryId([future], Date.UTC(2026, 0, 1))).toBe(
        9_000_000_001,
      );
    });
  });

  it('should tidy up spaces in a name', () => {
    expect(normalizeLabel('  Coffee   shop ')).toBe('Coffee shop');
  });

  describe('when a name is checked', () => {
    const catalog = createCatalog([COFFEE], [TRANSPORT]);

    it.each([
      ['an empty name', '   ', 'Enter a name'],
      [
        'the name of a built-in category',
        'groceries',
        'A category with this name already exists',
      ],
      [
        'the name of a hidden category',
        'Transport',
        'A category with this name already exists',
      ],
      [
        'the name of a custom category',
        ' COFFEE ',
        'A category with this name already exists',
      ],
      [
        'the name kept for transactions without a category',
        'uncategorized',
        'A category with this name already exists',
      ],
      [
        'a name that is too long',
        'A name that is far too long',
        'Use at most 24 characters',
      ],
    ])('should reject %s', (_reason, label, expected) => {
      expect(
        validateCategoryLabel(label, TransactionKind.Expense, catalog, null),
      ).toBe(expected);
    });

    it('should allow a name used by the other type', () => {
      expect(
        validateCategoryLabel('Coffee', TransactionKind.Income, catalog, null),
      ).toBeUndefined();
    });

    it('should allow a category to keep its own name', () => {
      expect(
        validateCategoryLabel('coffee', TransactionKind.Expense, catalog, 1000),
      ).toBeUndefined();
    });
  });

  describe('when saved custom categories are read', () => {
    it('should keep valid ones and leave out the rest', () => {
      expect(
        parseCustomCategories([
          COFFEE,
          { ...COFFEE, label: 'Duplicate id' },
          { id: 5, kind: 'expense', label: 'Id of a built-in', icon: 'tag' },
          { id: 1001, kind: 'other', label: 'Bad type', icon: 'tag' },
          { id: 1002, kind: 'income', label: '', icon: 'tag' },
          'not a category',
        ]),
      ).toEqual([COFFEE]);
    });

    it('should give a category with an unknown icon the default one', () => {
      expect(parseCustomCategories([{ ...COFFEE, icon: 'unicorn' }])).toEqual([
        { ...COFFEE, icon: 'tag' },
      ]);
    });

    it('should read anything that is not a list as no categories', () => {
      expect(parseCustomCategories({ id: 1000 })).toEqual([]);
    });
  });

  it('should read a saved list of ids, leaving out anything else', () => {
    expect(parseCategoryIds([3, 3, 'x', -1, 1000])).toEqual([3, 1000]);
    expect(parseCategoryIds('3')).toEqual([]);
  });

  it.each([
    ['custom-1000', 1000],
    ['custom-12', undefined],
    ['custom-abc', undefined],
    ['food', undefined],
  ])('should read the id in the slug "%s" as %s', (slug, expected) => {
    expect(parseCustomSlug(slug)).toBe(expected);
  });
});
