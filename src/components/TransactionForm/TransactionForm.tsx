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
import { getCategoriesOfKind } from '../../utilities/categories';
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
import { useSettings, useStore } from '../StoreProvider/StoreProvider';
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
  root: css`
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 12px;

    /* Tighter on short screens, so the form still fits without scrolling. */
    @media (max-height: 700px) {
      gap: 9px;
    }
  `,
  header: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 40px;
  `,
  title: css`
    font-size: 24px;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.04em;
  `,
  actions: css`
    display: flex;
    flex-shrink: 0;
    gap: 8px;
  `,
  deleteButton: css`
    width: 52px;
    padding: 0;
  `,
  // Briefly covers the button after a save, as feedback right where the
  // thumb is. It is replayed by remounting, so no timer is needed.
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
  const today = useToday();
  const { currency } = useSettings();
  const [kind, setKind] = React.useState(() =>
    transaction ? getKind(transaction) : TransactionKind.Expense,
  );
  const [categoryId, setCategoryId] = React.useState(
    () =>
      transaction?.categoryId ??
      getLastUsedCategoryId(store.getState().transactions, kind),
  );
  const [amountText, setAmountText] = React.useState(() =>
    transaction ? toAmountText(transaction.amount) : '',
  );
  const [day, setDay] = React.useState<DayKey | null>(transaction?.day ?? null);
  const [savedCount, setSavedCount] = React.useState(0);

  const isEditing = transaction !== undefined;
  const amount = parseAmountText(amountText);
  const Heading = isEditing ? 'h2' : 'h1';

  const handleKey = (key: KeypadKey): void => {
    setAmountText((text) => applyKey(text, key));
  };

  const handleKindChange = (nextKind: TransactionKind): void => {
    setKind(nextKind);
    setCategoryId(
      getLastUsedCategoryId(store.getState().transactions, nextKind),
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
    }
  };

  const handleKeyDown = React.useEffectEvent((event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (isTextEntry(event.target)) {
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

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Heading className={styles.title}>{getTitle(isEditing, kind)}</Heading>
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
        onSelect={setCategoryId}
      />
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
          onClick={handleSubmit}
        >
          {getSubmitLabel(isEditing, kind)}
          {savedCount > 0 && (
            <span
              key={savedCount}
              className={styles.confirmation}
              aria-hidden='true'
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

/** Starts on the category of the most recent transaction of that kind. */
function getLastUsedCategoryId(
  transactions: ReadonlyArray<Transaction>,
  kind: TransactionKind,
): number {
  const lastUsed = transactions.find(
    (transaction) => getKind(transaction) === kind,
  );
  return lastUsed?.categoryId ?? getCategoriesOfKind(kind)[0].id;
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
