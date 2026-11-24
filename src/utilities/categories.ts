import type { LucideIcon } from 'lucide-react';
import {
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  isCategoryIconName,
  type CategoryIconName,
} from './categoryIcons';
import { TransactionKind, type CustomCategory } from './types';

export const MAX_CATEGORY_LABEL_LENGTH = 24;

/** Custom category ids start here, leaving room for more built-in ones. */
export const FIRST_CUSTOM_CATEGORY_ID = 1000;

/** New custom ids count seconds from this moment (1 January 2025, UTC). */
const CATEGORY_ID_EPOCH = Date.UTC(2025, 0, 1);
const MILLISECONDS_PER_SECOND = 1000;

const OTHER_EXPENSE = builtIn(
  9,
  'other',
  'Other',
  TransactionKind.Expense,
  'package',
);

const OTHER_INCOME = builtIn(
  13,
  'other-income',
  'Other',
  TransactionKind.Income,
  'coins',
);

// Ids and slugs are saved on the device and in backups, so they must never
// change or be reused.
export const BUILT_IN_CATEGORIES: ReadonlyArray<Category> = [
  builtIn(1, 'food', 'Food', TransactionKind.Expense, 'utensils'),
  builtIn(
    2,
    'groceries',
    'Groceries',
    TransactionKind.Expense,
    'shopping-cart',
  ),
  builtIn(3, 'transport', 'Transport', TransactionKind.Expense, 'bus'),
  builtIn(4, 'home', 'Home', TransactionKind.Expense, 'house'),
  builtIn(5, 'bills', 'Bills', TransactionKind.Expense, 'receipt-text'),
  builtIn(6, 'health', 'Health', TransactionKind.Expense, 'heart-pulse'),
  builtIn(7, 'fun', 'Fun', TransactionKind.Expense, 'clapperboard'),
  builtIn(8, 'shopping', 'Shopping', TransactionKind.Expense, 'shopping-bag'),
  OTHER_EXPENSE,
  builtIn(10, 'salary', 'Salary', TransactionKind.Income, 'briefcase'),
  builtIn(11, 'freelance', 'Freelance', TransactionKind.Income, 'laptop'),
  builtIn(12, 'gift', 'Gift', TransactionKind.Income, 'gift'),
  OTHER_INCOME,
];

/** Where transactions go when their category is deleted or unknown. */
const FALLBACK_CATEGORIES: Readonly<Record<TransactionKind, Category>> = {
  [TransactionKind.Expense]: OTHER_EXPENSE,
  [TransactionKind.Income]: OTHER_INCOME,
};

const BUILT_IN_BY_SLUG = new Map(
  BUILT_IN_CATEGORIES.map((category) => [category.slug, category]),
);

const TRANSACTION_KINDS: ReadonlyArray<unknown> =
  Object.values(TransactionKind);
const CUSTOM_SLUG_PREFIX = 'custom-';
const WHITESPACE_PATTERN = /\s+/g;
const LABEL_LOCALE = 'en-US';

export interface Category {
  readonly id: number;
  /** A stable name for the category, used in backup files. */
  readonly slug: string;
  readonly label: string;
  readonly kind: TransactionKind;
  readonly iconName: CategoryIconName;
  readonly icon: LucideIcon;
  readonly isCustom: boolean;
}

/** Every category, built-in and custom, with quick ways to look them up. */
export interface CategoryCatalog {
  readonly all: ReadonlyArray<Category>;
  /** The custom categories in the form they are saved in. */
  readonly customCategories: ReadonlyArray<CustomCategory>;
  readonly byId: ReadonlyMap<number, Category>;
  /** The order categories are offered in: built-in, then custom, then Other. */
  readonly byKind: Readonly<Record<TransactionKind, ReadonlyArray<Category>>>;
  /** Categories the user turned off. Their transactions are unaffected. */
  readonly hiddenIds: ReadonlySet<number>;
  /** The categories offered when adding a transaction. */
  readonly visibleByKind: Readonly<
    Record<TransactionKind, ReadonlyArray<Category>>
  >;
}

export function createCatalog(
  customCategories: ReadonlyArray<CustomCategory>,
  hiddenCategoryIds: Iterable<number> = [],
): CategoryCatalog {
  const custom = customCategories.map(toCategory);
  const all = [...BUILT_IN_CATEGORIES, ...custom];
  const byId = new Map(all.map((category) => [category.id, category]));
  const hiddenIds = new Set(
    [...hiddenCategoryIds].filter((id) => byId.has(id) && canHideCategory(id)),
  );
  const byKind = {
    [TransactionKind.Expense]: orderForKind(TransactionKind.Expense, custom),
    [TransactionKind.Income]: orderForKind(TransactionKind.Income, custom),
  };
  const isVisible = ({ id }: Category): boolean => !hiddenIds.has(id);
  return {
    all,
    customCategories,
    byId,
    byKind,
    hiddenIds,
    visibleByKind: {
      [TransactionKind.Expense]:
        byKind[TransactionKind.Expense].filter(isVisible),
      [TransactionKind.Income]:
        byKind[TransactionKind.Income].filter(isVisible),
    },
  };
}

/** "Other" always stays, so there is always a category to pick. */
export function canHideCategory(id: number): boolean {
  return id !== OTHER_EXPENSE.id && id !== OTHER_INCOME.id;
}

