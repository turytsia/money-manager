import { describe, expect, it, vi } from 'vitest';
import { createTransaction } from '../test/mocks/transaction';
import {
  decodeMonth,
  loadTransactions,
  measureStorage,
  replaceTransactions,
  saveMonths,
  STORAGE_QUOTA_BYTES,
} from './storage';

describe('storage', () => {
  it('should save one compact entry per month', () => {
    const november = createTransaction({ id: 'a1', day: 20261123 });
    const december = createTransaction({ id: 'a2', day: 20261201 });

    saveMonths([december, november], [202611, 202612]);

    expect(localStorage.getItem('mm:tx:202611')).toBe('[["a1",23,1,1250]]');
    expect(localStorage.getItem('mm:tx:202612')).toBe('[["a2",1,1,1250]]');
  });

  it('should load everything that was saved, newest first', () => {
    const november = createTransaction({ id: 'a1', day: 20261123 });
    const december = createTransaction({ id: 'a2', day: 20261201 });
    saveMonths([november, december], [202611, 202612]);

    expect(loadTransactions()).toEqual([december, november]);
  });

  it('should remove the entry of a month that became empty', () => {
    saveMonths([createTransaction()], [202611]);

    saveMonths([], [202611]);

    expect(localStorage.getItem('mm:tx:202611')).toBeNull();
  });

  it('should leave entries of other apps on the same site alone', () => {
    localStorage.setItem('another-app', 'kept');
    saveMonths([createTransaction()], [202611]);

    replaceTransactions([]);

    expect(localStorage.getItem('another-app')).toBe('kept');
    expect(loadTransactions()).toEqual([]);
  });

  describe('when a write fails part of the way through', () => {
    it('should put back what was saved before and report the failure', () => {
      const original = createTransaction({ id: 'a1', day: 20261123 });
      saveMonths([original], [202611]);
      const moved = createTransaction({ id: 'a1', day: 20261201 });
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key: string,
        value: string,
      ) {
        if (key === 'mm:tx:202612') {
          throw new DOMException('Storage is full', 'QuotaExceededError');
        }
        setItem.call(this, key, value);
      });

      expect(() => saveMonths([moved], [202611, 202612])).toThrow(
        'Storage is full',
      );
      expect(loadTransactions()).toEqual([original]);
    });
  });

  describe('when saved data is damaged', () => {
    it('should skip entries that are not valid and keep the rest', () => {
      const text = JSON.stringify([
        ['a1', 23, 1, 1250],
        ['a2', 31, 1, 1250],
        ['a3', 23, 1, -5],
        'not an entry',
      ]);

      expect(decodeMonth(202611, text)).toEqual([createTransaction()]);
    });

    it('should move an unknown category to Other', () => {
      const text = JSON.stringify([['a1', 23, 99, 1250]]);

      expect(decodeMonth(202611, text)).toEqual([
        createTransaction({ categoryId: 9 }),
      ]);
    });

    it('should treat unreadable text as an empty month', () => {
      expect(decodeMonth(202611, '{broken')).toEqual([]);
    });
  });

  it('should measure used space at two bytes per saved character', () => {
    saveMonths([createTransaction()], [202611]);

    // The key has 12 characters and the value 18.
    expect(measureStorage(1)).toEqual({
      usedBytes: 60,
      freeBytes: STORAGE_QUOTA_BYTES - 60,
      quotaBytes: STORAGE_QUOTA_BYTES,
      usedRatio: 60 / STORAGE_QUOTA_BYTES,
      remainingTransactions: 87380,
    });
  });
});
