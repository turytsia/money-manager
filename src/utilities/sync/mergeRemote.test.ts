import { describe, expect, it } from 'vitest';
import { createTransaction } from '../../test/mocks/transaction';
import {
  TransactionKind,
  type CustomCategory,
  type DataSnapshot,
  type PendingChanges,
} from '../types';
import { mergeRemote } from './mergeRemote';
import { NO_PENDING_CHANGES } from './pendingChanges';

const COFFEE: CustomCategory = {
  id: 1000,
  kind: TransactionKind.Expense,
  label: 'Coffee',
  icon: 'coffee',
};

describe('mergeRemote', () => {
  describe('when this device has nothing left to send', () => {
    it('should end up exactly like the cloud copy', () => {
      const local = createSnapshot({
        transactions: [createTransaction({ id: 'a1' })],
        customCategories: [COFFEE],
        hiddenCategoryIds: [3],
        currency: 'USD',
      });
      const remote = createSnapshot({
        transactions: [createTransaction({ id: 'r1' })],
        currency: 'EUR',
      });

      expect(mergeRemote(local, remote, NO_PENDING_CHANGES)).toEqual(remote);
    });
  });

  describe('when this device has changes left to send', () => {
    it('should add what it created and replace what it edited', () => {
      const edited = createTransaction({ id: 'a1', amount: 999 });
      const created = createTransaction({ id: 'a2', day: 20261124 });
      const fromElsewhere = createTransaction({ id: 'r1', day: 20261122 });

      const merged = mergeRemote(
        createSnapshot({ transactions: [created, edited] }),
        createSnapshot({
          transactions: [createTransaction({ id: 'a1' }), fromElsewhere],
        }),
        createPending({ upsertedTransactionIds: ['a1', 'a2'] }),
      );

      expect(merged.transactions).toEqual([created, edited, fromElsewhere]);
    });

    it('should remove what it deleted', () => {
      const merged = mergeRemote(
        createSnapshot({}),
        createSnapshot({
          transactions: [createTransaction({ id: 'a1' })],
          customCategories: [COFFEE],
        }),
        createPending({
          deletedTransactionIds: ['a1'],
          deletedCategoryIds: [1000],
        }),
      );

      expect(merged.transactions).toEqual([]);
      expect(merged.customCategories).toEqual([]);
    });

    it('should keep its own settings only if those changed here', () => {
      const local = createSnapshot({ hiddenCategoryIds: [3], currency: 'USD' });
      const remote = createSnapshot({
        hiddenCategoryIds: [4],
        currency: 'EUR',
      });

      expect(
        mergeRemote(
          local,
          remote,
          createPending({ upsertedTransactionIds: ['a1'] }),
        ),
      ).toMatchObject({ hiddenCategoryIds: [4], currency: 'EUR' });
      expect(
        mergeRemote(local, remote, createPending({ hasSettingsChange: true })),
      ).toMatchObject({ hiddenCategoryIds: [3], currency: 'USD' });
    });
  });
});

function createSnapshot(parts: Partial<DataSnapshot>): DataSnapshot {
  return {
    transactions: [],
    customCategories: [],
    hiddenCategoryIds: [],
    currency: 'USD',
    ...parts,
  };
}

function createPending(parts: Partial<PendingChanges>): PendingChanges {
  return { ...NO_PENDING_CHANGES, ...parts };
}
