import { sortTransactions } from '../transactions';
import type { DataSnapshot, PendingChanges } from '../types';

/**
 * Combines the cloud copy with what is on this device.
 *
 * The cloud copy is taken as the starting point, and then only the changes
 * this device has not sent yet are applied on top. That way a change made
 * on another device is kept, including a deletion: an item that is here but
 * not in the cloud copy, and that this device did not just add, was deleted
 * elsewhere and is dropped.
 */
export function mergeRemote(
  local: DataSnapshot,
  remote: DataSnapshot,
  pending: PendingChanges,
): DataSnapshot {
  const settings = pending.hasSettingsChange ? local : remote;
  return {
    transactions: sortTransactions(
      mergeById(
        remote.transactions,
        local.transactions,
        pending.upsertedTransactionIds,
        pending.deletedTransactionIds,
      ),
    ),
    customCategories: mergeById(
      remote.customCategories,
      local.customCategories,
      pending.upsertedCategoryIds,
      pending.deletedCategoryIds,
    ),
    hiddenCategoryIds: settings.hiddenCategoryIds,
    currency: settings.currency,
  };
}

function mergeById<K, T extends { id: K }>(
  remote: ReadonlyArray<T>,
  local: ReadonlyArray<T>,
  upsertedIds: ReadonlyArray<K>,
  deletedIds: ReadonlyArray<K>,
): Array<T> {
  const merged = new Map(remote.map((item) => [item.id, item]));
  const localById = new Map(local.map((item) => [item.id, item]));
  upsertedIds.forEach((id) => {
    const item = localById.get(id);
    if (item) {
      merged.set(id, item);
    }
  });
  deletedIds.forEach((id) => merged.delete(id));
  return [...merged.values()];
}
