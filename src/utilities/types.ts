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

export interface AppState {
  transactions: ReadonlyArray<Transaction>;
  settings: Settings;
  categories: CategoryCatalog;
}
