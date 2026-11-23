import { describe, expect, it } from 'vitest';
import { createStore } from './store';
import { ImportMode, TransactionKind } from './types';

describe('createStore', () => {
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
        id: 1000,
        kind: 'expense',
        label: 'Coffee',
        icon: 'coffee',
      });
      expect(localStorage.getItem('mm:categories')).toBe(
        '[{"id":1000,"kind":"expense","label":"Coffee","icon":"coffee"}]',
      );
      expect(store.getState().categories.byId.get(1000)?.label).toBe('Coffee');
    });
  });

  describe('when a custom category is edited', () => {
    it('should change its name and icon but keep its type', () => {
      localStorage.setItem(
        'mm:categories',
        '[{"id":1000,"kind":"expense","label":"Coffee","icon":"coffee"}]',
      );
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
      const store = createStore();

      expect(store.deleteCategory(1000)).toBe(true);

      expect(localStorage.getItem('mm:categories')).toBeNull();
      expect(localStorage.getItem('mm:tx:202611')).toBe(
        '[["a2",23,1,1250],["a1",23,13,500]]',
      );
      expect(store.getState().categories.byId.has(1000)).toBe(false);
    });
  });

  it('should count a transaction of an unknown category as Other', () => {
    localStorage.setItem('mm:tx:202611', '[["a1",23,1000,500]]');

    const store = createStore();

    expect(store.getState().transactions[0].categoryId).toBe(9);
  });

  describe('when a backup is imported', () => {
    it('should add its custom categories and transactions', () => {
      localStorage.setItem(
        'mm:categories',
        '[{"id":1000,"kind":"expense","label":"Coffee","icon":"coffee"}]',
      );
      const store = createStore();

      store.importBackup(
        {
          categories: [
            {
              key: 'custom-1000',
              label: 'Pets',
              kind: TransactionKind.Expense,
              icon: 'dog',
            },
          ],
          transactions: [
            {
              id: 'b1',
              day: 20261005,
              categoryKey: 'custom-1000',
              amount: 800,
            },
          ],
          skippedCount: 0,
          currency: undefined,
        },
        ImportMode.Merge,
      );

      expect(store.getState().categories.customCategories).toEqual([
        { id: 1000, kind: 'expense', label: 'Coffee', icon: 'coffee' },
        { id: 1001, kind: 'expense', label: 'Pets', icon: 'dog' },
      ]);
      expect(localStorage.getItem('mm:tx:202610')).toBe('[["b1",5,1001,800]]');
    });

    it('should drop the custom categories of this device when replacing', () => {
      localStorage.setItem(
        'mm:categories',
        '[{"id":1000,"kind":"expense","label":"Coffee","icon":"coffee"}]',
      );
      localStorage.setItem('mm:tx:202611', '[["a1",23,1000,500]]');
      const store = createStore();

      store.importBackup(
        {
          categories: [],
          transactions: [
            { id: 'b1', day: 20261005, categoryKey: 'food', amount: 800 },
          ],
          skippedCount: 0,
          currency: 'EUR',
        },
        ImportMode.Replace,
      );

      expect(localStorage.getItem('mm:categories')).toBeNull();
      expect(localStorage.getItem('mm:tx:202611')).toBeNull();
      expect(store.getState().settings.currency).toBe('EUR');
    });
  });

  it('should erase transactions and custom categories but keep settings', () => {
    localStorage.setItem(
      'mm:categories',
      '[{"id":1000,"kind":"expense","label":"Coffee","icon":"coffee"}]',
    );
    localStorage.setItem('mm:tx:202611', '[["a1",23,1000,500]]');
    localStorage.setItem('mm:settings', '{"currency":"CZK","theme":"dark"}');
    const store = createStore();

    store.eraseData();

    expect(localStorage.getItem('mm:categories')).toBeNull();
    expect(localStorage.getItem('mm:tx:202611')).toBeNull();
    expect(store.getState().settings).toEqual({
      currency: 'CZK',
      theme: 'dark',
    });
  });
});
