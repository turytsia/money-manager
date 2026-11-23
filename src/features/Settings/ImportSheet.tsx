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
    const isImported = store.importBackup(backup, mode);
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
        {getDescription(hasData, backup.categories.length, backup.skippedCount)}
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

function getDescription(
  hasData: boolean,
  categoryCount: number,
  skippedCount: number,
): string {
  const choice = hasData
    ? 'Merging keeps what is on this device and adds the backup to it. Replacing removes what is on this device first.'
    : 'They will be added to this device.';
  const categories =
    categoryCount > 0
      ? ` The backup also has ${formatCount(categoryCount, 'custom category', 'custom categories')}; ones with a name you already use are combined.`
      : '';
  const skipped =
    skippedCount > 0
      ? ` ${formatCount(skippedCount, 'item')} in the file could not be read and will be skipped.`
      : '';
  return choice + categories + skipped;
}
