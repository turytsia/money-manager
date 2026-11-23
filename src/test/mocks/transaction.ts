import type { Transaction } from '../../utilities/types';

/** A valid transaction: 12.50 spent on Food on Monday, 23 November 2026. */
export function createTransaction(
  overrides: Partial<Transaction> = {},
): Transaction {
  return { id: 'a1', day: 20261123, categoryId: 1, amount: 1250, ...overrides };
}
