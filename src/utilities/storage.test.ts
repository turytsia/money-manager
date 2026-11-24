import { describe, expect, it, vi } from 'vitest';
import { createTransaction } from '../test/mocks/transaction';
import {
  decodeMonth,
  getAllMonthEntries,
  getCategoryEntries,
  getMonthEntries,
  loadCustomCategories,
  loadTransactions,
  writeEntries,
} from './storage';
import { TransactionKind } from './types';

describe('storage', () => {
  it('should save one compact entry per month', () => {
    const november = createTransaction({ id: 'a1', day: 20261123 });
    const december = createTransaction({ id: 'a2', day: 20261201 });

    writeEntries(getMonthEntries([december, november], [202611, 202612]));

    expect(localStorage.getItem('mm:tx:202611')).toBe('[["a1",23,1,1250]]');
    expect(localStorage.getItem('mm:tx:202612')).toBe('[["a2",1,1,1250]]');
  });

  it('should load everything that was saved, newest first', () => {
    const november = createTransaction({ id: 'a1', day: 20261123 });
    const december = createTransaction({ id: 'a2', day: 20261201 });
    writeEntries(getMonthEntries([november, december], [202611, 202612]));

    expect(loadTransactions()).toEqual([december, november]);
  });

  it('should remove the entry of a month that became empty', () => {
    writeEntries(getMonthEntries([createTransaction()], [202611]));

    writeEntries(getMonthEntries([], [202611]));

    expect(localStorage.getItem('mm:tx:202611')).toBeNull();
  });

  describe('when every month is rewritten', () => {
    it('should drop months that no longer have transactions', () => {
      const november = createTransaction({ id: 'a1', day: 20261123 });
      const december = createTransaction({ id: 'a2', day: 20261201 });
      writeEntries(getMonthEntries([november, december], [202611, 202612]));

      writeEntries(getAllMonthEntries([december]));

      expect(localStorage.getItem('mm:tx:202611')).toBeNull();
      expect(loadTransactions()).toEqual([december]);
    });

    it('should leave entries of other apps on the same site alone', () => {
      localStorage.setItem('another-app', 'kept');
      writeEntries(getMonthEntries([createTransaction()], [202611]));

      writeEntries(getAllMonthEntries([]));

      expect(localStorage.getItem('another-app')).toBe('kept');
      expect(loadTransactions()).toEqual([]);
    });
  });

  describe('when a write fails part of the way through', () => {
    it('should put back what was saved before and report the failure', () => {
      const original = createTransaction({ id: 'a1', day: 20261123 });
      writeEntries(getMonthEntries([original], [202611]));
      const moved = createTransaction({ id: 'a1', day: 20261201 });
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key: string,
        value: string,
      ) {
        if (key === 'mm:categories') {
          throw new DOMException('Storage is full', 'QuotaExceededError');
        }
        setItem.call(this, key, value);
      });

      expect(() =>
        writeEntries(
          getMonthEntries([moved], [202611, 202612]),
          getCategoryEntries([
            {
              id: 1000,
              kind: TransactionKind.Expense,
              label: 'A',
              icon: 'tag',
            },
          ]),
        ),
      ).toThrow('Storage is full');
      expect(loadTransactions()).toEqual([original]);
      expect(loadCustomCategories()).toEqual([]);
    });
  });

  describe('when saved data is damaged', () => {
    it('should skip entries that are not valid and keep the rest', () => {
      const text = JSON.stringify([
        ['a1', 23, 1, 1250],
        ['a2', 31, 1, 1250],
        ['a3', 23, 1, -5],
        ['a4', 23, 0, 1250],
        'not an entry',
      ]);

      expect(decodeMonth(202611, text)).toEqual([createTransaction()]);
    });

    it('should keep a category id it does not know, for the store to handle', () => {
      const text = JSON.stringify([['a1', 23, 1001, 1250]]);

      expect(decodeMonth(202611, text)).toEqual([
        createTransaction({ categoryId: 1001 }),
      ]);
    });

    it('should treat unreadable text as an empty month', () => {
      expect(decodeMonth(202611, '{broken')).toEqual([]);
    });
  });

  describe('when custom categories are saved', () => {
    it('should read them back', () => {
      const coffee = {
        id: 1000,
        kind: TransactionKind.Expense,
        label: 'Coffee',
        icon: 'coffee' as const,
      };

      writeEntries(getCategoryEntries([coffee]));

      expect(loadCustomCategories()).toEqual([coffee]);
    });

    it('should remove the entry when there are none left', () => {
      writeEntries(
        getCategoryEntries([
          { id: 1000, kind: TransactionKind.Expense, label: 'A', icon: 'tag' },
        ]),
      );

      writeEntries(getCategoryEntries([]));

      expect(localStorage.getItem('mm:categories')).toBeNull();
    });
  });
});
