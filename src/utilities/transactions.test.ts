import { describe, expect, it } from 'vitest';
import { createTransaction } from '../test/mocks/transaction';
import { createCatalog } from './categories';
import {
  createTransactionId,
  getKind,
  isValidAmount,
  isValidTransactionId,
  mergeTransactions,
  removeTransaction,
  sortTransactions,
  upsertTransaction,
} from './transactions';
import { TransactionKind } from './types';

describe('transactions', () => {
  it('should sort by day, then by creation order, newest first', () => {
    const older = createTransaction({ id: 'a1', day: 20261122 });
    const first = createTransaction({ id: 'a2', day: 20261123 });
    const second = createTransaction({ id: 'a3', day: 20261123 });
    const longerId = createTransaction({ id: 'a10', day: 20261123 });

    expect(sortTransactions([older, first, longerId, second])).toEqual([
      longerId,
      second,
      first,
      older,
    ]);
  });

  describe('when a transaction is upserted', () => {
    it('should add it when its id is new', () => {
      const existing = createTransaction({ id: 'a1' });
      const added = createTransaction({ id: 'a2' });

      expect(upsertTransaction([existing], added)).toEqual([added, existing]);
    });

    it('should replace the one with the same id', () => {
      const existing = createTransaction({ id: 'a1', amount: 100 });
      const changed = createTransaction({ id: 'a1', amount: 200 });

      expect(upsertTransaction([existing], changed)).toEqual([changed]);
    });
  });

  it('should remove a transaction by id', () => {
    const kept = createTransaction({ id: 'a1' });
    const removed = createTransaction({ id: 'a2' });

    expect(removeTransaction([kept, removed], 'a2')).toEqual([kept]);
  });

  it('should merge two lists and let the incoming one win on a shared id', () => {
    const onlyCurrent = createTransaction({ id: 'a1', day: 20261120 });
    const sharedCurrent = createTransaction({ id: 'a2', amount: 100 });
    const sharedIncoming = createTransaction({ id: 'a2', amount: 200 });
    const onlyIncoming = createTransaction({ id: 'a3' });

    expect(
      mergeTransactions(
        [sharedCurrent, onlyCurrent],
        [sharedIncoming, onlyIncoming],
      ),
    ).toEqual([onlyIncoming, sharedIncoming, onlyCurrent]);
  });

  describe('when a new id is created', () => {
    it('should use the timestamp in base 36', () => {
      expect(createTransactionId(1795435200000, [])).toBe('mwt7reo0');
    });

    it('should move past ids that are already taken', () => {
      const taken = createTransaction({ id: 'mwt7reo0' });

      expect(createTransactionId(1795435200000, [taken])).toBe('mwt7reo1');
    });
  });

  it.each([
    ['mwt7reo0', true],
    ['a1', true],
    ['A-1', false],
    ['', false],
    [undefined, false],
  ])('should say whether the id %j is valid', (id, expected) => {
    expect(isValidTransactionId(id)).toBe(expected);
  });

  it.each([
    [1250, true],
    [999_999_999, true],
    [0, false],
    [12.5, false],
    [1_000_000_000, false],
    ['1250', false],
  ])('should say whether the amount %j is valid', (amount, expected) => {
    expect(isValidAmount(amount)).toBe(expected);
  });

  it('should take the kind of a transaction from its category', () => {
    const categories = createCatalog([
      { id: 1000, kind: TransactionKind.Income, label: 'Tips', icon: 'coins' },
    ]);

    expect(getKind(createTransaction({ categoryId: 1 }), categories)).toBe(
      TransactionKind.Expense,
    );
    expect(getKind(createTransaction({ categoryId: 1000 }), categories)).toBe(
      TransactionKind.Income,
    );
  });
});
