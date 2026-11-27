import {
  getCategory,
  type Category,
  type CategoryCatalog,
} from '../../utilities/categories';
import { TransactionKind, type Transaction } from '../../utilities/types';
import { groupByDay, type DayGroup } from './groupByDay';

export interface ActivityQuery {
  /** All transactions, newest first. */
  transactions: ReadonlyArray<Transaction>;
  categories: CategoryCatalog;
  /** The categories picked as a filter. None means everything is shown. */
  categoryIds: ReadonlySet<number>;
}

export interface Activity {
  /** The picked categories that still exist. */
  selectedIds: ReadonlySet<number>;
  /**
   * The categories offered as filters: the ones in use, plus any already
   * picked, so a filter never disappears while it is on. Spent comes
   * before earned, in the same order as everywhere else.
   */
  filterCategories: Array<Category>;
  /** The transactions that pass the filter, grouped by day. */
  groups: Array<DayGroup>;
  /** How many transactions pass the filter. */
  count: number;
}

/**
 * Works out what the Activity screen lists for a category filter. A
 * transaction whose category is not known counts as Uncategorized, the way
 * it is shown in the list.
 */
export function buildActivity({
  transactions,
  categories,
  categoryIds,
}: ActivityQuery): Activity {
  // A picked category that was deleted since no longer narrows anything.
  const selectedIds = new Set(
    [...categoryIds].filter((id) => categories.byId.has(id)),
  );
  const getShownId = ({ categoryId }: Transaction): number =>
    getCategory(categories, categoryId).id;
  const usedIds = new Set(transactions.map(getShownId));
  const shown =
    selectedIds.size === 0
      ? transactions
      : transactions.filter((transaction) =>
          selectedIds.has(getShownId(transaction)),
        );

  return {
    selectedIds,
    filterCategories: [
      ...categories.byKind[TransactionKind.Expense],
      ...categories.byKind[TransactionKind.Income],
    ].filter(({ id }) => usedIds.has(id) || selectedIds.has(id)),
    groups: groupByDay(shown, categories),
    count: shown.length,
  };
}
