import { describe, expect, it } from 'vitest';
import {
  hasPendingChanges,
  NO_PENDING_CHANGES,
  parsePendingChanges,
  recordChange,
} from './pendingChanges';

describe('pendingChanges', () => {
  it('should start with nothing to send', () => {
    expect(hasPendingChanges(NO_PENDING_CHANGES)).toBe(false);
  });

  it('should collect changes without repeating an id', () => {
    const once = recordChange(NO_PENDING_CHANGES, {
      upsertedTransactionIds: ['a1'],
    });
    const twice = recordChange(once, {
      upsertedTransactionIds: ['a1', 'a2'],
      upsertedCategoryIds: [1000],
    });

    expect(twice).toEqual({
      ...NO_PENDING_CHANGES,
      upsertedTransactionIds: ['a1', 'a2'],
      upsertedCategoryIds: [1000],
    });
    expect(hasPendingChanges(twice)).toBe(true);
  });

  it('should treat deleting something saved earlier as only a deletion', () => {
    const saved = recordChange(NO_PENDING_CHANGES, {
      upsertedTransactionIds: ['a1'],
    });

    expect(recordChange(saved, { deletedTransactionIds: ['a1'] })).toEqual({
      ...NO_PENDING_CHANGES,
      deletedTransactionIds: ['a1'],
    });
  });

  it('should treat saving something deleted earlier as only a save', () => {
    const deleted = recordChange(NO_PENDING_CHANGES, {
      deletedCategoryIds: [1000],
    });

    expect(recordChange(deleted, { upsertedCategoryIds: [1000] })).toEqual({
      ...NO_PENDING_CHANGES,
      upsertedCategoryIds: [1000],
    });
  });

  it('should keep a settings change until it is sent', () => {
    const changed = recordChange(NO_PENDING_CHANGES, {
      hasSettingsChange: true,
    });

    expect(
      recordChange(changed, { upsertedTransactionIds: ['a1'] })
        .hasSettingsChange,
    ).toBe(true);
  });

  it('should read saved changes, leaving out anything that is not valid', () => {
    expect(
      parsePendingChanges({
        upsertedTransactionIds: ['a1', 7, 'A-1'],
        deletedTransactionIds: 'a2',
        upsertedCategoryIds: [1000, 'x'],
        hasSettingsChange: 'yes',
      }),
    ).toEqual({
      ...NO_PENDING_CHANGES,
      upsertedTransactionIds: ['a1'],
      upsertedCategoryIds: [1000],
    });
    expect(parsePendingChanges(null)).toEqual(NO_PENDING_CHANGES);
  });
});
