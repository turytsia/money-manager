import type { CategoryCatalog } from './categories';
import type { CategoryIconName } from './categoryIcons';

export enum TransactionKind {
  Expense = 'expense',
  Income = 'income',
}

export enum Granularity {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year',
}

export enum ThemePreference {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
}

export enum ImportMode {
  Merge = 'merge',
  Replace = 'replace',
}

export enum Tab {
  Add = 'add',
  Activity = 'activity',
  Insights = 'insights',
  Settings = 'settings',
}

/** A calendar day packed as YYYYMMDD, for example 20261123. */
export type DayKey = number;

export interface Transaction {
  id: string;
  day: DayKey;
  categoryId: number;
  /** Always positive, in minor units (cents). The category sets the kind. */
  amount: number;
}

export type TransactionInput = Omit<Transaction, 'id'>;

export interface Settings {
  currency: string;
  theme: ThemePreference;
}

/** A category the user made, in the form it is saved in. */
export interface CustomCategory {
  id: number;
  kind: TransactionKind;
  label: string;
  icon: CategoryIconName;
}

/** A custom category being created (id is null) or edited. */
export interface CategoryDraft {
  id: number | null;
  kind: TransactionKind;
  label: string;
  icon: CategoryIconName;
}

/** Everything that is backed up and kept in step between devices. */
export interface DataSnapshot {
  transactions: ReadonlyArray<Transaction>;
  customCategories: ReadonlyArray<CustomCategory>;
  hiddenCategoryIds: ReadonlyArray<number>;
  currency: string;
}

/** What changed on this device since it last matched the cloud copy. */
export interface PendingChanges {
  upsertedTransactionIds: ReadonlyArray<string>;
  deletedTransactionIds: ReadonlyArray<string>;
  upsertedCategoryIds: ReadonlyArray<number>;
  deletedCategoryIds: ReadonlyArray<number>;
  /** The currency or the list of hidden categories changed. */
  hasSettingsChange: boolean;
}

/** Saved while cloud sync is on. */
export interface SyncState {
  /** Proves to the server who this is. Never the password itself. */
  token: string;
  /** The cloud copy this device last matched, or null before the first sync. */
  version: string | null;
  /** When the last successful sync finished, in milliseconds. */
  syncedAt: number | null;
  pending: PendingChanges;
}

export interface AppState {
  transactions: ReadonlyArray<Transaction>;
  settings: Settings;
  categories: CategoryCatalog;
  /** Null while cloud sync is off. */
  sync: SyncState | null;
}
