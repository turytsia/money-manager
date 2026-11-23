import { getCategory, type CategoryCatalog } from './categories';
import { getMonthKey } from './dates';
import { MAX_AMOUNT } from './money';
import type { Transaction, TransactionKind } from './types';

const ID_PATTERN = /^[0-9a-z]{1,16}$/;
const ID_RADIX = 36;

/** Orders transactions newest first: by day, then by when they were added. */
export function compareTransactions(a: Transaction, b: Transaction): number {
  return b.day - a.day || compareIds(b.id, a.id);
}

export function sortTransactions(
  transactions: ReadonlyArray<Transaction>,
): Array<Transaction> {
  return [...transactions].sort(compareTransactions);
}

/** Adds a transaction, or replaces the one that has the same id. */
export function upsertTransaction(
  transactions: ReadonlyArray<Transaction>,
  transaction: Transaction,
): Array<Transaction> {
  return sortTransactions([
    ...transactions.filter(({ id }) => id !== transaction.id),
    transaction,
  ]);
}

export function removeTransaction(
  transactions: ReadonlyArray<Transaction>,
  id: string,
): Array<Transaction> {
  return transactions.filter((transaction) => transaction.id !== id);
}

/** Combines two lists. On a shared id the incoming transaction wins. */
export function mergeTransactions(
  current: ReadonlyArray<Transaction>,
  incoming: ReadonlyArray<Transaction>,
): Array<Transaction> {
  const byId = new Map<string, Transaction>();
  current.forEach((transaction) => byId.set(transaction.id, transaction));
  incoming.forEach((transaction) => byId.set(transaction.id, transaction));
  return sortTransactions([...byId.values()]);
}

/**
 * Ids are the creation time in base 36. They are short to store, sort by
 * creation order, and stay unique when backups from two devices are merged.
 */
export function createTransactionId(
  timestamp: number,
  transactions: ReadonlyArray<Transaction>,
): string {
  const takenIds = new Set(transactions.map(({ id }) => id));
  let candidate = timestamp;
  while (takenIds.has(candidate.toString(ID_RADIX))) {
    candidate += 1;
  }
  return candidate.toString(ID_RADIX);
}

export function isValidTransactionId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

export function isValidAmount(amount: unknown): amount is number {
  return (
    typeof amount === 'number' &&
    Number.isInteger(amount) &&
    amount > 0 &&
    amount <= MAX_AMOUNT
  );
}

export function getKind(
  transaction: Transaction,
  categories: CategoryCatalog,
): TransactionKind {
  return getCategory(categories, transaction.categoryId).kind;
}

export function getMonthKeys(
  transactions: ReadonlyArray<Transaction>,
): Set<number> {
  return new Set(transactions.map(({ day }) => getMonthKey(day)));
}

function compareIds(a: string, b: string): number {
  if (a.length !== b.length) {
    return a.length - b.length;
  }
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
