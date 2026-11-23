import { isCategoryId, parseCustomCategories } from './categories';
import { getMonthKey, isValidDayKey } from './dates';
import { isValidAmount, sortTransactions } from './transactions';
import type { CustomCategory, Settings, Transaction } from './types';

/**
 * Browsers give each site about 5 MB of local storage. Counting two bytes
 * per character is the strictest way a browser counts it, so the space left
 * is never overstated.
 */
export const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

const BYTES_PER_CHARACTER = 2;
const TYPICAL_TRANSACTION_BYTES = 50;

// Sites on the same origin share storage, so every key carries a prefix.
const SETTINGS_KEY = 'mm:settings';
const CATEGORIES_KEY = 'mm:categories';
const MONTH_KEY_PREFIX = 'mm:tx:';

/** One transaction as saved: [id, day of month, category id, amount]. */
type StoredTransaction = [string, number, number, number];

/** What to save, by storage key. A null value removes the key. */
export type StorageEntries = ReadonlyMap<string, string | null>;

export interface StorageUsage {
  usedBytes: number;
  freeBytes: number;
  quotaBytes: number;
  usedRatio: number;
  /** A rough count of how many more transactions will fit. */
  remainingTransactions: number;
}

export function loadTransactions(): Array<Transaction> {
  const transactions = getStorageKeys()
    .filter((key) => key.startsWith(MONTH_KEY_PREFIX))
    .flatMap((key) =>
      decodeMonth(
        Number(key.slice(MONTH_KEY_PREFIX.length)),
        localStorage.getItem(key),
      ),
    );
  return sortTransactions(transactions);
}

export function loadSettings(): Partial<Settings> {
  const parsed = parseJson(localStorage.getItem(SETTINGS_KEY));
  return typeof parsed === 'object' && parsed !== null ? parsed : {};
}

export function loadCustomCategories(): Array<CustomCategory> {
  return parseCustomCategories(parseJson(localStorage.getItem(CATEGORIES_KEY)));
}

/**
 * Entries for the given months. Transactions are saved one month per key,
 * so a change rewrites a few kilobytes at most, however long the history.
 */
export function getMonthEntries(
  transactions: ReadonlyArray<Transaction>,
  monthKeys: Iterable<number>,
): StorageEntries {
  const byMonth = groupByMonth(transactions);
  const entries = new Map<string, string | null>();
  for (const monthKey of monthKeys) {
    entries.set(
      MONTH_KEY_PREFIX + monthKey,
      encodeMonth(byMonth.get(monthKey) ?? []),
    );
  }
  return entries;
}

/** Entries that replace every saved month, removing ones now empty. */
export function getAllMonthEntries(
  transactions: ReadonlyArray<Transaction>,
): StorageEntries {
  const entries = new Map<string, string | null>(
    getStorageKeys()
      .filter((key) => key.startsWith(MONTH_KEY_PREFIX))
      .map((key) => [key, null]),
  );
  groupByMonth(transactions).forEach((monthTransactions, monthKey) =>
    entries.set(MONTH_KEY_PREFIX + monthKey, encodeMonth(monthTransactions)),
  );
  return entries;
}

export function getSettingsEntries(settings: Settings): StorageEntries {
  return new Map([[SETTINGS_KEY, JSON.stringify(settings)]]);
}

export function getCategoryEntries(
  customCategories: ReadonlyArray<CustomCategory>,
): StorageEntries {
  return new Map([
    [
      CATEGORIES_KEY,
      customCategories.length > 0 ? JSON.stringify(customCategories) : null,
    ],
  ]);
}

/**
 * Writes all entries as one step. If any write fails (for example because
 * storage is full), everything is put back as it was and the error is
 * rethrown, so saved data never ends up half-updated.
 */
export function writeEntries(...groups: Array<StorageEntries>): void {
  const entries = new Map<string, string | null>();
  groups.forEach((group) =>
    group.forEach((value, key) => entries.set(key, value)),
  );
  const previous = new Map<string, string | null>();
  try {
    entries.forEach((value, key) => {
      previous.set(key, localStorage.getItem(key));
      writeEntry(key, value);
    });
  } catch (error) {
    previous.forEach((value, key) => writeEntry(key, value));
    throw error;
  }
}

export function measureStorage(transactionCount: number): StorageUsage {
  let usedBytes = 0;
  let transactionBytes = 0;
  getStorageKeys().forEach((key) => {
    const size =
      (key.length + (localStorage.getItem(key)?.length ?? 0)) *
      BYTES_PER_CHARACTER;
    usedBytes += size;
    if (key.startsWith(MONTH_KEY_PREFIX)) {
      transactionBytes += size;
    }
  });
  const freeBytes = Math.max(0, STORAGE_QUOTA_BYTES - usedBytes);
  const bytesPerTransaction =
    transactionCount > 0
      ? transactionBytes / transactionCount
      : TYPICAL_TRANSACTION_BYTES;
  return {
    usedBytes,
    freeBytes,
    quotaBytes: STORAGE_QUOTA_BYTES,
    usedRatio: Math.min(1, usedBytes / STORAGE_QUOTA_BYTES),
    remainingTransactions: Math.floor(freeBytes / bytesPerTransaction),
  };
}

/** Returns null for an empty month, which removes its key. */
export function encodeMonth(
  transactions: ReadonlyArray<Transaction>,
): string | null {
  if (transactions.length === 0) {
    return null;
  }
  const stored = transactions.map(
    ({ id, day, categoryId, amount }): StoredTransaction => [
      id,
      day % 100,
      categoryId,
      amount,
    ],
  );
  return JSON.stringify(stored);
}

/**
 * Reads one saved month. Category ids are kept as they are, even unknown
 * ones; the store decides how to show those.
 */
export function decodeMonth(
  monthKey: number,
  text: string | null,
): Array<Transaction> {
  const parsed = parseJson(text);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.flatMap((item) => {
    const transaction = toTransaction(monthKey, item);
    return transaction ? [transaction] : [];
  });
}

function toTransaction(
  monthKey: number,
  stored: unknown,
): Transaction | undefined {
  if (!Array.isArray(stored)) {
    return undefined;
  }
  const [id, dayOfMonth, categoryId, amount] = stored;
  const day = monthKey * 100 + dayOfMonth;
  if (
    typeof id !== 'string' ||
    !isValidDayKey(day) ||
    !isCategoryId(categoryId) ||
    !isValidAmount(amount)
  ) {
    return undefined;
  }
  return { id, day, categoryId, amount };
}

function groupByMonth(
  transactions: ReadonlyArray<Transaction>,
): Map<number, Array<Transaction>> {
  const byMonth = new Map<number, Array<Transaction>>();
  for (const transaction of transactions) {
    const monthKey = getMonthKey(transaction.day);
    const month = byMonth.get(monthKey);
    if (month) {
      month.push(transaction);
    } else {
      byMonth.set(monthKey, [transaction]);
    }
  }
  return byMonth;
}

function writeEntry(key: string, value: string | null): void {
  if (value === null) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, value);
}

function getStorageKeys(): Array<string> {
  const keys: Array<string> = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key !== null) {
      keys.push(key);
    }
  }
  return keys;
}

function parseJson(text: string | null): unknown {
  if (text === null) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
