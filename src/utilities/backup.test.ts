import { describe, expect, it } from 'vitest';
import { createTransaction } from '../test/mocks/transaction';
import {
  createBackup,
  getBackupFileName,
  parseBackup,
  resolveBackup,
  type ParsedBackup,
} from './backup';
import { createCatalog } from './categories';
import {
  ThemePreference,
  TransactionKind,
  type AppState,
  type CustomCategory,
} from './types';

const COFFEE: CustomCategory = {
  id: 1000,
  kind: TransactionKind.Expense,
  label: 'Coffee',
  icon: 'coffee',
};

const STATE: AppState = {
  transactions: [
    createTransaction({
      id: 'a3',
      day: 20261124,
      categoryId: 1000,
      amount: 450,
    }),
    createTransaction({ id: 'a2', day: 20261123, categoryId: 2, amount: 1999 }),
    createTransaction({
      id: 'a1',
      day: 20261101,
      categoryId: 10,
      amount: 90000,
    }),
  ],
  settings: { currency: 'EUR', theme: ThemePreference.Dark },
  categories: createCatalog([COFFEE]),
};

describe('backup', () => {
  it('should write categories and transactions in a form people can read', () => {
    const backup = JSON.parse(createBackup(STATE, new Date(0)));

    expect(backup).toEqual({
      app: 'money-manager',
      version: 2,
      exportedAt: '1970-01-01T00:00:00.000Z',
      currency: 'EUR',
      categories: [
        { key: 'custom-1000', name: 'Coffee', kind: 'expense', icon: 'coffee' },
      ],
      transactions: [
        { id: 'a3', date: '2026-11-24', category: 'custom-1000', amount: 4.5 },
        { id: 'a2', date: '2026-11-23', category: 'groceries', amount: 19.99 },
        { id: 'a1', date: '2026-11-01', category: 'salary', amount: 900 },
      ],
    });
  });

  it('should read back exactly what it wrote', () => {
    const backup = parseBackup(createBackup(STATE, new Date(0)));

    expect(backup).toBeDefined();
    expect(resolveBackup(backup as ParsedBackup, createCatalog([]))).toEqual({
      customCategories: [COFFEE],
      transactions: STATE.transactions,
    });
  });

  it.each([
    ['text that is not JSON', 'hello'],
    ['JSON that is not an object', '[]'],
    [
      'a file from another app',
      '{"app":"other","version":1,"transactions":[]}',
    ],
    [
      'a newer backup format',
      '{"app":"money-manager","version":3,"transactions":[]}',
    ],
    [
      'a backup without a transaction list',
      '{"app":"money-manager","version":2}',
    ],
  ])('should not accept %s', (_description, text) => {
    expect(parseBackup(text)).toBeUndefined();
  });

  it('should still read backups made before custom categories existed', () => {
    const text = JSON.stringify({
      app: 'money-manager',
      version: 1,
      currency: 'USD',
      transactions: [
        { id: 'a1', date: '2026-11-23', category: 'food', amount: 12.5 },
      ],
    });

    expect(parseBackup(text)).toEqual({
      categories: [],
      transactions: [
        { id: 'a1', day: 20261123, categoryKey: 'food', amount: 1250 },
      ],
      skippedCount: 0,
      currency: 'USD',
    });
  });

  describe('when some entries of a backup are not valid', () => {
    it('should keep the valid ones and count the rest', () => {
      const text = createBackupText(
        [{ key: 'custom-1', name: 'Pets', kind: 'expense', icon: 'dog' }],
        [
          { id: 'a1', date: '2026-11-23', category: 'food', amount: 12.5 },
          { id: 'a2', date: '2026-11-23', category: 'custom-1', amount: 3 },
          { id: 'a3', date: '2026-02-30', category: 'food', amount: 12.5 },
          { id: 'a4', date: '2026-11-23', category: 'custom-9', amount: 1 },
          { id: 'a5', date: '2026-11-23', category: 'food', amount: -1 },
          { id: 'a6', date: '2026-11-23', category: 'food', amount: '12.5' },
          { id: 'A-7', date: '2026-11-23', category: 'food', amount: 1 },
          null,
        ],
      );

      expect(parseBackup(text)).toMatchObject({
        transactions: [
          { id: 'a1', categoryKey: 'food' },
          { id: 'a2', categoryKey: 'custom-1' },
        ],
        skippedCount: 6,
      });
    });

    it.each([
      ['a missing name', { key: 'c1', kind: 'expense', icon: 'dog' }],
      ['a blank name', { key: 'c1', name: '  ', kind: 'expense' }],
      ['an unknown type', { key: 'c1', name: 'Pets', kind: 'gift' }],
      ['a key used by a built-in category', { key: 'food', name: 'Pets' }],
    ])('should leave out a category with %s', (_reason, category) => {
      const text = createBackupText([{ kind: 'expense', ...category }], []);

      expect(parseBackup(text)?.categories).toEqual([]);
    });

    it('should give a category with an unknown icon the default one', () => {
      const text = createBackupText(
        [{ key: 'c1', name: 'Pets', kind: 'expense', icon: 'unicorn' }],
        [],
      );

      expect(parseBackup(text)?.categories).toEqual([
        { key: 'c1', label: 'Pets', kind: 'expense', icon: 'tag' },
      ]);
    });
  });

  it('should keep the last of two entries that share an id', () => {
    const text = createBackupText(
      [],
      [
        { id: 'a1', date: '2026-11-23', category: 'food', amount: 1 },
        { id: 'a1', date: '2026-11-23', category: 'food', amount: 12.5 },
      ],
    );

    expect(parseBackup(text)?.transactions).toEqual([
      { id: 'a1', day: 20261123, categoryKey: 'food', amount: 1250 },
    ]);
  });

  describe('when a backup is matched to the categories of this device', () => {
    it('should reuse a category with the same name and type', () => {
      const backup = createParsedBackup({
        key: 'custom-7',
        label: 'COFFEE',
        kind: TransactionKind.Expense,
      });

      expect(resolveBackup(backup, createCatalog([COFFEE]))).toEqual({
        customCategories: [COFFEE],
        transactions: [createTransaction({ categoryId: 1000 })],
      });
    });

    it('should map a custom category named like a built-in one to it', () => {
      const backup = createParsedBackup({
        key: 'custom-7',
        label: 'Food',
        kind: TransactionKind.Expense,
      });

      expect(resolveBackup(backup, createCatalog([])).transactions).toEqual([
        createTransaction({ categoryId: 1 }),
      ]);
    });

    it('should create a category that does not exist yet with a new id', () => {
      const backup = createParsedBackup({
        key: 'custom-1000',
        label: 'Coffee',
        kind: TransactionKind.Income,
      });

      expect(resolveBackup(backup, createCatalog([COFFEE]))).toEqual({
        customCategories: [
          COFFEE,
          { id: 1001, kind: 'income', label: 'Coffee', icon: 'tag' },
        ],
        transactions: [createTransaction({ categoryId: 1001 })],
      });
    });
  });

  it('should name the file after the app and the day', () => {
    expect(getBackupFileName(20261123)).toBe('money-manager-2026-11-23.json');
  });
});

function createBackupText(
  categories: Array<unknown>,
  transactions: Array<unknown>,
): string {
  return JSON.stringify({
    app: 'money-manager',
    version: 2,
    categories,
    transactions,
  });
}

/** A backup with one custom category and one transaction in it. */
function createParsedBackup(
  category: Omit<ParsedBackup['categories'][number], 'icon'>,
): ParsedBackup {
  return {
    categories: [{ ...category, icon: 'tag' }],
    transactions: [
      { id: 'a1', day: 20261123, categoryKey: category.key, amount: 1250 },
    ],
    skippedCount: 0,
    currency: undefined,
  };
}
