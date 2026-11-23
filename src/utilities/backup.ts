import { findCategoryBySlug, getCategory } from './categories';
import { parseIsoDate, toIsoDate } from './dates';
import { isSupportedCurrency, MINOR_UNITS } from './money';
import { isValidTransaction, mergeTransactions } from './transactions';
import type { AppState, DayKey, Transaction } from './types';

export const BACKUP_FILE_TYPE = 'application/json';

const BACKUP_APP_ID = 'money-manager';
const BACKUP_VERSION = 1;

/** One transaction in a backup file, written to be readable by people. */
interface BackupTransaction {
  id: string;
  date: string;
  category: string;
  amount: number;
}

interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  currency: string;
  transactions: Array<BackupTransaction>;
}

export interface ParsedBackup {
  transactions: Array<Transaction>;
  /** Entries that were left out because they were not valid. */
  skippedCount: number;
  currency: string | undefined;
}

export function createBackup(state: AppState, exportedAt: Date): string {
  const backup: BackupFile = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    currency: state.settings.currency,
    transactions: state.transactions.map(({ id, day, categoryId, amount }) => ({
      id,
      date: toIsoDate(day),
      category: getCategory(categoryId).slug,
      amount: amount / MINOR_UNITS,
    })),
  };
  return JSON.stringify(backup, null, 2);
}

/** Returns undefined when the text is not a backup made by this app. */
export function parseBackup(text: string): ParsedBackup | undefined {
  const backup = parseBackupFile(text);
  if (!backup) {
    return undefined;
  }
  const transactions = backup.transactions.flatMap((item) => {
    const transaction = toTransaction(item);
    return transaction ? [transaction] : [];
  });
  return {
    transactions: mergeTransactions([], transactions),
    skippedCount: backup.transactions.length - transactions.length,
    currency: isSupportedCurrency(backup.currency)
      ? backup.currency
      : undefined,
  };
}

export function getBackupFileName(day: DayKey): string {
  return `${BACKUP_APP_ID}-${toIsoDate(day)}.json`;
}

function parseBackupFile(text: string): BackupFile | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }
  const { app, version, transactions } = parsed as Partial<BackupFile>;
  const isBackup =
    app === BACKUP_APP_ID &&
    version === BACKUP_VERSION &&
    Array.isArray(transactions);
  return isBackup ? (parsed as BackupFile) : undefined;
}

function toTransaction(item: unknown): Transaction | undefined {
  if (typeof item !== 'object' || item === null) {
    return undefined;
  }
  const { id, date, category, amount } = item as Partial<BackupTransaction>;
  if (
    typeof date !== 'string' ||
    typeof category !== 'string' ||
    typeof amount !== 'number'
  ) {
    return undefined;
  }
  const transaction = {
    id,
    day: parseIsoDate(date),
    categoryId: findCategoryBySlug(category)?.id,
    amount: Math.round(amount * MINOR_UNITS),
  };
  return isValidTransaction(transaction) ? transaction : undefined;
}
