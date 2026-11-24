import * as React from 'react';
import { css } from '@emotion/css';
import { Button, ButtonVariant } from '../../components/Button/Button';
import { Sheet, useSheetClose } from '../../components/Sheet/Sheet';
import {
  useCategories,
  useStore,
  useTransactions,
} from '../../components/StoreProvider/StoreProvider';
import { useSyncStatus } from '../../components/SyncEngineProvider/SyncEngineProvider';
import {
  ToastTone,
  useToast,
} from '../../components/ToastProvider/ToastProvider';
import { SyncPhase } from '../../utilities/sync/syncEngine';
import { formatCount } from '../../utilities/text';
import { SettingsSection } from './SettingsSection';

const styles = {
  title: css`
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.03em;
  `,
  description: css`
    margin: 6px 0 20px;
    color: var(--color-fg-secondary);
    font-size: 14px;
  `,
  actions: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
};

interface EraseConfirmationProps {
  transactionCount: number;
  categoryCount: number;
}

export const EraseSection: React.FC = () => {
  const transactionCount = useTransactions().length;
  const categoryCount = useCategories().customCategories.length;
  const [isConfirming, setIsConfirming] = React.useState(false);

  return (
    <SettingsSection title='Danger zone'>
      <Button
        variant={ButtonVariant.Danger}
        disabled={transactionCount === 0 && categoryCount === 0}
        onClick={() => setIsConfirming(true)}
      >
        Erase all data
      </Button>
      {isConfirming && (
        <Sheet title='Erase all data' onClose={() => setIsConfirming(false)}>
          <EraseConfirmation
            transactionCount={transactionCount}
            categoryCount={categoryCount}
          />
        </Sheet>
      )}
    </SettingsSection>
  );
};

const EraseConfirmation: React.FC<EraseConfirmationProps> = ({
  transactionCount,
  categoryCount,
}) => {
  const store = useStore();
  const showToast = useToast();
  const closeSheet = useSheetClose();
  const isSyncOn = useSyncStatus().phase !== SyncPhase.Off;
  const categoriesText =
    categoryCount > 0
      ? ` and ${formatCount(categoryCount, 'custom category', 'custom categories')}`
      : '';

  const handleErase = (): void => {
    const isErased = store.eraseData();
    closeSheet();
    showToast(
      isErased
        ? { message: 'All data erased' }
        : { message: 'Could not erase the data', tone: ToastTone.Danger },
    );
  };

  return (
    <>
      <h2 className={styles.title}>Erase all data?</h2>
      <p className={styles.description}>
        This removes {formatCount(transactionCount, 'transaction')}
        {categoriesText} from this device
        {isSyncOn && ' and from the cloud copy'}. Settings are kept. It cannot
        be undone, so export a backup first if you might want them back.
      </p>
      <div className={styles.actions}>
        <Button variant={ButtonVariant.Danger} isLarge onClick={handleErase}>
          Erase everything
        </Button>
        <Button isLarge onClick={closeSheet}>
          Cancel
        </Button>
      </div>
    </>
  );
};
