import * as React from 'react';
import { css, keyframes } from '@emotion/css';
import { Check, Trash2 } from 'lucide-react';
import {
  applyKey,
  BACKSPACE_KEY,
  DECIMAL_KEY,
  isKeypadKey,
  parseAmountText,
  toAmountText,
  type KeypadKey,
} from '../../utilities/amountInput';
import type { CategoryCatalog } from '../../utilities/categories';
import { getCurrencySymbol } from '../../utilities/money';
import { getKind } from '../../utilities/transactions';
import {
  TransactionKind,
  type DayKey,
  type Transaction,
  type TransactionInput,
} from '../../utilities/types';
import { useToday } from '../../utilities/useToday';
import { Button, ButtonVariant } from '../Button/Button';
import {
  SegmentedControl,
  type SegmentedOption,
} from '../SegmentedControl/SegmentedControl';
import { isCoveredBySheet } from '../Sheet/Sheet';
import {
  useCategories,
  useSettings,
  useStore,
} from '../StoreProvider/StoreProvider';
import { AmountDisplay } from './AmountDisplay';
import { CategoryGrid } from './CategoryGrid';
import { DateSelector } from './DateSelector';
import { Keypad } from './Keypad';

const KIND_OPTIONS: ReadonlyArray<SegmentedOption<TransactionKind>> = [
  { value: TransactionKind.Expense, label: 'Expense' },
  { value: TransactionKind.Income, label: 'Income' },
];

const CONFIRMATION = keyframes`
  0% {
    opacity: 0;
  }
  12%, 70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
`;

