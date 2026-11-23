import {
  createCategoryId,
  findBuiltInBySlug,
  getCategory,
  getCustomSlug,
  getLabelKey,
  isTransactionKind,
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

interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  currency: string;
  categories?: Array<BackupCategory>;
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
  transactions: Array<ImportedTransaction>;
  /** Entries that were left out because they were not valid. */
  skippedCount: number;
  currency: string | undefined;
}

export interface ResolvedBackup {
  /** The custom categories of this device, plus new ones from the backup. */
  customCategories: Array<CustomCategory>;
  transactions: Array<Transaction>;
}

export function createBackup(state: AppState, exportedAt: Date): string {
  const { categories, settings, transactions } = state;
  const backup: BackupFile = {
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
    transactions: transactions.map(({ id, day, categoryId, amount }) => ({
      id,
      date: toIsoDate(day),
      category: getCategory(categories, categoryId).slug,
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
  const categories = parseCategories(backup.categories);
  const customKeys = new Set(categories.map(({ key }) => key));
  const parsed = backup.transactions.map((item) =>
    toImportedTransaction(item, customKeys),
  );
  const valid = parsed.filter(
    (item): item is ImportedTransaction => item !== undefined,
  );
  return {
    categories,
    // When two entries share an id, the later one wins.
    transactions: [...new Map(valid.map((item) => [item.id, item])).values()],
    skippedCount: parsed.length - valid.length,
    currency: isSupportedCurrency(backup.currency)
      ? backup.currency
      : undefined,
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
      id: createCategoryId(customCategories),
      kind,
      label,
      icon,
    };
    customCategories.push(created);
    idByLabelKey.set(labelKey, created.id);
    idByKey.set(key, created.id);
  }
  const transactions = backup.transactions.flatMap(
    ({ id, day, categoryKey, amount }) => {
      const categoryId =
        findBuiltInBySlug(categoryKey)?.id ?? idByKey.get(categoryKey);
      return categoryId === undefined ? [] : [{ id, day, categoryId, amount }];
    },
  );
  return { customCategories, transactions };
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
    READABLE_VERSIONS.includes(version) &&
    Array.isArray(transactions);
  return isBackup ? (parsed as BackupFile) : undefined;
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
  customKeys: ReadonlySet<string>,
): ImportedTransaction | undefined {
  if (typeof item !== 'object' || item === null) {
    return undefined;
  }
  const { id, date, category, amount } = item as Partial<BackupTransaction>;
  if (
    !isValidTransactionId(id) ||
    typeof date !== 'string' ||
    typeof category !== 'string' ||
    typeof amount !== 'number'
  ) {
    return undefined;
  }
  const day = parseIsoDate(date);
  const minorAmount = Math.round(amount * MINOR_UNITS);
  const isKnownCategory =
    findBuiltInBySlug(category) !== undefined || customKeys.has(category);
  if (day === undefined || !isValidAmount(minorAmount) || !isKnownCategory) {
    return undefined;
  }
  return { id, day, categoryKey: category, amount: minorAmount };
}
