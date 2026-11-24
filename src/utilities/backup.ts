import {
  createCategoryId,
  findBuiltInBySlug,
  getCategory,
  getCustomSlug,
  getLabelKey,
  isTransactionKind,
  parseCustomSlug,
  toCategoryLabel,
  type CategoryCatalog,
} from './categories';
import {
  DEFAULT_CATEGORY_ICON,
  isCategoryIconName,
  type CategoryIconName,
} from './categoryIcons';
import { parseIsoDate, toIsoDate } from './dates';
import { isSupportedCurrency, MINOR_UNITS } from './money';
import { isValidAmount, isValidTransactionId } from './transactions';
import type {
  AppState,
  CustomCategory,
  DataSnapshot,
  DayKey,
  Transaction,
  TransactionKind,
} from './types';

export const BACKUP_FILE_TYPE = 'application/json';

const BACKUP_APP_ID = 'money-manager';
const BACKUP_VERSION = 2;

/** Version 1 files have no custom categories. They can still be imported. */
const READABLE_VERSIONS: ReadonlyArray<unknown> = [1, BACKUP_VERSION];

const MAX_CATEGORY_KEY_LENGTH = 40;
const FILE_INDENT = 2;

/** A custom category in a backup file. Built-in ones are not listed. */
interface BackupCategory {
  key: string;
  name: string;
  kind: TransactionKind;
  icon: string;
}

/** One transaction in a backup file, written to be readable by people. */
interface BackupTransaction {
  id: string;
  date: string;
  /** A built-in category such as "food", or the key of a custom one. */
  category: string;
  amount: number;
}

/**
 * The contents of a backup. The same document is what cloud sync keeps, so
 * a copy taken from the cloud can be imported by hand like any backup.
 */
export interface BackupDocument {
  app: string;
  version: number;
  exportedAt: string;
  currency: string;
  categories?: Array<BackupCategory>;
  /** Categories turned off in the app, by name or custom key. */
  hiddenCategories?: Array<string>;
  transactions: Array<BackupTransaction>;
}

/** A custom category from a backup, not yet matched to this device. */
export interface ImportedCategory {
  key: string;
  label: string;
  kind: TransactionKind;
  icon: CategoryIconName;
}

/** A transaction from a backup. Its category is still the key in the file. */
export interface ImportedTransaction {
  id: string;
  day: DayKey;
  categoryKey: string;
  amount: number;
}

export interface ParsedBackup {
  categories: Array<ImportedCategory>;
  hiddenCategoryKeys: Array<string>;
  transactions: Array<ImportedTransaction>;
  /** Entries that were left out because they were not valid. */
  skippedCount: number;
  currency: string | undefined;
}

export interface ResolvedBackup {
  /** The custom categories of this device, plus new ones from the backup. */
  customCategories: Array<CustomCategory>;
  /** The backup's hidden categories, as ids on this device. */
  hiddenCategoryIds: Array<number>;
  transactions: Array<Transaction>;
}

export function createBackupDocument(
  { transactions, settings, categories }: AppState,
  exportedAt: Date,
): BackupDocument {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    currency: settings.currency,
    categories: categories.customCategories.map(
      ({ id, kind, label, icon }) => ({
        key: getCustomSlug(id),
        name: label,
        kind,
        icon,
      }),
    ),
    hiddenCategories: [...categories.hiddenIds].map(
      (id) => getCategory(categories, id).slug,
    ),
    transactions: transactions.map(({ id, day, categoryId, amount }) => ({
      id,
      date: toIsoDate(day),
      category: getCategory(categories, categoryId).slug,
      amount: amount / MINOR_UNITS,
    })),
  };
}

/** The text of a backup file. */
export function createBackup(state: AppState, exportedAt: Date): string {
  return JSON.stringify(
    createBackupDocument(state, exportedAt),
    null,
    FILE_INDENT,
  );
}

/** Returns undefined when the text is not a backup made by this app. */
export function parseBackup(text: string): ParsedBackup | undefined {
  try {
    return parseBackupDocument(JSON.parse(text));
  } catch {
    return undefined;
  }
}

/** Returns undefined when the value is not a backup made by this app. */
export function parseBackupDocument(value: unknown): ParsedBackup | undefined {
  if (!isBackupDocument(value)) {
    return undefined;
  }
  const categories = parseCategories(value.categories);
  const customKeys = new Set(categories.map(({ key }) => key));
  const isKnownKey = (key: unknown): key is string =>
    typeof key === 'string' &&
    (findBuiltInBySlug(key) !== undefined || customKeys.has(key));
  const parsed = value.transactions.map((item) =>
    toImportedTransaction(item, isKnownKey),
  );
  const valid = parsed.filter(
    (item): item is ImportedTransaction => item !== undefined,
  );
  return {
    categories,
    hiddenCategoryKeys: Array.isArray(value.hiddenCategories)
      ? value.hiddenCategories.filter(isKnownKey)
      : [],
    // When two entries share an id, the later one wins.
    transactions: [...new Map(valid.map((item) => [item.id, item])).values()],
    skippedCount: parsed.length - valid.length,
    currency: isSupportedCurrency(value.currency) ? value.currency : undefined,
  };
}