const styles = {
  // Fills the space it is given, top to bottom. The keypad and the save
  // button sit at the bottom and never move or get covered.
  root: css`
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  `,
  // Everything above the keypad. It takes whatever height is left: the
  // amount grows into spare room, the categories give room back, and on a
  // screen too small for even that, this part scrolls.
  fields: css`
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    /* Widened to the screen edges so the amount's backdrop is not cut off. */
    margin: 0 -16px;
    padding: 0 16px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  `,
  header: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 36px;
  `,
  title: css`
    font-size: 22px;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.04em;
  `,
  actions: css`
    display: flex;
    flex-shrink: 0;
    gap: 8px;
  `,
  action: css`
    height: 48px;
  `,
  deleteButton: css`
    width: 48px;
    height: 48px;
    padding: 0;
  `,
  // Briefly covers the button after a save, as feedback right where the
  // thumb is. It is removed again once its animation has played.
  confirmation: css`
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: var(--color-fg);
    color: var(--color-inverse-fg);
    pointer-events: none;
    animation: ${CONFIRMATION} 1100ms ease both;
  `,
};

export interface TransactionFormProps {
  /** When given, the form edits this transaction instead of adding one. */
  transaction?: Transaction;
  /** Extra information shown under the amount. */
  caption?: React.ReactNode;
  /** Saves the transaction and returns whether that worked. */
  onSubmit: (input: TransactionInput) => boolean;
  onDelete?: () => void;
}

/**
 * The amount, date and category of one transaction. Entry needs as few taps
 * as possible: type the amount, pick a category, save. The date starts on
 * today and the category on the one used last.
 */
export const TransactionForm: React.FC<TransactionFormProps> = ({
  transaction,
  caption,
  onSubmit,
  onDelete,
}) => {
  const store = useStore();
  const categories = useCategories();
  const today = useToday();
  const { currency } = useSettings();
  const root = React.useRef<HTMLDivElement>(null);
  const [kind, setKind] = React.useState(() =>
    transaction ? getKind(transaction, categories) : TransactionKind.Expense,
  );
  const [chosenCategoryId, setCategoryId] = React.useState(
    () =>
      transaction?.categoryId ??
      getLastUsedCategoryId(store.getState().transactions, kind, categories),
  );
  const [amountText, setAmountText] = React.useState(() =>
    transaction ? toAmountText(transaction.amount) : '',
  );
  const [day, setDay] = React.useState<DayKey | null>(transaction?.day ?? null);
  const [savedCount, setSavedCount] = React.useState(0);
  const [isConfirming, setIsConfirming] = React.useState(false);

  const isEditing = transaction !== undefined;
  const amount = parseAmountText(amountText);
  const Heading = isEditing ? 'h2' : 'h1';
  // A hidden category is still offered while editing a transaction that
  // already has it, so opening one never changes its category by itself.
  const keptCategoryId = transaction?.categoryId;
  // The chosen category may have been hidden or deleted since it was picked.
  const categoryId = isSelectable(
    chosenCategoryId,
    kind,
    categories,
    keptCategoryId,
  )
    ? chosenCategoryId
    : getLastUsedCategoryId(store.getState().transactions, kind, categories);

  const handleKey = (key: KeypadKey): void => {
    setAmountText((text) => applyKey(text, key));
  };

  const handleKindChange = (nextKind: TransactionKind): void => {
    setKind(nextKind);
    setCategoryId(
      getLastUsedCategoryId(
        store.getState().transactions,
        nextKind,
        categories,
      ),
    );
  };

  const handleSubmit = (): void => {
    if (amount === 0) {
      return;
    }
    const isSaved = onSubmit({ day: day ?? today, categoryId, amount });
    if (isSaved && !isEditing) {
      setAmountText('');
      setDay(null);
      setSavedCount((count) => count + 1);
      setIsConfirming(true);
    }
  };

  const handleKeyDown = React.useEffectEvent((event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (isTextEntry(event.target) || isCoveredBySheet(root.current)) {
      return;
    }
    const key = toKeypadKey(event.key);
    if (key) {
      event.preventDefault();
      handleKey(key);
      return;
    }
    // On a focused button Enter already activates that button.
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      handleSubmit();
    }
  });

  // Lets the amount be typed on a hardware keyboard too.
  React.useEffect(() => {
    const listener = (event: KeyboardEvent): void => handleKeyDown(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // Switching to another tab hides this form, which stops the "Saved"
  // animation part-way. A browser replays an animation when its element is
  // shown again, so the leftover is dropped when the form gets hidden.
  React.useEffect(() => () => setIsConfirming(false), []);

  return (
    <div ref={root} className={styles.root}>
      <div className={styles.fields}>
        <header className={styles.header}>
          <Heading className={styles.title}>
            {getTitle(isEditing, kind)}
          </Heading>
          <SegmentedControl
            label='Type'
            options={KIND_OPTIONS}
            value={kind}
            isCompact
            onChange={handleKindChange}
          />
        </header>
        <AmountDisplay
          key={savedCount}
          text={amountText}
          symbol={getCurrencySymbol(currency)}
          caption={caption}
        />
        <DateSelector day={day} today={today} onChange={setDay} />
        <CategoryGrid
          kind={kind}
          selectedId={categoryId}
          keptId={keptCategoryId}
          onSelect={setCategoryId}
        />
      </div>
      <Keypad onKey={handleKey} />
      <div className={styles.actions}>
        {onDelete && (
          <Button
            variant={ButtonVariant.Danger}
            isLarge
            aria-label='Delete transaction'
            className={styles.deleteButton}
            onClick={onDelete}
          >
            <Trash2 size={20} strokeWidth={1.75} aria-hidden='true' />
          </Button>
        )}
        <Button
          variant={ButtonVariant.Primary}
          isLarge
          isBlock
          disabled={amount === 0}
          className={styles.action}
          onClick={handleSubmit}
        >
          {getSubmitLabel(isEditing, kind)}
          {isConfirming && (
            <span
              key={savedCount}
              className={styles.confirmation}
              aria-hidden='true'
              onAnimationEnd={() => setIsConfirming(false)}
            >
              <Check size={18} strokeWidth={2.5} />
              Saved
            </span>
          )}
        </Button>
      </div>
    </div>
  );
};

function getTitle(isEditing: boolean, kind: TransactionKind): string {
  if (isEditing) {
    return 'Edit transaction';
  }
  return kind === TransactionKind.Expense ? 'New expense' : 'New income';
}

function getSubmitLabel(isEditing: boolean, kind: TransactionKind): string {
  if (isEditing) {
    return 'Save changes';
  }
  return kind === TransactionKind.Expense ? 'Add expense' : 'Add income';
}

function isSelectable(
  categoryId: number,
  kind: TransactionKind,
  categories: CategoryCatalog,
  keptCategoryId: number | undefined,
): boolean {
  const category = categories.byId.get(categoryId);
  if (category?.kind !== kind) {
    return false;
  }
  const isOffered =
    !category.isFallback && !categories.hiddenIds.has(categoryId);
  return isOffered || categoryId === keptCategoryId;
}

/**
 * Starts on the category of the most recent transaction of that kind,
 * skipping categories that have been turned off.
 */
function getLastUsedCategoryId(
  transactions: ReadonlyArray<Transaction>,
  kind: TransactionKind,
  categories: CategoryCatalog,
): number {
  const lastUsed = transactions.find((transaction) =>
    isSelectable(transaction.categoryId, kind, categories, undefined),
  );
  return lastUsed?.categoryId ?? categories.visibleByKind[kind][0].id;
}

function toKeypadKey(key: string): KeypadKey | undefined {
  if (key === 'Backspace') {
    return BACKSPACE_KEY;
  }
  if (key === ',') {
    return DECIMAL_KEY;
  }
  return key !== BACKSPACE_KEY && isKeypadKey(key) ? key : undefined;
}

function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}
