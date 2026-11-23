import * as React from 'react';
import { css } from '@emotion/css';
import { Download, Upload } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { useStore } from '../../components/StoreProvider/StoreProvider';
import {
  ToastTone,
  useToast,
} from '../../components/ToastProvider/ToastProvider';
import {
  BACKUP_FILE_TYPE,
  createBackup,
  getBackupFileName,
  parseBackup,
  type ParsedBackup,
} from '../../utilities/backup';
import { getToday } from '../../utilities/dates';
import { saveTextFile } from '../../utilities/files';
import { VISUALLY_HIDDEN_STYLE } from '../../utilities/styles';
import { ImportSheet } from './ImportSheet';
import { SettingsSection } from './SettingsSection';

const BACKUP_FILE_ACCEPT = `${BACKUP_FILE_TYPE},.json`;

const styles = {
  actions: css`
    display: flex;
    gap: 8px;
  `,
  note: css`
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
};

/** Saves all data to a file, and brings data back in from such a file. */
export const BackupSection: React.FC = () => {
  const store = useStore();
  const showToast = useToast();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = React.useState<ParsedBackup | null>(
    null,
  );

  const handleExport = async (): Promise<void> => {
    const state = store.getState();
    if (state.transactions.length === 0) {
      showToast({ message: 'There is nothing to export yet' });
      return;
    }
    await saveTextFile(
      getBackupFileName(getToday()),
      createBackup(state, new Date()),
      BACKUP_FILE_TYPE,
    );
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Clearing the field lets the same file be picked again later.
    input.value = '';
    if (!file) {
      return;
    }
    const backup = parseBackup(await file.text());
    if (!backup || backup.transactions.length === 0) {
      showToast({
        message: backup
          ? 'That backup has no transactions'
          : 'That file is not a Money Manager backup',
        tone: ToastTone.Danger,
      });
      return;
    }
    setPendingBackup(backup);
  };

  return (
    <SettingsSection title='Backup'>
      <div className={styles.actions}>
        <Button isBlock onClick={handleExport}>
          <Download size={16} aria-hidden='true' />
          Export
        </Button>
        <Button isBlock onClick={() => fileInput.current?.click()}>
          <Upload size={16} aria-hidden='true' />
          Import
        </Button>
      </div>
      <p className={styles.note}>
        Your data lives only on this device. Export a backup file from time to
        time and keep it somewhere safe, for example in iCloud Drive.
      </p>
      <input
        ref={fileInput}
        type='file'
        accept={BACKUP_FILE_ACCEPT}
        aria-label='Backup file'
        tabIndex={-1}
        className={VISUALLY_HIDDEN_STYLE}
        onChange={handleFileChange}
      />
      {pendingBackup && (
        <ImportSheet
          backup={pendingBackup}
          onClose={() => setPendingBackup(null)}
        />
      )}
    </SettingsSection>
  );
};
