import * as React from 'react';
import { css, cx } from '@emotion/css';
import {
  getFallbackCategory,
  MAX_CATEGORY_LABEL_LENGTH,
  validateCategoryLabel,
  type Category,
} from '../../utilities/categories';
import {
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
  type CategoryIconName,
} from '../../utilities/categoryIcons';
import { LABEL_STYLE } from '../../utilities/styles';
import { formatCount } from '../../utilities/text';
import { TransactionKind, type CustomCategory } from '../../utilities/types';
import { Button, ButtonVariant } from '../Button/Button';
import { Sheet, useSheetClose } from '../Sheet/Sheet';
import {
  useCategories,
  useStore,
  useTransactions,
} from '../StoreProvider/StoreProvider';
import { ToastTone, useToast } from '../ToastProvider/ToastProvider';
import { IconPicker } from './IconPicker';

const SAVE_FAILED_MESSAGE = 'Could not save. Storage may be full.';
const NAME_INPUT_ID = 'category-name';
const ERROR_ID = 'category-name-error';

const styles = {
  form: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  // Stays at the top while the icons scroll, so Save is always in reach.
  header: css`
    position: sticky;
    top: -8px;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    margin: -8px -16px 0;
    padding: 8px 16px;
    background: var(--color-surface);
  `,
  cancel: css`
    justify-self: start;
    height: 36px;
    color: var(--color-fg-secondary);
    font-size: 15px;

    &:active {
      color: var(--color-fg);
    }
  `,
  title: css`
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.02em;
  `,
  save: css`
    justify-self: end;
    height: 36px;
    padding: 0 16px;
  `,
  field: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  inputWrapper: css`
    display: flex;
    align-items: center;
    gap: 10px;
    height: 56px;
    padding: 0 14px 0 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-m);
    background: var(--color-bg);
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;

    &:focus-within {
      border-color: var(--color-fg);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-fg) 12%, transparent);
    }
  `,
  inputWrapperInvalid: css`
    border-color: var(--color-danger);
  `,
  preview: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--color-surface-raised);
  `,
  // 16px or larger stops iOS from zooming in when the field is focused.
  input: css`
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    font-size: 17px;
    font-weight: 500;

    &::placeholder {
      color: var(--color-fg-tertiary);
    }
  `,
  counter: css`
    color: var(--color-fg-tertiary);
    font-family: var(--font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  `,
  error: css`
    margin-top: -8px;
    color: var(--color-danger);
    font-size: 13px;
  `,
  confirmation: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  confirmationTitle: css`
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.03em;
  `,
  confirmationText: css`
    margin-bottom: 12px;
    color: var(--color-fg-secondary);
    font-size: 14px;
  `,
};

export interface CategoryEditorSheetProps {
  /** The category to edit. Leave out to create a new one. */
  category?: Category;
  /** Whether a new category is for expenses or income. */
  kind?: TransactionKind;
  onSaved?: (category: CustomCategory) => void;
  onClose: () => void;
}

interface CategoryEditorProps {
  category: Category | undefined;
  kind: TransactionKind;
  onSaved: ((category: CustomCategory) => void) | undefined;
}

interface DeleteConfirmationProps {
  category: Category;
  onCancel: () => void;
}

/** Creates a custom category, or edits or deletes one. */
export const CategoryEditorSheet: React.FC<CategoryEditorSheetProps> = ({
  category,
  kind = TransactionKind.Expense,
  onSaved,
  onClose,
}) => {
  return (
    <Sheet
      title={category ? 'Edit category' : 'New category'}
      onClose={onClose}
    >
      <CategoryEditor
        category={category}
        kind={category?.kind ?? kind}
        onSaved={onSaved}
      />
    </Sheet>
  );
};

const CategoryEditor: React.FC<CategoryEditorProps> = ({
  category,
  kind,
  onSaved,
}) => {
  const store = useStore();
  const categories = useCategories();
  const showToast = useToast();
  const closeSheet = useSheetClose();
  const [label, setLabel] = React.useState(category?.label ?? '');
  const [icon, setIcon] = React.useState<CategoryIconName>(
    category?.iconName ?? DEFAULT_CATEGORY_ICON,
  );
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);

  const PreviewIcon = CATEGORY_ICONS[icon];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const problem = validateCategoryLabel(
      label,
      kind,
      categories,
      category?.id ?? null,
    );
    if (problem) {
      setError(problem);
      return;
    }
    const saved = store.saveCategory({
      id: category?.id ?? null,
      kind,
      label,
      icon,
    });
    if (!saved) {
      showToast({ message: SAVE_FAILED_MESSAGE, tone: ToastTone.Danger });
      return;
    }
    onSaved?.(saved);
    closeSheet();
  };

  const handleLabelChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    setLabel(event.target.value);
    setError(undefined);
  };

  if (category && isConfirmingDelete) {
    return (
      <DeleteConfirmation
        category={category}
        onCancel={() => setIsConfirmingDelete(false)}
      />
    );
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <header className={styles.header}>
        <button type='button' className={styles.cancel} onClick={closeSheet}>
          Cancel
        </button>
        <h2 className={styles.title}>
          {category ? 'Edit category' : 'New category'}
        </h2>
        <Button
          type='submit'
          variant={ButtonVariant.Primary}
          className={styles.save}
        >
          Save
        </Button>
      </header>
      <div className={styles.field}>
        <label htmlFor={NAME_INPUT_ID} className={LABEL_STYLE}>
          Name
        </label>
        <div
          className={cx(
            styles.inputWrapper,
            error !== undefined && styles.inputWrapperInvalid,
          )}
        >
          <span className={styles.preview} aria-hidden='true'>
            <PreviewIcon size={20} strokeWidth={1.75} />
          </span>
          <input
            id={NAME_INPUT_ID}
            className={styles.input}
            value={label}
            placeholder='For example, Coffee'
            maxLength={MAX_CATEGORY_LABEL_LENGTH}
            autoComplete='off'
            autoCapitalize='sentences'
            enterKeyHint='done'
            aria-invalid={error !== undefined}
            aria-describedby={error === undefined ? undefined : ERROR_ID}
            onChange={handleLabelChange}
          />
          <span className={styles.counter} aria-hidden='true'>
            {label.length}/{MAX_CATEGORY_LABEL_LENGTH}
          </span>
        </div>
      </div>
      {error !== undefined && (
        <p id={ERROR_ID} role='alert' className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.field}>
        <span className={LABEL_STYLE}>Icon</span>
        <IconPicker value={icon} onChange={setIcon} />
      </div>
      {category && (
        <Button
          variant={ButtonVariant.Danger}
          isLarge
          onClick={() => setIsConfirmingDelete(true)}
        >
          Delete category
        </Button>
      )}
    </form>
  );
};

const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
  category,
  onCancel,
}) => {
  const store = useStore();
  const showToast = useToast();
  const closeSheet = useSheetClose();
  const transactions = useTransactions();
  const usageCount = transactions.filter(
    ({ categoryId }) => categoryId === category.id,
  ).length;
  const fallbackLabel = getFallbackCategory(category.kind).label;

  const handleDelete = (): void => {
    if (!store.deleteCategory(category.id)) {
      showToast({ message: SAVE_FAILED_MESSAGE, tone: ToastTone.Danger });
      return;
    }
    closeSheet();
    showToast({ message: `Deleted ${category.label}` });
  };

  return (
    <div className={styles.confirmation}>
      <h2 className={styles.confirmationTitle}>Delete “{category.label}”?</h2>
      <p className={styles.confirmationText}>
        {usageCount > 0
          ? `Its ${formatCount(usageCount, 'transaction')} will move to ${fallbackLabel}.`
          : 'No transactions use it.'}{' '}
        This cannot be undone.
      </p>
      <Button variant={ButtonVariant.Danger} isLarge onClick={handleDelete}>
        Delete category
      </Button>
      <Button isLarge onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
};
