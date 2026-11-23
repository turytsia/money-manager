import { describe, expect, it } from 'vitest';
import { createTransaction } from '../test/mocks/transaction';
import { createBackup, getBackupFileName, parseBackup } from './backup';
import { ThemePreference, type AppState } from './types';

const STATE: AppState = {
  transactions: [
    createTransaction({ id: 'a2', day: 20261123, categoryId: 2, amount: 1999 }),
    createTransaction({
      id: 'a1',
      day: 20261101,
      categoryId: 10,
      amount: 90000,
    }),
  ],
  settings: { currency: 'EUR', theme: ThemePreference.Dark },
};

describe('backup', () => {
  it('should write transactions in a form people can read', () => {
    const backup = JSON.parse(createBackup(STATE, new Date(0)));

    expect(backup).toEqual({
      app: 'money-manager',
      version: 1,
      exportedAt: '1970-01-01T00:00:00.000Z',
      currency: 'EUR',
      transactions: [
        { id: 'a2', date: '2026-11-23', category: 'groceries', amount: 19.99 },
        { id: 'a1', date: '2026-11-01', category: 'salary', amount: 900 },
      ],
    });
  });

  it('should read back exactly what it wrote', () => {
    expect(parseBackup(createBackup(STATE, new Date(0)))).toEqual({
      transactions: STATE.transactions,
      skippedCount: 0,
      currency: 'EUR',
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
      '{"app":"money-manager","version":2,"transactions":[]}',
    ],
    [
      'a backup without a transaction list',
      '{"app":"money-manager","version":1}',
    ],
  ])('should not accept %s', (_description, text) => {
    expect(parseBackup(text)).toBeUndefined();
  });

  describe('when some entries of a backup are not valid', () => {
    it('should keep the valid ones and count the rest', () => {
      const text = createBackupText([
        { id: 'a1', date: '2026-11-23', category: 'food', amount: 12.5 },
        { id: 'a2', date: '2026-02-30', category: 'food', amount: 12.5 },
        { id: 'a3', date: '2026-11-23', category: 'unknown', amount: 12.5 },
        { id: 'a4', date: '2026-11-23', category: 'food', amount: -1 },
        { id: 'a5', date: '2026-11-23', category: 'food', amount: '12.5' },
        null,
      ]);

      expect(parseBackup(text)).toEqual({
        transactions: [createTransaction()],
        skippedCount: 5,
        currency: undefined,
      });
    });
  });

  it('should keep the last of two entries that share an id', () => {
    const text = createBackupText([
      { id: 'a1', date: '2026-11-23', category: 'food', amount: 1 },
      { id: 'a1', date: '2026-11-23', category: 'food', amount: 12.5 },
    ]);

    expect(parseBackup(text)?.transactions).toEqual([createTransaction()]);
  });

  it('should name the file after the app and the day', () => {
    expect(getBackupFileName(20261123)).toBe('money-manager-2026-11-23.json');
  });
});

function createBackupText(transactions: Array<unknown>): string {
  return JSON.stringify({ app: 'money-manager', version: 1, transactions });
}