/** Looks up a category. An unknown id is shown as Other. */
export function getCategory(catalog: CategoryCatalog, id: number): Category {
  return catalog.byId.get(id) ?? OTHER_EXPENSE;
}

export function getFallbackCategory(kind: TransactionKind): Category {
  return FALLBACK_CATEGORIES[kind];
}

export function findBuiltInBySlug(slug: string): Category | undefined {
  return BUILT_IN_BY_SLUG.get(slug);
}

export function getCustomSlug(id: number): string {
  return `${CUSTOM_SLUG_PREFIX}${id}`;
}

/**
 * Ids are based on the time, so two devices that each create a category
 * before syncing do not end up using the same id for different things.
 */
export function createCategoryId(
  customCategories: ReadonlyArray<CustomCategory>,
  timestamp: number,
): number {
  const highestId = customCategories.reduce(
    (highest, { id }) => Math.max(highest, id),
    FIRST_CUSTOM_CATEGORY_ID - 1,
  );
  const secondsSinceEpoch = Math.floor(
    (timestamp - CATEGORY_ID_EPOCH) / MILLISECONDS_PER_SECOND,
  );
  return Math.max(highestId + 1, FIRST_CUSTOM_CATEGORY_ID + secondsSinceEpoch);
}

/** Trims a name and turns runs of spaces into one space. */
export function normalizeLabel(text: string): string {
  return text.trim().replace(WHITESPACE_PATTERN, ' ');
}

/** Returns a usable category name, or undefined when there is none. */
export function toCategoryLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const label = normalizeLabel(value);
  return label !== '' && label.length <= MAX_CATEGORY_LABEL_LENGTH
    ? label
    : undefined;
}

/** Two names count as the same when they only differ in letter case. */
export function getLabelKey(kind: TransactionKind, label: string): string {
  return `${kind}:${normalizeLabel(label).toLocaleLowerCase(LABEL_LOCALE)}`;
}

/** Returns what is wrong with a name, or undefined when it can be used. */
export function validateCategoryLabel(
  label: string,
  kind: TransactionKind,
  catalog: CategoryCatalog,
  editedId: number | null,
): string | undefined {
  const normalized = normalizeLabel(label);
  if (normalized === '') {
    return 'Enter a name';
  }
  if (normalized.length > MAX_CATEGORY_LABEL_LENGTH) {
    return `Use at most ${MAX_CATEGORY_LABEL_LENGTH} characters`;
  }
  const key = getLabelKey(kind, normalized);
  const isTaken = catalog.byKind[kind].some(
    (category) =>
      category.id !== editedId &&
      getLabelKey(category.kind, category.label) === key,
  );
  return isTaken ? 'A category with this name already exists' : undefined;
}

export function isTransactionKind(value: unknown): value is TransactionKind {
  return TRANSACTION_KINDS.includes(value);
}

export function isCategoryId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

/** Reads saved custom categories, leaving out any that are not valid. */
export function parseCustomCategories(value: unknown): Array<CustomCategory> {
  if (!Array.isArray(value)) {
    return [];
  }
  const categories = value.flatMap((item) => {
    const category = toCustomCategory(item);
    return category ? [category] : [];
  });
  return categories.filter(
    ({ id }, index) =>
      categories.findIndex((category) => category.id === id) === index,
  );
}

/** Reads a saved list of category ids, leaving out anything else. */
export function parseCategoryIds(value: unknown): Array<number> {
  return Array.isArray(value) ? [...new Set(value.filter(isCategoryId))] : [];
}

/** The custom category id inside a slug such as "custom-1000", if any. */
export function parseCustomSlug(slug: string): number | undefined {
  if (!slug.startsWith(CUSTOM_SLUG_PREFIX)) {
    return undefined;
  }
  const id = Number(slug.slice(CUSTOM_SLUG_PREFIX.length));
  return isCategoryId(id) && id >= FIRST_CUSTOM_CATEGORY_ID ? id : undefined;
}

function toCustomCategory(value: unknown): CustomCategory | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { id, kind, label, icon } = value as Partial<CustomCategory>;
  const validLabel = toCategoryLabel(label);
  if (
    !isCategoryId(id) ||
    id < FIRST_CUSTOM_CATEGORY_ID ||
    !isTransactionKind(kind) ||
    validLabel === undefined
  ) {
    return undefined;
  }
  return {
    id,
    kind,
    label: validLabel,
    icon: isCategoryIconName(icon) ? icon : DEFAULT_CATEGORY_ICON,
  };
}

function toCategory({ id, kind, label, icon }: CustomCategory): Category {
  return {
    id,
    slug: getCustomSlug(id),
    label,
    kind,
    iconName: icon,
    icon: CATEGORY_ICONS[icon],
    isCustom: true,
  };
}

function orderForKind(
  kind: TransactionKind,
  custom: ReadonlyArray<Category>,
): Array<Category> {
  const fallback = FALLBACK_CATEGORIES[kind];
  const isListed = (category: Category): boolean =>
    category.kind === kind && category !== fallback;
  return [
    ...BUILT_IN_CATEGORIES.filter(isListed),
    ...custom.filter(isListed),
    fallback,
  ];
}

function builtIn(
  id: number,
  slug: string,
  label: string,
  kind: TransactionKind,
  iconName: CategoryIconName,
): Category {
  return {
    id,
    slug,
    label,
    kind,
    iconName,
    icon: CATEGORY_ICONS[iconName],
    isCustom: false,
  };
}
