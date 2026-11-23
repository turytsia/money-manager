import {
  Briefcase,
  Bus,
  Clapperboard,
  Coins,
  Gift,
  HeartPulse,
  House,
  Laptop,
  Package,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { TransactionKind } from './types';

// Ids are saved on the device, so they must never change or be reused.
export const CATEGORIES: ReadonlyArray<Category> = [
  category(1, 'food', 'Food', TransactionKind.Expense, Utensils),
  category(2, 'groceries', 'Groceries', TransactionKind.Expense, ShoppingCart),
  category(3, 'transport', 'Transport', TransactionKind.Expense, Bus),
  category(4, 'home', 'Home', TransactionKind.Expense, House),
  category(5, 'bills', 'Bills', TransactionKind.Expense, ReceiptText),
  category(6, 'health', 'Health', TransactionKind.Expense, HeartPulse),
  category(7, 'fun', 'Fun', TransactionKind.Expense, Clapperboard),
  category(8, 'shopping', 'Shopping', TransactionKind.Expense, ShoppingBag),
  category(9, 'other', 'Other', TransactionKind.Expense, Package),
  category(10, 'salary', 'Salary', TransactionKind.Income, Briefcase),
  category(11, 'freelance', 'Freelance', TransactionKind.Income, Laptop),
  category(12, 'gift', 'Gift', TransactionKind.Income, Gift),
  category(13, 'other-income', 'Other', TransactionKind.Income, Coins),
];

/** Size of an array that can be indexed directly by category id. */
export const CATEGORY_SLOT_COUNT =
  Math.max(...CATEGORIES.map(({ id }) => id)) + 1;

export const FALLBACK_CATEGORY_ID = 9;

const CATEGORY_BY_ID = new Map(CATEGORIES.map((item) => [item.id, item]));

const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((item) => [item.slug, item]));

const CATEGORIES_BY_KIND: Record<TransactionKind, ReadonlyArray<Category>> = {
  [TransactionKind.Expense]: CATEGORIES.filter(
    ({ kind }) => kind === TransactionKind.Expense,
  ),
  [TransactionKind.Income]: CATEGORIES.filter(
    ({ kind }) => kind === TransactionKind.Income,
  ),
};

export interface Category {
  readonly id: number;
  readonly slug: string;
  readonly label: string;
  readonly kind: TransactionKind;
  readonly icon: LucideIcon;
}

export function getCategory(id: number): Category {
  return (
    CATEGORY_BY_ID.get(id) ??
    (CATEGORY_BY_ID.get(FALLBACK_CATEGORY_ID) as Category)
  );
}

export function findCategoryBySlug(slug: string): Category | undefined {
  return CATEGORY_BY_SLUG.get(slug);
}

export function getCategoriesOfKind(
  kind: TransactionKind,
): ReadonlyArray<Category> {
  return CATEGORIES_BY_KIND[kind];
}

export function isKnownCategoryId(id: unknown): id is number {
  return typeof id === 'number' && CATEGORY_BY_ID.has(id);
}

function category(
  id: number,
  slug: string,
  label: string,
  kind: TransactionKind,
  icon: LucideIcon,
): Category {
  return { id, slug, label, kind, icon };
}
