import * as React from 'react';
import { css, cx } from '@emotion/css';
import { Pencil, Plus } from 'lucide-react';
import type { Category } from '../../utilities/categories';
import { CARD_STYLE } from '../../utilities/styles';
import { TransactionKind, type CustomCategory } from '../../utilities/types';
import { Button, ButtonVariant } from '../Button/Button';
import { CategoryIcon } from '../CategoryIcon/CategoryIcon';
import {
  SegmentedControl,
  type SegmentedOption,
} from '../SegmentedControl/SegmentedControl';
import { Sheet, useSheetClose } from '../Sheet/Sheet';
import { useCategories, useStore } from '../StoreProvider/StoreProvider';
import { Switch } from '../Switch/Switch';
import { ToastTone, useToast } from '../ToastProvider/ToastProvider';
import { CategoryEditorSheet } from './CategoryEditorSheet';

const KIND_OPTIONS: ReadonlyArray<SegmentedOption<TransactionKind>> = [
  { value: TransactionKind.Expense, label: 'Expense' },
  { value: TransactionKind.Income, label: 'Income' },
];

const styles = {
  root: css`
    display: flex;
    flex-direction: column;
    gap: 14px;
  `,
  // Stays at the top while the list scrolls, so Done is always in reach.
  header: css`
    position: sticky;
    top: -8px;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: -8px -16px 0;
    padding: 8px 16px;
    background: var(--color-surface);
  `,
  title: css`
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.03em;
  `,
  done: css`
    height: 36px;
    padding: 0 16px;
  `,
  hint: css`
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
  list: cx(
    CARD_STYLE,
    css`
      overflow: hidden;
      background: var(--color-bg);
    `,
  ),
  row: css`
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 8px 14px 8px 10px;

    & + & {
      border-top: 1px solid var(--color-border);
    }
  `,
  name: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 500;
    transition: color 150ms ease;
  `,
  nameHidden: css`
    color: var(--color-fg-tertiary);
  `,
  editButton: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    color: var(--color-fg-secondary);

    &:active {
      background: var(--color-surface-raised);
      color: var(--color-fg);
    }
  `,
};

export interface CategoryManagerSheetProps {
  /** Which type of categories is shown first. */
  initialKind?: TransactionKind;
  /** Called when a category is created from this sheet. */
  onCreated?: (category: CustomCategory) => void;
  onClose: () => void;
}

interface CategoryManagerProps {
  initialKind: TransactionKind;
  onCreated: ((category: CustomCategory) => void) | undefined;
}

interface CategoryRowProps {
  category: Category;
  isShown: boolean;
  /** True for the last category still shown, which cannot be turned off. */
  isLocked: boolean;
  onToggle: (category: Category, isShown: boolean) => void;
  onEdit: (category: Category) => void;
}

interface EditorTarget {
  /** Left out when a new category is being created. */
  category?: Category;
}

/**
 * Where the list of categories is made your own: turn off the ones you do
 * not use, and add, rename or delete your own.
 */
export const CategoryManagerSheet: React.FC<CategoryManagerSheetProps> = ({
  initialKind = TransactionKind.Expense,
  onCreated,
  onClose,
}) => {
  return (
    <Sheet title='Categories' onClose={onClose}>
      <CategoryManager initialKind={initialKind} onCreated={onCreated} />
    </Sheet>
  );
};

const CategoryManager: React.FC<CategoryManagerProps> = ({
  initialKind,
  onCreated,
}) => {
  const store = useStore();
  const categories = useCategories();
  const showToast = useToast();
  const closeSheet = useSheetClose();
  const [kind, setKind] = React.useState(initialKind);
  const [editorTarget, setEditorTarget] = React.useState<EditorTarget | null>(
    null,
  );
  const listed = categories.byKind[kind].filter(
    ({ isFallback }) => !isFallback,
  );
  const shownCount = categories.visibleByKind[kind].length;

  const handleToggle = (category: Category, isShown: boolean): void => {
    if (!store.setCategoryHidden(category.id, !isShown)) {
      showToast({
        message: 'Could not save. Storage may be full.',
        tone: ToastTone.Danger,
      });
    }
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h2 className={styles.title}>Categories</h2>
        <Button
          variant={ButtonVariant.Primary}
          className={styles.done}
          onClick={closeSheet}
        >
          Done
        </Button>
      </header>
      <SegmentedControl
        label='Type'
        options={KIND_OPTIONS}
        value={kind}
        onChange={setKind}
      />
      <p className={styles.hint}>
        Turn off the ones you don&apos;t use; at least one stays on.
        Transactions you already have keep their category.
      </p>
      <div className={styles.list}>
        {listed.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            isShown={!categories.hiddenIds.has(category.id)}
            isLocked={
              shownCount === 1 && !categories.hiddenIds.has(category.id)
            }
            onToggle={handleToggle}
            onEdit={(edited) => setEditorTarget({ category: edited })}
          />
        ))}
      </div>
      <Button isLarge onClick={() => setEditorTarget({})}>
        <Plus size={16} aria-hidden='true' />
        New category
      </Button>
      {editorTarget && (
        <CategoryEditorSheet
          key={editorTarget.category?.id ?? 'new'}
          category={editorTarget.category}
          kind={kind}
          onSaved={editorTarget.category ? undefined : onCreated}
          onClose={() => setEditorTarget(null)}
        />
      )}
    </div>
  );
};

const CategoryRow: React.FC<CategoryRowProps> = ({
  category,
  isShown,
  isLocked,
  onToggle,
  onEdit,
}) => {
  return (
    <div className={styles.row}>
      <CategoryIcon category={category} />
      <span className={cx(styles.name, !isShown && styles.nameHidden)}>
        {category.label}
      </span>
      {category.isCustom && (
        <button
          type='button'
          aria-label={`Edit ${category.label}`}
          className={styles.editButton}
          onClick={() => onEdit(category)}
        >
          <Pencil size={16} aria-hidden='true' />
        </button>
      )}
      <Switch
        label={`Show ${category.label}`}
        isOn={isShown}
        isDisabled={isLocked}
        onChange={(isOn) => onToggle(category, isOn)}
      />
    </div>
  );
};
