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
import { TEXT_INPUT_STYLE } from '../../utilities/styles';
import { SyncPhase } from '../../utilities/sync/syncEngine';
import { createSyncToken } from '../../utilities/sync/token';
import { formatCount } from '../../utilities/text';
import { SettingsSection } from './SettingsSection';

const ERROR_ID = 'erase-password-error';

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
  password: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  `,
  note: css`
    font-size: 14px;
    font-weight: 500;
  `,
  error: css`
    color: var(--color-danger);
    font-size: 13px;
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

/**
 * Asks before erasing. While cloud sync is on, erasing also empties the
 * cloud copy, so it then takes the sync password as well.
 */
const EraseConfirmation: React.FC<EraseConfirmationProps> = ({
  transactionCount,
  categoryCount,
}) => {
  const store = useStore();
  const showToast = useToast();
  const closeSheet = useSheetClose();
  const isSyncOn = useSyncStatus().phase !== SyncPhase.Off;
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [isChecking, setIsChecking] = React.useState(false);
  const categoriesText =
    categoryCount > 0
      ? ` and ${formatCount(categoryCount, 'custom category', 'custom categories')}`
      : '';

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (isChecking) {
      return;
    }
    // The password is checked against the token saved when sync was turned
    // on, so this works offline and the password never leaves the phone.
    const token = store.getState().sync?.token;
    if (token !== undefined) {
      setIsChecking(true);
      const passwordError = await getPasswordError(password, token);
      setIsChecking(false);
      if (passwordError !== undefined) {
        setError(passwordError);
        return;
      }
    }
    const isErased = store.eraseData();
    closeSheet();
    showToast(
      isErased
        ? { message: 'All data erased' }
        : { message: 'Could not erase the data', tone: ToastTone.Danger },
    );
  };

  const handlePasswordChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    setPassword(event.target.value);
    setError(undefined);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className={styles.title}>Erase all data?</h2>
      <p className={styles.description}>
        This removes {formatCount(transactionCount, 'transaction')}
        {categoriesText} from this device
        {isSyncOn && ' and from the cloud copy'}. Settings are kept. It cannot
        be undone, so export a backup first if you might want them back.
      </p>
      {isSyncOn && (
        <div className={styles.password}>
          <p className={styles.note}>Enter the sync password to confirm.</p>
          <input
            type='password'
            className={TEXT_INPUT_STYLE}
            value={password}
            placeholder='Sync password'
            aria-label='Sync password'
            aria-invalid={error !== undefined}
            aria-describedby={error === undefined ? undefined : ERROR_ID}
            autoComplete='current-password'
            enterKeyHint='done'
            onChange={handlePasswordChange}
          />
          {error !== undefined && (
            <p id={ERROR_ID} role='alert' className={styles.error}>
              {error}
            </p>
          )}
        </div>
      )}
      <div className={styles.actions}>
        <Button
          type='submit'
          variant={ButtonVariant.Danger}
          isLarge
          disabled={(isSyncOn && password === '') || isChecking}
        >
          Erase everything
        </Button>
        <Button isLarge onClick={closeSheet}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

/** Returns what is wrong with the password, or undefined when it is right. */
async function getPasswordError(
  password: string,
  token: string,
): Promise<string | undefined> {
  try {
    return (await createSyncToken(password)) === token
      ? undefined
      : 'That password is not right.';
  } catch (error) {
    // Hashing needs a secure page, the same as when sync was turned on.
    console.error('Checking the sync password failed', error);
    return 'Could not check the password. Try again.';
  }
}
