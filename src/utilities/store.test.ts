import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedBackup } from './backup';
import { createStore } from './store';
import {
  ImportMode,
  TransactionKind,
  type DataSnapshot,
  type Transaction,
} from './types';

const TOKEN = 'token';
const COFFEE_JSON =
  '[{"id":1000,"kind":"expense","label":"Coffee","icon":"coffee"}]';

describe('createStore', () => {
  beforeEach(() => {
    // Five seconds into 2025, which makes the next custom category id 1005.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.UTC(2025, 0, 1, 0, 0, 5)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when a custom category is created', () => {
    it('should save it and add it to the catalog', () => {
      const store = createStore();

      const created = store.saveCategory({
        id: null,
        kind: TransactionKind.Expense,
        label: '  Coffee  ',
        icon: 'coffee',
      });

      expect(created).toEqual({
        id: 1005,
        kind: 'expense',
        label: 'Coffee',
        icon: 'coffee',
      });
      expect(localStorage.getItem('mm:categories')).toBe(
        '[{"id":1005,"kind":"expense","label":"Coffee","icon":"coffee"}]',
      );
      expect(store.getState().categories.byId.get(1005)?.label).toBe('Coffee');
    });
  });

  describe('when a custom category is edited', () => {
    it('should change its name and icon but keep its type', () => {
      localStorage.setItem('mm:categories', COFFEE_JSON);
      const store = createStore();

      store.saveCategory({
        id: 1000,
        kind: TransactionKind.Income,
        label: 'Cafés',
        icon: 'pizza',
      });

      expect(store.getState().categories.customCategories).toEqual([
        { id: 1000, kind: 'expense', label: 'Cafés', icon: 'pizza' },
      ]);
    });

    it('should refuse a category that does not exist', () => {
      const store = createStore();

      expect(
        store.saveCategory({
          id: 1000,
          kind: TransactionKind.Expense,
          label: 'Coffee',
          icon: 'coffee',
        }),
      ).toBeUndefined();
    });
  });

  describe('when a custom category is deleted', () => {
    it('should move its transactions to Other of the same type', () => {
      localStorage.setItem(
        'mm:categories',
        '[{"id":1000,"kind":"income","label":"Tips","icon":"coins"}]',
      );
      localStorage.setItem(
        'mm:tx:202611',
        '[["a1",23,1000,500],["a2",23,1,1250]]',
      );
      localStorage.setItem('mm:hidden', '[1000]');
      const store = createStore();

      expect(store.deleteCategory(1000)).toBe(true);

      expect(localStorage.getItem('mm:categories')).toBeNull();
      expect(localStorage.getItem('mm:hidden')).toBeNull();
      expect(localStorage.getItem('mm:tx:202611')).toBe(
        '[["a2",23,1,1250],["a1",23,13,500]]',
      );
      expect(store.getState().categories.byId.has(1000)).toBe(false);
    });
  });

  describe('when a category is hidden', () => {
    it('should stop offering it and remember that', () => {
      const store = createStore();

      expect(store.setCategoryHidden(3, true)).toBe(true);

      expect(localStorage.getItem('mm:hidden')).toBe('[3]');
      expect(
        store
          .getState()
          .categories.visibleByKind[TransactionKind.Expense].some(
            ({ id }) => id === 3,
          ),
      ).toBe(false);
    });

    it('should offer it again once it is shown', () => {
      localStorage.setItem('mm:hidden', '[3]');
      const store = createStore();

      store.setCategoryHidden(3, false);

      expect(localStorage.getItem('mm:hidden')).toBeNull();
      expect(store.getState().categories.hiddenIds.size).toBe(0);
    });

    it('should refuse to hide Other', () => {
      const store = createStore();

      expect(store.setCategoryHidden(9, true)).toBe(false);
    });
  });

  it('should count a transaction of an unknown category as Other', () => {
    localStorage.setItem('mm:tx:202611', '[["a1",23,1000,500]]');

    const store = createStore();

    expect(store.getState().transactions[0].categoryId).toBe(9);
  });

  describe('when a backup is imported', () => {
    it('should add its custom categories and transactions', () => {
      localStorage.setItem('mm:categories', COFFEE_JSON);
      localStorage.setItem('mm:tx:202611', '[["a1",23,1,1250]]');
      const store = createStore();

      store.importBackup(
        createBackup({
          categories: [
            {
              key: 'custom-1000',
              label: 'Pets',
              kind: TransactionKind.Expense,
              icon: 'dog',
            },
          ],
          hiddenCategoryKeys: ['transport'],
          transactions: [
            {
              id: 'b1',
              day: 20261005,
              categoryKey: 'custom-1000',
              amount: 800,
            },
          ],
          currency: 'EUR',
        }),
        ImportMode.Merge,
      );

      expect(store.getState().categories.customCategories).toEqual([
        { id: 1000, kind: 'expense', label: 'Coffee', icon: 'coffee' },
        { id: 1005, kind: 'expense', label: 'Pets', icon: 'dog' },
      ]);
      expect(localStorage.getItem('mm:tx:202610')).toBe('[["b1",5,1005,800]]');
      // Merging keeps this device's own settings.
      expect(store.getState().categories.hiddenIds.size).toBe(0);
      expect(store.getState().settings.currency).toBe('USD');
    });

    it('should take over everything from the backup when replacing', () => {
      localStorage.setItem('mm:categories', COFFEE_JSON);
      localStorage.setItem('mm:tx:202611', '[["a1",23,1000,500]]');
      const store = createStore();

      store.importBackup(
        createBackup({
          hiddenCategoryKeys: ['transport'],
          transactions: [
            { id: 'b1', day: 20261005, categoryKey: 'food', amount: 800 },
          ],
          currency: 'EUR',
        }),
        ImportMode.Replace,
      );

      expect(localStorage.getItem('mm:categories')).toBeNull();
      expect(localStorage.getItem('mm:tx:202611')).toBeNull();
      expect(localStorage.getItem('mm:hidden')).toBe('[3]');
      expect(store.getState().settings.currency).toBe('EUR');
    });
  });

  it('should erase transactions and custom categories but keep settings', () => {
    localStorage.setItem('mm:categories', COFFEE_JSON);
    localStorage.setItem('mm:tx:202611', '[["a1",23,1000,500]]');
    localStorage.setItem('mm:hidden', '[3]');
    localStorage.setItem('mm:settings', '{"currency":"CZK","theme":"dark"}');
    const store = createStore();

    store.eraseData();

    expect(localStorage.getItem('mm:categories')).toBeNull();
    expect(localStorage.getItem('mm:tx:202611')).toBeNull();
    expect(localStorage.getItem('mm:hidden')).toBeNull();
    expect(store.getState().settings).toEqual({
      currency: 'CZK',
      theme: 'dark',
    });
  });

  describe('when cloud sync is off', () => {
    it('should not keep track of changes', () => {
      const store = createStore();

      store.addTransaction({ day: 20261123, categoryId: 1, amount: 1250 });

      expect(store.getState().sync).toBeNull();
      expect(localStorage.getItem('mm:sync')).toBeNull();
    });
  });

  describe('when cloud sync is on', () => {
    it('should note every change as still to be sent', () => {
      localStorage.setItem('mm:tx:202611', '[["a1",23,1,1250]]');
      const store = createStore();
      store.enableSync(TOKEN);

      const added = store.addTransaction({
        day: 20261123,
        categoryId: 1,
        amount: 500,
      });
      store.deleteTransaction('a1');
      store.setCategoryHidden(3, true);

      expect(store.getState().sync?.pending).toEqual({
        upsertedTransactionIds: [added?.id],
        deletedTransactionIds: ['a1'],
        upsertedCategoryIds: [],
        deletedCategoryIds: [],
        hasSettingsChange: true,
      });
    });

    it('should remember what is still to be sent after a restart', () => {
      const store = createStore();
      store.enableSync(TOKEN);
      const added = store.addTransaction({
        day: 20261123,
        categoryId: 1,
        amount: 500,
      });

      const restarted = createStore();

      expect(restarted.getState().sync).toMatchObject({
        token: TOKEN,
        version: null,
        pending: { upsertedTransactionIds: [added?.id] },
      });
    });

    it('should not sync a change of theme, which belongs to the device', () => {
      const store = createStore();
      store.enableSync(TOKEN);
      const generation = store.getGeneration();

      store.updateSettings({ theme: 'dark' as never });

      expect(store.getGeneration()).toBe(generation);
      expect(store.getState().sync?.pending.hasSettingsChange).toBe(false);
    });

    describe('and a sync finishes', () => {
      it('should have nothing left to send', () => {
        const store = createStore();
        store.enableSync(TOKEN);
        store.addTransaction({ day: 20261123, categoryId: 1, amount: 500 });

        store.markSynced('v1', store.getGeneration());

        expect(store.getState().sync).toMatchObject({
          version: 'v1',
          syncedAt: Date.UTC(2025, 0, 1, 0, 0, 5),
          pending: { upsertedTransactionIds: [] },
        });
      });

      it('should keep what changed while the sync was running', () => {
        const store = createStore();
        store.enableSync(TOKEN);
        const generation = store.getGeneration();
        const added = store.addTransaction({
          day: 20261123,
          categoryId: 1,
          amount: 500,
        });

        store.markSynced('v1', generation);

        expect(store.getState().sync?.pending.upsertedTransactionIds).toEqual([
          added?.id,
        ]);
      });
    });
  });

  describe('when the cloud copy is brought in', () => {
    it('should take it over on a device that has no data yet', () => {
      const store = createStore();
      store.enableSync(TOKEN);

      store.applyRemote(
        createSnapshot({
          transactions: [createRemote('r1')],
          customCategories: [
            {
              id: 2000,
              kind: TransactionKind.Expense,
              label: 'Pets',
              icon: 'dog',
            },
          ],
          hiddenCategoryIds: [3],
          currency: 'EUR',
        }),
        'v1',
      );

      expect(store.getState().transactions).toEqual([createRemote('r1')]);
      expect(store.getState().categories.byId.get(2000)?.label).toBe('Pets');
      expect(localStorage.getItem('mm:hidden')).toBe('[3]');
      expect(store.getState().settings.currency).toBe('EUR');
      expect(store.getState().sync).toMatchObject({
        version: 'v1',
        pending: { upsertedTransactionIds: [], hasSettingsChange: false },
      });
    });

    it('should drop what another device deleted', () => {
      localStorage.setItem(
        'mm:tx:202611',
        '[["a1",23,1,1250],["a2",23,1,500]]',
      );
      const store = createSyncedStore();

      store.applyRemote(
        createSnapshot({ transactions: [createRemote('a2')] }),
        'v2',
      );

      expect(store.getState().transactions.map(({ id }) => id)).toEqual(['a2']);
      expect(localStorage.getItem('mm:tx:202611')).toBe('[["a2",23,1,1250]]');
    });

    it('should keep what this device added and has not sent yet', () => {
      const store = createSyncedStore();
      const added = store.addTransaction({
        day: 20261123,
        categoryId: 1,
        amount: 500,
      });

      store.applyRemote(
        createSnapshot({ transactions: [createRemote('r1')] }),
        'v2',
      );

      expect(
        store
          .getState()
          .transactions.map(({ id }) => id)
          .sort(),
      ).toEqual([added?.id, 'r1'].sort());
    });

    it('should not bring back what this device deleted and has not sent yet', () => {
      localStorage.setItem('mm:tx:202611', '[["a1",23,1,1250]]');
      const store = createSyncedStore();
      store.deleteTransaction('a1');

      store.applyRemote(
        createSnapshot({ transactions: [createRemote('a1')] }),
        'v2',
      );

      expect(store.getState().transactions).toEqual([]);
    });

    describe('for the first time, on a device that already has data', () => {
      it('should keep both sides and match custom categories by name', () => {
        localStorage.setItem('mm:categories', COFFEE_JSON);
        localStorage.setItem('mm:tx:202611', '[["a1",23,1000,450]]');
        const store = createStore();
        store.enableSync(TOKEN);

        store.applyRemote(
          createSnapshot({
            transactions: [createRemote('r1', 2000), createRemote('r2', 1000)],
            customCategories: [
              // The same id as this device's Coffee, but another category.
              {
                id: 1000,
                kind: TransactionKind.Expense,
                label: 'Pets',
                icon: 'dog',
              },
              {
                id: 2000,
                kind: TransactionKind.Expense,
                label: 'coffee',
                icon: 'coffee',
              },
            ],
          }),
          'v1',
        );

        const { transactions, categories, sync } = store.getState();
        const labelOf = (id: string): string | undefined =>
          categories.byId.get(
            transactions.find((transaction) => transaction.id === id)
              ?.categoryId ?? 0,
          )?.label;
        expect(labelOf('a1')).toBe('coffee');
        expect(labelOf('r1')).toBe('coffee');
        expect(labelOf('r2')).toBe('Pets');
        expect(categories.customCategories).toHaveLength(2);
        expect(sync?.pending.upsertedTransactionIds).toEqual(['a1']);
      });
    });
  });
});

function createBackup(parts: Partial<ParsedBackup>): ParsedBackup {
  return {
    categories: [],
    hiddenCategoryKeys: [],
    transactions: [],
    skippedCount: 0,
    currency: undefined,
    ...parts,
  };
}

function createSnapshot(parts: Partial<DataSnapshot>): DataSnapshot {
  return {
    transactions: [],
    customCategories: [],
    hiddenCategoryIds: [],
    currency: 'USD',
    ...parts,
  };
}

function createRemote(id: string, categoryId: number = 1): Transaction {
  return { id, day: 20261123, categoryId, amount: 1250 };
}

/** A store with sync on that already matches the cloud copy "v1". */
function createSyncedStore(): ReturnType<typeof createStore> {
  const store = createStore();
  store.enableSync(TOKEN);
  store.markSynced('v1', store.getGeneration());
  return store;
}
