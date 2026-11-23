import { getMonthKey } from './dates';
import { guessCurrency, isSupportedCurrency } from './money';
import {
  loadSettings,
  loadTransactions,
  replaceTransactions,
  saveMonths,
  saveSettings,
} from './storage';
import {
  createTransactionId,
  mergeTransactions,
  removeTransaction,
  sortTransactions,
  upsertTransaction,
} from './transactions';
import {
  ImportMode,
  ThemePreference,
  type AppState,
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
  importTransactions: (
    transactions: ReadonlyArray<Transaction>,
    mode: ImportMode,
    currency: string | undefined,
  ) => boolean;
  eraseTransactions: () => boolean;
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
    transactions: ReadonlyArray<Transaction>,
    write: () => void,
    settings: Settings = state.settings,
  ): boolean {
    try {
      write();
    } catch (error) {
      console.error('Saving failed', error);
      return false;
    }
    setState({ transactions, settings });
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
      const transaction: Transaction = {
        ...input,
        id: createTransactionId(Date.now(), state.transactions),
      };
      const transactions = upsertTransaction(state.transactions, transaction);
      const isSaved = commit(transactions, () =>
        saveMonths(transactions, [getMonthKey(transaction.day)]),
      );
      return isSaved ? transaction : undefined;
    },
    saveTransaction: (transaction) => {
      const previous = state.transactions.find(
        ({ id }) => id === transaction.id,
      );
      const monthKeys = new Set([getMonthKey(transaction.day)]);
      if (previous) {
        monthKeys.add(getMonthKey(previous.day));
      }
      const transactions = upsertTransaction(state.transactions, transaction);
      return commit(transactions, () => saveMonths(transactions, monthKeys));
    },
    deleteTransaction: (id) => {
      const existing = state.transactions.find(
        (transaction) => transaction.id === id,
      );
      if (!existing) {
        return true;
      }
      const transactions = removeTransaction(state.transactions, id);
      return commit(transactions, () =>
        saveMonths(transactions, [getMonthKey(existing.day)]),
      );
    },
    importTransactions: (incoming, mode, currency) => {
      const transactions =
        mode === ImportMode.Replace
          ? sortTransactions(incoming)
          : mergeTransactions(state.transactions, incoming);
      const settings = currency
        ? { ...state.settings, currency }
        : state.settings;
      return commit(
        transactions,
        () => {
          replaceTransactions(transactions);
          saveSettings(settings);
        },
        settings,
      );
    },
    eraseTransactions: () => commit([], () => replaceTransactions([])),
    updateSettings: (changes) => {
      const settings = { ...state.settings, ...changes };
      return commit(state.transactions, () => saveSettings(settings), settings);
    },
  };
}

function readState(): AppState {
  try {
    return {
      transactions: loadTransactions(),
      settings: resolveSettings(loadSettings()),
    };
  } catch (error) {
    // Storage can be blocked entirely, for example in some private modes.
    console.error('Reading saved data failed', error);
    return { transactions: [], settings: resolveSettings({}) };
  }
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
