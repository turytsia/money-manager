import { FALLBACK_CATEGORY_ID, isKnownCategoryId } from './categories';
import { getMonthKey, isValidDayKey } from './dates';
import { getMonthKeys, isValidAmount, sortTransactions } from './transactions';
import type { Settings, Transaction } from './types';

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
const MONTH_KEY_PREFIX = 'mm:tx:';

/** One transaction as saved: [id, day of month, category id, amount]. */
type StoredTransaction = [string, number, number, number];

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

/**
 * Transactions are saved one month per key, so a change rewrites a few
 * kilobytes at most, however long the history gets.
 */
export function saveMonths(
  transactions: ReadonlyArray<Transaction>,
  monthKeys: Iterable<number>,
): void {
  const entries = new Map<string, string | null>();
  for (const monthKey of monthKeys) {
    entries.set(
      MONTH_KEY_PREFIX + monthKey,
      encodeMonth(
        transactions.filter(({ day }) => getMonthKey(day) === monthKey),
      ),
    );
  }
  writeEntries(entries);
}

export function replaceTransactions(
  transactions: ReadonlyArray<Transaction>,
): void {
  const entries = new Map<string, string | null>();
  getStorageKeys()
    .filter((key) => key.startsWith(MONTH_KEY_PREFIX))
    .forEach((key) => entries.set(key, null));
  getMonthKeys(transactions).forEach((monthKey) =>
    entries.set(
      MONTH_KEY_PREFIX + monthKey,
      encodeMonth(
        transactions.filter(({ day }) => getMonthKey(day) === monthKey),
      ),
    ),
  );
  writeEntries(entries);
}

export function loadSettings(): Partial<Settings> {
  const parsed = parseJson(localStorage.getItem(SETTINGS_KEY));
  return typeof parsed === 'object' && parsed !== null ? parsed : {};
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
  if (typeof id !== 'string' || !isValidDayKey(day) || !isValidAmount(amount)) {
    return undefined;
  }
  return {
    id,
    day,
    amount,
    categoryId: isKnownCategoryId(categoryId)
      ? categoryId
      : FALLBACK_CATEGORY_ID,
  };
}

/**
 * Writes several keys as one step. If any write fails (for example because
 * storage is full), everything is put back as it was and the error is
 * rethrown, so saved data never ends up half-updated.
 */
function writeEntries(entries: ReadonlyMap<string, string | null>): void {
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
