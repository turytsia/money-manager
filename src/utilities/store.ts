import {
  createBackupDocument,
  parseBackupDocument,
  resolveBackup,
  type ParsedBackup,
} from './backup';
import {
  canHideCategory,
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
  getHiddenCategoryEntries,
  getMonthEntries,
  getSettingsEntries,
  getSyncEntries,
  loadCustomCategories,
  loadHiddenCategoryIds,
  loadSettings,
  loadSyncState,
  loadTransactions,
  writeEntries,
  type StorageEntries,
} from './storage';
import { mergeRemote } from './sync/mergeRemote';
import {
  getAllAsPending,
  NO_PENDING_CHANGES,
  recordChange,
  type DataChange,
} from './sync/pendingChanges';
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
  type DataSnapshot,
  type PendingChanges,
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
 * While cloud sync is on, every change is also noted as "not sent yet" in
 * the same write, so a change can never be saved without being noted.
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
  /** Deletes a custom category. Its transactions become Uncategorized. */
  deleteCategory: (id: number) => boolean;
  /** Shows or hides a category in the list offered when adding. */
  setCategoryHidden: (id: number, isHidden: boolean) => boolean;
  importBackup: (backup: ParsedBackup, mode: ImportMode) => boolean;
  /** Removes all transactions and custom categories. Settings are kept. */
  eraseData: () => boolean;
  updateSettings: (changes: Partial<Settings>) => boolean;
  /** Turns cloud sync on. The first sync still has to be run. */
  enableSync: (token: string) => boolean;
  disableSync: () => boolean;
  /**
   * A number that goes up with every change to the data. Sync uses it to
   * tell whether anything changed while it was talking to the server.
   */
  getGeneration: () => number;
  /** Brings in the cloud copy, keeping changes that were not sent yet. */
  applyRemote: (remote: DataSnapshot, version: string) => boolean;
  /**
   * Notes that the cloud copy now holds what this device had when its
   * generation was `syncedGeneration`.
   */
  markSynced: (version: string, syncedGeneration: number) => boolean;
}

interface FirstSyncMerge {
  snapshot: DataSnapshot;
  pending: PendingChanges;
}

