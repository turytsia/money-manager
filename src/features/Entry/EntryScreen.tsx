import * as React from 'react';
import { css, cx } from '@emotion/css';
import {
  useSettings,
  useStore,
} from '../../components/StoreProvider/StoreProvider';
import {
  ToastTone,
  useToast,
} from '../../components/ToastProvider/ToastProvider';
import { TransactionForm } from '../../components/TransactionForm/TransactionForm';
import { getCategory } from '../../utilities/categories';
import { formatMoney } from '../../utilities/money';
import { SCREEN_STYLE } from '../../utilities/styles';
import type { TransactionInput } from '../../utilities/types';
import { SpendingSummary } from './SpendingSummary';

const styles = {
  // The form fills the space between the status bar and the tab bar
  // exactly, so its save button can never end up under the tab bar.
  root: cx(
    SCREEN_STYLE,
    css`
      display: flex;
      flex-direction: column;
      padding-top: calc(var(--safe-top) + 12px);
      padding-bottom: calc(var(--tab-bar-height) + var(--safe-bottom) + 10px);
      overflow: hidden;
    `,
  ),
};

/** The first screen of the app: add an expense or income in a few taps. */
export const EntryScreen: React.FC = () => {
  const store = useStore();
  const showToast = useToast();
  const { currency } = useSettings();

  const handleSubmit = (input: TransactionInput): boolean => {
    const transaction = store.addTransaction(input);
    if (!transaction) {
      showToast({
        message: 'Could not save. Storage may be full.',
        tone: ToastTone.Danger,
      });
      return false;
    }
    const amount = formatMoney(input.amount, currency);
    showToast({
      message: `Added ${amount} to ${getCategory(store.getState().categories, transaction.categoryId).label}`,
      actionLabel: 'Undo',
      onAction: () => store.deleteTransaction(transaction.id),
    });
    return true;
  };

  return (
    <section aria-label='Add' className={styles.root}>
      <TransactionForm caption={<SpendingSummary />} onSubmit={handleSubmit} />
    </section>
  );
};
