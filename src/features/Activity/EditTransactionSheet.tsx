import * as React from 'react';
import { Sheet, useSheetClose } from '../../components/Sheet/Sheet';
import { useStore } from '../../components/StoreProvider/StoreProvider';
import {
  ToastTone,
  useToast,
} from '../../components/ToastProvider/ToastProvider';
import { TransactionForm } from '../../components/TransactionForm/TransactionForm';
import type { Transaction, TransactionInput } from '../../utilities/types';

const SAVE_FAILED_MESSAGE = 'Could not save. Storage may be full.';

export interface EditTransactionSheetProps {
  transaction: Transaction;
  onClose: () => void;
}

interface EditFormProps {
  transaction: Transaction;
}

export const EditTransactionSheet: React.FC<EditTransactionSheetProps> = ({
  transaction,
  onClose,
}) => {
  return (
    <Sheet title='Edit transaction' isTall onClose={onClose}>
      <EditForm transaction={transaction} />
    </Sheet>
  );
};

// A separate component because it needs the sheet's close function, which
// is only available inside the sheet.
const EditForm: React.FC<EditFormProps> = ({ transaction }) => {
  const store = useStore();
  const showToast = useToast();
  const closeSheet = useSheetClose();

  const handleSubmit = (input: TransactionInput): boolean => {
    const isSaved = store.saveTransaction({ ...input, id: transaction.id });
    if (!isSaved) {
      showToast({ message: SAVE_FAILED_MESSAGE, tone: ToastTone.Danger });
      return false;
    }
    closeSheet();
    return true;
  };

  const handleDelete = (): void => {
    if (!store.deleteTransaction(transaction.id)) {
      showToast({ message: SAVE_FAILED_MESSAGE, tone: ToastTone.Danger });
      return;
    }
    closeSheet();
    showToast({
      message: 'Transaction deleted',
      actionLabel: 'Undo',
      onAction: () => store.saveTransaction(transaction),
    });
  };

  return (
    <TransactionForm
      transaction={transaction}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
    />
  );
};
