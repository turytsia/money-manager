import * as React from 'react';
import { css } from '@emotion/css';
import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { CategoryEditorSheet } from '../../components/CategoryEditor/CategoryEditorSheet';
import { CategoryIcon } from '../../components/CategoryIcon/CategoryIcon';
import {
  useCategories,
  useTransactions,
} from '../../components/StoreProvider/StoreProvider';
import type { Category } from '../../utilities/categories';
import { formatCount } from '../../utilities/text';
import { TransactionKind, type Transaction } from '../../utilities/types';
import { SettingsSection } from './SettingsSection';

const KIND_LABELS: Readonly<Record<TransactionKind, string>> = {
  [TransactionKind.Expense]: 'Expense',
  [TransactionKind.Income]: 'Income',
};

const styles = {
  // The rows reach the edges of the card, like a list in iOS settings.
  list: css`
    margin: -14px -14px 0;
    border-bottom: 1px solid var(--color-border);
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 14px;
    text-align: left;
    transition: background-color 120ms ease;

    & + & {
      border-top: 1px solid var(--color-border);
    }

    &:active {
      background: var(--color-surface-raised);
    }
  `,
  details: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  `,
  name: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 500;
  `,
  meta: css`
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
  chevron: css`
    color: var(--color-fg-tertiary);
  `,
  note: css`
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
};

interface EditorTarget {
  /** Left out when a new category is being created. */
  category?: Category;
}

/** Lists the custom categories and opens them for editing. */
export const CategoriesSection: React.FC = () => {
  const categories = useCategories();
  const transactions = useTransactions();
  const [editorTarget, setEditorTarget] = React.useState<EditorTarget | null>(
    null,
  );

  const customCategories = [
    ...categories.byKind[TransactionKind.Expense],
    ...categories.byKind[TransactionKind.Income],
  ].filter(({ isCustom }) => isCustom);
  // Counting reads every transaction, so it only reruns when they change.
  const usageCounts = React.useMemo(
    () => countByCategory(transactions),
    [transactions],
  );

  return (
    <SettingsSection title='Categories'>
      {customCategories.length === 0 ? (
        <p className={styles.note}>
          Add your own categories, like Coffee or Pets. They show up next to the
          built-in ones when you add a transaction.
        </p>
      ) : (
        <div className={styles.list}>
          {customCategories.map((category) => (
            <button
              key={category.id}
              type='button'
              className={styles.row}
              onClick={() => setEditorTarget({ category })}
            >
              <CategoryIcon category={category} />
              <span className={styles.details}>
                <span className={styles.name}>{category.label}</span>
                <span className={styles.meta}>
                  {KIND_LABELS[category.kind]} ·{' '}
                  {formatCount(
                    usageCounts.get(category.id) ?? 0,
                    'transaction',
                  )}
                </span>
              </span>
              <ChevronRight
                size={18}
                aria-hidden='true'
                className={styles.chevron}
              />
            </button>
          ))}
        </div>
      )}
      <Button onClick={() => setEditorTarget({})}>
        <Plus size={16} aria-hidden='true' />
        New category
      </Button>
      {editorTarget && (
        <CategoryEditorSheet
          key={editorTarget.category?.id ?? 'new'}
          category={editorTarget.category}
          canChooseKind
          onClose={() => setEditorTarget(null)}
        />
      )}
    </SettingsSection>
  );
};

function countByCategory(
  transactions: ReadonlyArray<Transaction>,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const { categoryId } of transactions) {
    counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  }
  return counts;
}
