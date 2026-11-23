import { describe, expect, it } from 'vitest';
import {
  createCatalog,
  createCategoryId,
  getCategory,
  normalizeLabel,
  parseCustomCategories,
  validateCategoryLabel,
} from './categories';
import { TransactionKind, type CustomCategory } from './types';

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
    it('should offer custom categories after the built-in ones and before Other', () => {
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
        'Other',
      ]);
      expect(
        catalog.byKind[TransactionKind.Income].map(({ label }) => label),
      ).toEqual(['Salary', 'Freelance', 'Gift', 'Tips', 'Other']);
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

  it('should show an unknown category as Other', () => {
    expect(getCategory(createCatalog([]), 1000)).toMatchObject({
      slug: 'other',
      kind: TransactionKind.Expense,
    });
  });

  it('should give a new custom category the next free id', () => {
    expect(createCategoryId([])).toBe(1000);
    expect(createCategoryId([COFFEE, TIPS])).toBe(1002);
  });

  it('should tidy up spaces in a name', () => {
    expect(normalizeLabel('  Coffee   shop ')).toBe('Coffee shop');
  });

  describe('when a name is checked', () => {
    const catalog = createCatalog([COFFEE]);

    it.each([
      ['an empty name', '   ', 'Enter a name'],
      [
        'the name of a built-in category',
        'groceries',
        'A category with this name already exists',
      ],
      [
        'the name of a custom category',
        ' COFFEE ',
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
});
