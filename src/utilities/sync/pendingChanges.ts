import { isCategoryId } from '../categories';
import { isValidTransactionId } from '../transactions';
import type { DataSnapshot, PendingChanges } from '../types';

export const NO_PENDING_CHANGES: PendingChanges = {
  upsertedTransactionIds: [],
  deletedTransactionIds: [],
  upsertedCategoryIds: [],
  deletedCategoryIds: [],
  hasSettingsChange: false,
};

/** What one change touched. Parts that were not touched are left out. */
export type DataChange = Partial<PendingChanges>;

export function hasPendingChanges(pending: PendingChanges): boolean {
  return (
    pending.hasSettingsChange ||
    pending.upsertedTransactionIds.length > 0 ||
    pending.deletedTransactionIds.length > 0 ||
    pending.upsertedCategoryIds.length > 0 ||
    pending.deletedCategoryIds.length > 0
  );
}

/**
 * Adds one change to the list of what still has to reach the cloud. Saving
 * something that was marked as deleted cancels the deletion, and the other
 * way round.
 */
export function recordChange(
  pending: PendingChanges,
  change: DataChange,
): PendingChanges {
  return {
    upsertedTransactionIds: update(
      pending.upsertedTransactionIds,
      change.upsertedTransactionIds,
      change.deletedTransactionIds,
    ),
    deletedTransactionIds: update(
      pending.deletedTransactionIds,
      change.deletedTransactionIds,
      change.upsertedTransactionIds,
    ),
    upsertedCategoryIds: update(
      pending.upsertedCategoryIds,
      change.upsertedCategoryIds,
      change.deletedCategoryIds,
    ),
    deletedCategoryIds: update(
      pending.deletedCategoryIds,
      change.deletedCategoryIds,
      change.upsertedCategoryIds,
    ),
    hasSettingsChange:
      pending.hasSettingsChange || change.hasSettingsChange === true,
  };
}

/** Marks everything on this device as still having to reach the cloud. */
export function getAllAsPending(snapshot: DataSnapshot): PendingChanges {
  return {
    ...NO_PENDING_CHANGES,
    upsertedTransactionIds: snapshot.transactions.map(({ id }) => id),
    upsertedCategoryIds: snapshot.customCategories.map(({ id }) => id),
    hasSettingsChange: true,
  };
}

/** Reads saved pending changes, leaving out anything that is not valid. */
export function parsePendingChanges(value: unknown): PendingChanges {
  if (typeof value !== 'object' || value === null) {
    return NO_PENDING_CHANGES;
  }
  const saved = value as Partial<Record<keyof PendingChanges, unknown>>;
  return {
    upsertedTransactionIds: filter(
      saved.upsertedTransactionIds,
      isValidTransactionId,
    ),
    deletedTransactionIds: filter(
      saved.deletedTransactionIds,
      isValidTransactionId,
    ),
    upsertedCategoryIds: filter(saved.upsertedCategoryIds, isCategoryId),
    deletedCategoryIds: filter(saved.deletedCategoryIds, isCategoryId),
    hasSettingsChange: saved.hasSettingsChange === true,
  };
}

function update<T>(
  current: ReadonlyArray<T>,
  added: ReadonlyArray<T> = [],
  removed: ReadonlyArray<T> = [],
): ReadonlyArray<T> {
  if (added.length === 0 && removed.length === 0) {
    return current;
  }
  const result = new Set(current);
  added.forEach((item) => result.add(item));
  removed.forEach((item) => result.delete(item));
  return [...result];
}

function filter<T>(
  value: unknown,
  isValid: (item: unknown) => item is T,
): Array<T> {
  return Array.isArray(value) ? value.filter(isValid) : [];
}
