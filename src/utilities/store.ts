import { resolveBackup, type ParsedBackup } from './backup';
import {
  createCatalog,
  createCategoryId,
  getFallbackCategory,
  normalizeLabel,
  type CategoryCatalog,
} from './categories';
import { getMonthKey } from './dates';
import { guessCurrency, isSupportedCurrency } from './money';
import {
  getAllMonthEntries,
  getCategoryEntries,
  getMonthEntries,
  getSettingsEntries,
  loadCustomCategories,
  loadSettings,
  loadTransactions,
  writeEntries,
  type StorageEntries,
} from './storage';
import {
  createTransactionId,
  getMonthKeys,
  mergeTransactions,
  removeTransaction,
  sortTransactions,
  upsertTransaction,
} from './transactions';
import {
  ImportMode,
  ThemePreference,
  TransactionKind,
  type AppState,
  type CategoryDraft,
  type CustomCategory,
  type Settings,
  type Transaction,
  type TransactionInput,
} from './types';

const THEME_PREFERENCES: ReadonlyArray<string> = Object.values(ThemePreference);

/**
 * The single place that owns app data. Every change is written to the
 * device first and only then shown, so the screen never shows something
 * that was not saved. Changes report whether the save worked.
 *
 * To move to another kind of storage later, only `storage.ts` and this
 * file need to change.
 */
export interface Store {
  getState: () => AppState;
  subscribe: (listener: () => void) => () => void;
  /** Returns the new transaction, or undefined when it could not be saved. */
  addTransaction: (input: TransactionInput) => Transaction | undefined;
  /** Updates a transaction, or puts back one that was deleted. */
  saveTransaction: (transaction: Transaction) => boolean;
  deleteTransaction: (id: string) => boolean;
  /**
   * Creates a custom category, or updates the name and icon of one. Returns
   * it, or undefined when it could not be saved.
   */
  saveCategory: (draft: CategoryDraft) => CustomCategory | undefined;
  /** Deletes a custom category and moves its transactions to Other. */
  deleteCategory: (id: number) => boolean;
  importBackup: (backup: ParsedBackup, mode: ImportMode) => boolean;
  /** Removes all transactions and custom categories. Settings are kept. */
  eraseData: () => boolean;
  updateSettings: (changes: Partial<Settings>) => boolean;
}