export function createStore(): Store {
  let state = readState();
  let generation = 0;
  const listeners = new Set<() => void>();

  function write(entries: ReadonlyArray<StorageEntries>): boolean {
    try {
      writeEntries(...entries);
      return true;
    } catch (error) {
      console.error('Saving failed', error);
      return false;
    }
  }

  function notify(): void {
    listeners.forEach((listener) => listener());
  }

  /** Saves something that sync itself changed, or that is not synced. */
  function save(next: AppState, ...entries: Array<StorageEntries>): boolean {
    if (!write(entries)) {
      return false;
    }
    state = next;
    notify();
    return true;
  }

  /** Saves a change made on this device and notes it for the next sync. */
  function commit(
    changes: Partial<AppState>,
    dataChange: DataChange,
    ...entries: Array<StorageEntries>
  ): boolean {
    const sync = state.sync && {
      ...state.sync,
      pending: recordChange(state.sync.pending, dataChange),
    };
    if (!write([...entries, getSyncEntries(sync)])) {
      return false;
    }
    state = { ...state, ...changes, sync };
    // Counted before listeners hear of it, so they can see that it changed.
    generation += 1;
    notify();
    return true;
  }

  // Keeps two open tabs of the app in step with each other.
  window.addEventListener('storage', () => {
    state = readState();
    generation += 1;
    notify();
  });

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
        { upsertedTransactionIds: [transaction.id] },
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
      return commit(
        { transactions },
        { upsertedTransactionIds: [transaction.id] },
        getMonthEntries(transactions, monthKeys),
      );
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
        { deletedTransactionIds: [id] },
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
            id: createCategoryId(current, Date.now()),
            kind: draft.kind,
            label,
            icon: draft.icon,
          };
      const customCategories = existing
        ? current.map((item) => (item.id === category.id ? category : item))
        : [...current, category];
      const isSaved = commit(
        {
          categories: createCatalog(
            customCategories,
            state.categories.hiddenIds,
          ),
        },
        { upsertedCategoryIds: [category.id] },
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
      const categories = createCatalog(
        customCategories,
        state.categories.hiddenIds,
      );
      return commit(
        { transactions, categories },
        {
          deletedCategoryIds: [id],
          upsertedTransactionIds: moved.map((transaction) => transaction.id),
          hasSettingsChange: state.categories.hiddenIds.has(id),
        },
        getMonthEntries(transactions, getMonthKeys(moved)),
        getCategoryEntries(customCategories),
        getHiddenCategoryEntries(categories.hiddenIds),
      );
    },
    setCategoryHidden: (id, isHidden) => {
      const category = state.categories.byId.get(id);
      if (!category || !canHideCategory(id)) {
        return false;
      }
      // The last category of a kind stays on, so there is one to pick.
      const shown = state.categories.visibleByKind[category.kind];
      if (isHidden && shown.length === 1 && shown[0].id === id) {
        return false;
      }
      const hiddenIds = new Set(state.categories.hiddenIds);
      if (isHidden) {
        hiddenIds.add(id);
      } else {
        hiddenIds.delete(id);
      }
      return commit(
        {
          categories: createCatalog(
            state.categories.customCategories,
            hiddenIds,
          ),
        },
        { hasSettingsChange: true },
        getHiddenCategoryEntries(hiddenIds),
      );
    },
    importBackup: (backup, mode) => {
      const isReplacing = mode === ImportMode.Replace;
      // The backup's settings only apply when its data becomes all the data.
      const adoptsSettings = isReplacing || state.transactions.length === 0;
      const resolved = resolveBackup(
        backup,
        isReplacing ? createCatalog([]) : state.categories,
        Date.now(),
      );
      const categories = createCatalog(
        resolved.customCategories,
        adoptsSettings
          ? resolved.hiddenCategoryIds
          : state.categories.hiddenIds,
      );
      const transactions = isReplacing
        ? sortTransactions(resolved.transactions)
        : mergeTransactions(state.transactions, resolved.transactions);
      const settings =
        adoptsSettings && backup.currency
          ? { ...state.settings, currency: backup.currency }
          : state.settings;
      const next: AppState = { ...state, transactions, categories, settings };
      return commit(
        next,
        getDifference(state, next),
        getAllMonthEntries(transactions),
        getCategoryEntries(resolved.customCategories),
        getHiddenCategoryEntries(categories.hiddenIds),
        getSettingsEntries(settings),
      );
    },
    eraseData: () => {
      const next: AppState = {
        ...state,
        transactions: [],
        categories: createCatalog([]),
      };
      return commit(
        next,
        getDifference(state, next),
        getAllMonthEntries([]),
        getCategoryEntries([]),
        getHiddenCategoryEntries([]),
      );
    },
    updateSettings: (changes) => {
      const settings = { ...state.settings, ...changes };
      const entries = getSettingsEntries(settings);
      // The theme belongs to this device only, so it is not synced.
      return settings.currency === state.settings.currency
        ? save({ ...state, settings }, entries)
        : commit({ settings }, { hasSettingsChange: true }, entries);
    },
    enableSync: (token) => {
      const sync = {
        token,
        version: null,
        syncedAt: null,
        pending: NO_PENDING_CHANGES,
      };
      return save({ ...state, sync }, getSyncEntries(sync));
    },
    disableSync: () => save({ ...state, sync: null }, getSyncEntries(null)),
    getGeneration: () => generation,
    applyRemote: (remote, version) => {
      if (!state.sync) {
        return false;
      }
      const { snapshot, pending } = combineWithRemote(state, remote);
      const categories = createCatalog(
        snapshot.customCategories,
        snapshot.hiddenCategoryIds,
      );
      const transactions = sortTransactions(
        snapshot.transactions.map((transaction) =>
          withKnownCategory(transaction, categories),
        ),
      );
      const settings = isSupportedCurrency(snapshot.currency)
        ? { ...state.settings, currency: snapshot.currency }
        : state.settings;
      const sync = { ...state.sync, version, pending };
      return save(
        { transactions, settings, categories, sync },
        getAllMonthEntries(transactions),
        getCategoryEntries(snapshot.customCategories),
        getHiddenCategoryEntries(categories.hiddenIds),
        getSettingsEntries(settings),
        getSyncEntries(sync),
      );
    },
    markSynced: (version, syncedGeneration) => {
      if (!state.sync) {
        return false;
      }
      const sync = {
        ...state.sync,
        version,
        syncedAt: Date.now(),
        // Anything changed while the sync ran still has to be sent.
        pending:
          syncedGeneration === generation
            ? NO_PENDING_CHANGES
            : state.sync.pending,
      };
      return save({ ...state, sync }, getSyncEntries(sync));
    },
  };
}

