import * as React from 'react';
import { css } from '@emotion/css';
import { Button, ButtonVariant } from '../../components/Button/Button';
import { Sheet, useSheetClose } from '../../components/Sheet/Sheet';
import {
  useStore,
  useTransactions,
} from '../../components/StoreProvider/StoreProvider';
import {
  ToastTone,
  useToast,
} from '../../components/ToastProvider/ToastProvider';
import type { ParsedBackup } from '../../utilities/backup';
import { formatCount } from '../../utilities/text';
import { ImportMode } from '../../utilities/types';

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

export interface ImportSheetProps {
  backup: ParsedBackup;
  onClose: () => void;
}

interface ImportOptionsProps {
  backup: ParsedBackup;
}

/** Asks how a backup should be brought in before anything is changed. */
export const ImportSheet: React.FC<ImportSheetProps> = ({
  backup,
  onClose,
}) => {
  return (
    <Sheet title='Import backup' onClose={onClose}>
      <ImportOptions backup={backup} />
    </Sheet>
  );
};

const ImportOptions: React.FC<ImportOptionsProps> = ({ backup }) => {
  const store = useStore();
  const showToast = useToast();
  const closeSheet = useSheetClose();
  const hasData = useTransactions().length > 0;
  const foundText = formatCount(backup.transactions.length, 'transaction');

  const runImport = (mode: ImportMode): void => {
    // The backup's currency only applies when its data becomes all the data.
    const currency =
      mode === ImportMode.Replace || !hasData ? backup.currency : undefined;
    const isImported = store.importTransactions(
      backup.transactions,
      mode,
      currency,
    );
    closeSheet();
    showToast(
      isImported
        ? { message: `Imported ${foundText}` }
        : {
            message: 'Import failed. Storage may be full.',
            tone: ToastTone.Danger,
          },
    );
  };

  return (
    <>
      <h2 className={styles.title}>Import {foundText}?</h2>
      <p className={styles.description}>
        {getDescription(hasData, backup.skippedCount)}
      </p>
      <div className={styles.actions}>
        <Button
          variant={ButtonVariant.Primary}
          isLarge
          onClick={() => runImport(ImportMode.Merge)}
        >
          {hasData ? 'Merge with my data' : 'Import'}
        </Button>
        {hasData && (
          <Button
            variant={ButtonVariant.Danger}
            isLarge
            onClick={() => runImport(ImportMode.Replace)}
          >
            Replace my data
          </Button>
        )}
        <Button isLarge onClick={closeSheet}>
          Cancel
        </Button>
      </div>
    </>
  );
};

function getDescription(hasData: boolean, skippedCount: number): string {
  const skipped =
    skippedCount > 0
      ? ` ${formatCount(skippedCount, 'item')} in the file could not be read and will be skipped.`
      : '';
  const choice = hasData
    ? 'Merging keeps what is on this device and adds the backup to it. Replacing removes what is on this device first.'
    : 'They will be added to this device.';
  return choice + skipped;
}