export function createStore(): Store {
  let state = readState();
  const listeners = new Set<() => void>();

  function setState(next: AppState): void {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function commit(
    changes: Partial<AppState>,
    ...entries: Array<StorageEntries>
  ): boolean {
    try {
      writeEntries(...entries);
    } catch (error) {
      console.error('Saving failed', error);
      return false;
    }
    setState({ ...state, ...changes });
    return true;
  }

  // Keeps two open tabs of the app in step with each other.
  window.addEventListener('storage', () => setState(readState()));

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    addTransaction: (input) => {
      const transaction = withKnownCategory(
        { ...input, id: createTransactionId(Date.now(), state.transactions) },
        state.categories,
      );
      const transactions = upsertTransaction(state.transactions, transaction);
      const isSaved = commit(
        { transactions },
        getMonthEntries(transactions, [getMonthKey(transaction.day)]),
      );
      return isSaved ? transaction : undefined;
    },
    saveTransaction: (changed) => {
      const transaction = withKnownCategory(changed, state.categories);
      const previous = state.transactions.find(
        ({ id }) => id === transaction.id,
      );
      const monthKeys = new Set([getMonthKey(transaction.day)]);
      if (previous) {
        monthKeys.add(getMonthKey(previous.day));
      }
      const transactions = upsertTransaction(state.transactions, transaction);
      return commit({ transactions }, getMonthEntries(transactions, monthKeys));
    },
    deleteTransaction: (id) => {
      const existing = state.transactions.find(
        (transaction) => transaction.id === id,
      );
      if (!existing) {
        return true;
      }
      const transactions = removeTransaction(state.transactions, id);
      return commit(
        { transactions },
        getMonthEntries(transactions, [getMonthKey(existing.day)]),
      );
    },
    saveCategory: (draft) => {
      const current = state.categories.customCategories;
      const existing = current.find(({ id }) => id === draft.id);
      if (draft.id !== null && !existing) {
        return undefined;
      }
      const label = normalizeLabel(draft.label);
      const category: CustomCategory = existing
        ? { ...existing, label, icon: draft.icon }
        : {
            id: createCategoryId(current),
            kind: draft.kind,
            label,
            icon: draft.icon,
          };
      const customCategories = existing
        ? current.map((item) => (item.id === category.id ? category : item))
        : [...current, category];
      const isSaved = commit(
        { categories: createCatalog(customCategories) },
        getCategoryEntries(customCategories),
      );
      return isSaved ? category : undefined;
    },
    deleteCategory: (id) => {
      const existing = state.categories.customCategories.find(
        (category) => category.id === id,
      );
      if (!existing) {
        return true;
      }
      const fallbackId = getFallbackCategory(existing.kind).id;
      const moved = state.transactions.filter(
        ({ categoryId }) => categoryId === id,
      );
      const transactions = state.transactions.map((transaction) =>
        transaction.categoryId === id
          ? { ...transaction, categoryId: fallbackId }
          : transaction,
      );
      const customCategories = state.categories.customCategories.filter(
        (category) => category.id !== id,
      );
      return commit(
        { transactions, categories: createCatalog(customCategories) },
        getMonthEntries(transactions, getMonthKeys(moved)),
        getCategoryEntries(customCategories),
      );
    },
    importBackup: (backup, mode) => {
      const isReplacing = mode === ImportMode.Replace;
      const resolved = resolveBackup(
        backup,
        isReplacing ? createCatalog([]) : state.categories,
      );
      const transactions = isReplacing
        ? sortTransactions(resolved.transactions)
        : mergeTransactions(state.transactions, resolved.transactions);
      // The backup's currency only applies when its data becomes all the data.
      const adoptsCurrency = isReplacing || state.transactions.length === 0;
      const settings =
        adoptsCurrency && backup.currency
          ? { ...state.settings, currency: backup.currency }
          : state.settings;
      return commit(
        {
          transactions,
          settings,
          categories: createCatalog(resolved.customCategories),
        },
        getAllMonthEntries(transactions),
        getCategoryEntries(resolved.customCategories),
        getSettingsEntries(settings),
      );
    },
    eraseData: () =>
      commit(
        { transactions: [], categories: createCatalog([]) },
        getAllMonthEntries([]),
        getCategoryEntries([]),
      ),
    updateSettings: (changes) => {
      const settings = { ...state.settings, ...changes };
      return commit({ settings }, getSettingsEntries(settings));
    },
  };
}

function readState(): AppState {
  try {
    const categories = createCatalog(loadCustomCategories());
    return {
      transactions: loadTransactions().map((transaction) =>
        withKnownCategory(transaction, categories),
      ),
      settings: resolveSettings(loadSettings()),
      categories,
    };
  } catch (error) {
    // Storage can be blocked entirely, for example in some private modes.
    console.error('Reading saved data failed', error);
    return {
      transactions: [],
      settings: resolveSettings({}),
      categories: createCatalog([]),
    };
  }
}

/** A transaction whose category no longer exists is counted as Other. */
function withKnownCategory<T extends { categoryId: number }>(
  item: T,
  categories: CategoryCatalog,
): T {
  return categories.byId.has(item.categoryId)
    ? item
    : { ...item, categoryId: getFallbackCategory(TransactionKind.Expense).id };
}

function resolveSettings(stored: Partial<Settings>): Settings {
  return {
    currency: isSupportedCurrency(stored.currency)
      ? stored.currency
      : guessCurrency(navigator.language),
    theme:
      stored.theme && THEME_PREFERENCES.includes(stored.theme)
        ? stored.theme
        : ThemePreference.System,
  };
}