/** The part of the app's state that is backed up and synced. */
export function getSnapshot(state: AppState): DataSnapshot {
  return {
    transactions: state.transactions,
    customCategories: state.categories.customCategories,
    hiddenCategoryIds: [...state.categories.hiddenIds],
    currency: state.settings.currency,
  };
}

function readState(): AppState {
  try {
    const categories = createCatalog(
      loadCustomCategories(),
      loadHiddenCategoryIds(),
    );
    return {
      transactions: loadTransactions().map((transaction) =>
        withKnownCategory(transaction, categories),
      ),
      settings: resolveSettings(loadSettings()),
      categories,
      sync: loadSyncState(),
    };
  } catch (error) {
    // Storage can be blocked entirely, for example in some private modes.
    console.error('Reading saved data failed', error);
    return {
      transactions: [],
      settings: resolveSettings({}),
      categories: createCatalog([]),
      sync: null,
    };
  }
}

function combineWithRemote(
  state: AppState,
  remote: DataSnapshot,
): FirstSyncMerge {
  const { sync, transactions, categories } = state;
  const pending = sync?.pending ?? NO_PENDING_CHANGES;
  if (sync?.version !== null) {
    return {
      snapshot: mergeRemote(getSnapshot(state), remote, pending),
      pending,
    };
  }
  const hasLocalData =
    transactions.length > 0 || categories.customCategories.length > 0;
  return hasLocalData
    ? mergeFirstSync(state, remote)
    : { snapshot: remote, pending: NO_PENDING_CHANGES };
}

/**
 * The first sync of a device that already has data. The two sides never
 * met, so their custom categories may clash. The data of this device is
 * brought in the same way a backup file is: categories are matched by name,
 * and everything is then sent up as new.
 */
function mergeFirstSync(state: AppState, remote: DataSnapshot): FirstSyncMerge {
  const timestamp = Date.now();
  const local = parseBackupDocument(
    createBackupDocument(state, new Date(timestamp)),
  );
  if (!local) {
    const snapshot = getSnapshot(state);
    const pending = getAllAsPending(snapshot);
    return { snapshot: mergeRemote(snapshot, remote, pending), pending };
  }
  const resolved = resolveBackup(
    local,
    createCatalog(remote.customCategories),
    timestamp,
  );
  const snapshot: DataSnapshot = {
    transactions: mergeTransactions(remote.transactions, resolved.transactions),
    customCategories: resolved.customCategories,
    hiddenCategoryIds: resolved.hiddenCategoryIds,
    currency: state.settings.currency,
  };
  return {
    snapshot,
    pending: getAllAsPending({
      ...snapshot,
      transactions: resolved.transactions,
    }),
  };
}

/** What a wholesale change (an import or an erase) added and removed. */
function getDifference(previous: AppState, next: AppState): DataChange {
  const nextSnapshot = getSnapshot(next);
  const transactionIds = new Set(nextSnapshot.transactions.map(({ id }) => id));
  const categoryIds = new Set(
    nextSnapshot.customCategories.map(({ id }) => id),
  );
  return {
    ...getAllAsPending(nextSnapshot),
    deletedTransactionIds: previous.transactions
      .map(({ id }) => id)
      .filter((id) => !transactionIds.has(id)),
    deletedCategoryIds: previous.categories.customCategories
      .map(({ id }) => id)
      .filter((id) => !categoryIds.has(id)),
  };
}

/** A transaction whose category no longer exists is Uncategorized. */
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