/**
 * Matches the categories of a backup to the ones on this device. A custom
 * category with the same name and kind as an existing one is merged into
 * it; any other gets created with a new id.
 */
export function resolveBackup(
  backup: ParsedBackup,
  categories: CategoryCatalog,
  timestamp: number,
): ResolvedBackup {
  const customCategories = [...categories.customCategories];
  const idByLabelKey = new Map(
    categories.all.map((category) => [
      getLabelKey(category.kind, category.label),
      category.id,
    ]),
  );
  const idByKey = new Map<string, number>();
  for (const { key, label, kind, icon } of backup.categories) {
    const labelKey = getLabelKey(kind, label);
    const existingId = idByLabelKey.get(labelKey);
    if (existingId !== undefined) {
      idByKey.set(key, existingId);
      continue;
    }
    const created: CustomCategory = {
      id: createCategoryId(customCategories, timestamp),
      kind,
      label,
      icon,
    };
    customCategories.push(created);
    idByLabelKey.set(labelKey, created.id);
    idByKey.set(key, created.id);
  }
  const getId = (key: string): number | undefined =>
    findBuiltInBySlug(key)?.id ?? idByKey.get(key);
  return {
    customCategories,
    hiddenCategoryIds: toIds(backup.hiddenCategoryKeys, getId),
    transactions: toTransactions(backup.transactions, getId),
  };
}

/**
 * Reads a backup exactly as it is, keeping the ids of its custom
 * categories. Cloud sync uses this, because both sides already agree on
 * ids. Importing a file from elsewhere uses `resolveBackup` instead.
 */
export function toDataSnapshot(
  backup: ParsedBackup,
  fallbackCurrency: string,
): DataSnapshot {
  const idByKey = new Map<string, number>();
  const customCategories = backup.categories.flatMap(
    ({ key, label, kind, icon }) => {
      const id = parseCustomSlug(key);
      if (id === undefined || [...idByKey.values()].includes(id)) {
        return [];
      }
      idByKey.set(key, id);
      return [{ id, kind, label, icon }];
    },
  );
  const getId = (key: string): number | undefined =>
    findBuiltInBySlug(key)?.id ?? idByKey.get(key);
  return {
    customCategories,
    hiddenCategoryIds: toIds(backup.hiddenCategoryKeys, getId),
    transactions: toTransactions(backup.transactions, getId),
    currency: backup.currency ?? fallbackCurrency,
  };
}

export function getBackupFileName(day: DayKey): string {
  return `${BACKUP_APP_ID}-${toIsoDate(day)}.json`;
}

function isBackupDocument(value: unknown): value is BackupDocument {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { app, version, transactions } = value as Partial<BackupDocument>;
  return (
    app === BACKUP_APP_ID &&
    READABLE_VERSIONS.includes(version) &&
    Array.isArray(transactions)
  );
}

/** Reads the custom categories of a backup. The first of a key wins. */
function parseCategories(value: unknown): Array<ImportedCategory> {
  if (!Array.isArray(value)) {
    return [];
  }
  const categories = value.flatMap((item) => {
    const category = toImportedCategory(item);
    return category ? [category] : [];
  });
  return categories.filter(
    ({ key }, index) =>
      categories.findIndex((category) => category.key === key) === index,
  );
}

function toImportedCategory(item: unknown): ImportedCategory | undefined {
  if (typeof item !== 'object' || item === null) {
    return undefined;
  }
  const { key, name, kind, icon } = item as Partial<BackupCategory>;
  const label = toCategoryLabel(name);
  if (
    typeof key !== 'string' ||
    key === '' ||
    key.length > MAX_CATEGORY_KEY_LENGTH ||
    findBuiltInBySlug(key) !== undefined ||
    !isTransactionKind(kind) ||
    label === undefined
  ) {
    return undefined;
  }
  return {
    key,
    label,
    kind,
    icon: isCategoryIconName(icon) ? icon : DEFAULT_CATEGORY_ICON,
  };
}

function toImportedTransaction(
  item: unknown,
  isKnownKey: (key: unknown) => key is string,
): ImportedTransaction | undefined {
  if (typeof item !== 'object' || item === null) {
    return undefined;
  }
  const { id, date, category, amount } = item as Partial<BackupTransaction>;
  if (
    !isValidTransactionId(id) ||
    typeof date !== 'string' ||
    typeof amount !== 'number' ||
    !isKnownKey(category)
  ) {
    return undefined;
  }
  const day = parseIsoDate(date);
  const minorAmount = Math.round(amount * MINOR_UNITS);
  if (day === undefined || !isValidAmount(minorAmount)) {
    return undefined;
  }
  return { id, day, categoryKey: category, amount: minorAmount };
}

function toIds(
  keys: ReadonlyArray<string>,
  getId: (key: string) => number | undefined,
): Array<number> {
  return keys.flatMap((key) => {
    const id = getId(key);
    return id === undefined ? [] : [id];
  });
}

function toTransactions(
  transactions: ReadonlyArray<ImportedTransaction>,
  getId: (key: string) => number | undefined,
): Array<Transaction> {
  return transactions.flatMap(({ id, day, categoryKey, amount }) => {
    const categoryId = getId(categoryKey);
    return categoryId === undefined ? [] : [{ id, day, categoryId, amount }];
  });
}
