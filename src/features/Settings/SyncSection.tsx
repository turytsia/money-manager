import * as React from 'react';
import { css, cx, keyframes } from '@emotion/css';
import { CloudCheck, CloudOff, RefreshCw } from 'lucide-react';
import { Button, ButtonVariant } from '../../components/Button/Button';
import {
  useSyncEngine,
  useSyncStatus,
} from '../../components/SyncEngineProvider/SyncEngineProvider';
import { useToast } from '../../components/ToastProvider/ToastProvider';
import { formatDateTime } from '../../utilities/dates';
import { TEXT_INPUT_STYLE } from '../../utilities/styles';
import { SyncPhase } from '../../utilities/sync/syncEngine';
import { createSyncToken } from '../../utilities/sync/token';
import { SettingsSection } from './SettingsSection';

const ERROR_ID = 'sync-error';

const SPIN = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const styles = {
  note: css`
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
  form: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  fields: css`
    display: flex;
    gap: 8px;
  `,
  input: css`
    flex: 1;
  `,
  error: css`
    color: var(--color-danger);
    font-size: 13px;
  `,
  status: css`
    display: flex;
    align-items: center;
    gap: 12px;
  `,
  statusIcon: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg);
  `,
  statusIconProblem: css`
    color: var(--color-danger);
  `,
  spinning: css`
    animation: ${SPIN} 900ms linear infinite;
  `,
  statusText: css`
    display: flex;
    flex-direction: column;
    min-width: 0;
  `,
  statusTitle: css`
    font-size: 15px;
    font-weight: 500;
  `,
  actions: css`
    display: flex;
    gap: 8px;
  `,
};

interface ConnectFormProps {
  isConnecting: boolean;
  error: string | undefined;
  onConnect: (password: string) => void;
}

interface SyncDetailsProps {
  phase: SyncPhase;
  syncedAt: number | null;
}

interface StatusIconProps {
  phase: SyncPhase;
}

/**
 * Turns cloud sync on and off, and shows what it is doing. Sync keeps a
 * copy of the data off the phone, so it can be brought back if the phone
 * ever loses it.
 */
export const SyncSection: React.FC = () => {
  const engine = useSyncEngine();
  const showToast = useToast();
  const { phase, syncedAt } = useSyncStatus();
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);

  const handleConnect = async (password: string): Promise<void> => {
    setIsConnecting(true);
    setError(undefined);
    const result = await connect(password, engine.connect);
    setIsConnecting(false);
    if (result === SyncPhase.Idle) {
      showToast({ message: 'Cloud sync is on' });
      return;
    }
    setError(getConnectError(result));
  };

  return (
    <SettingsSection title='Cloud sync'>
      {phase === SyncPhase.Off || isConnecting ? (
        <ConnectForm
          isConnecting={isConnecting}
          error={error}
          onConnect={handleConnect}
        />
      ) : (
        <SyncDetails phase={phase} syncedAt={syncedAt} />
      )}
    </SettingsSection>
  );
};

const ConnectForm: React.FC<ConnectFormProps> = ({
  isConnecting,
  error,
  onConnect,
}) => {
  const [password, setPassword] = React.useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (password !== '' && !isConnecting) {
      onConnect(password);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <p className={styles.note}>
        Keeps a copy of your data in the cloud and brings it back if this phone
        ever loses it. Enter the sync password to turn it on.
      </p>
      <div className={styles.fields}>
        <input
          type='password'
          className={cx(TEXT_INPUT_STYLE, styles.input)}
          value={password}
          placeholder='Sync password'
          aria-label='Sync password'
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : ERROR_ID}
          autoComplete='current-password'
          enterKeyHint='go'
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button
          type='submit'
          variant={ButtonVariant.Primary}
          disabled={password === '' || isConnecting}
        >
          {isConnecting ? 'Connecting…' : 'Turn on'}
        </Button>
      </div>
      {error !== undefined && (
        <p id={ERROR_ID} role='alert' className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
};

const SyncDetails: React.FC<SyncDetailsProps> = ({ phase, syncedAt }) => {
  const engine = useSyncEngine();
  const isSyncing = phase === SyncPhase.Syncing;
  const hasProblem =
    phase === SyncPhase.Unauthorized ||
    phase === SyncPhase.Unavailable ||
    phase === SyncPhase.Failed;

  return (
    <>
      <div className={styles.status} role='status'>
        <span
          className={cx(
            styles.statusIcon,
            hasProblem && styles.statusIconProblem,
          )}
          aria-hidden='true'
        >
          <StatusIcon phase={phase} />
        </span>
        <span className={styles.statusText}>
          <span className={styles.statusTitle}>{getStatusTitle(phase)}</span>
          <span className={styles.note}>
            {syncedAt === null
              ? 'Not synced yet'
              : `Last synced ${formatDateTime(syncedAt)}`}
          </span>
        </span>
      </div>
      {phase === SyncPhase.Unauthorized && (
        <p className={styles.note}>
          The sync password seems to have changed. Turn sync off and on again
          with the new one. Your data on this phone is safe meanwhile.
        </p>
      )}
      <div className={styles.actions}>
        <Button
          isBlock
          disabled={isSyncing}
          onClick={() => void engine.syncNow()}
        >
          Sync now
        </Button>
        <Button isBlock onClick={engine.disconnect}>
          Turn off
        </Button>
      </div>
    </>
  );
};

/** Hashing the password needs a secure page; without one it cannot work. */
async function connect(
  password: string,
  connectWithToken: (token: string) => Promise<SyncPhase>,
): Promise<SyncPhase> {
  try {
    return await connectWithToken(await createSyncToken(password));
  } catch (error) {
    console.error('Turning sync on failed', error);
    return SyncPhase.Failed;
  }
}

function getConnectError(phase: SyncPhase): string {
  switch (phase) {
    case SyncPhase.Unauthorized:
      return 'That password is not right.';
    case SyncPhase.Unavailable:
      return 'Cloud sync is not set up at this address.';
    case SyncPhase.Offline:
      return 'Could not reach the server. Check your connection.';
    default:
      return 'Could not turn sync on. Try again.';
  }
}

function getStatusTitle(phase: SyncPhase): string {
  switch (phase) {
    case SyncPhase.Syncing:
      return 'Syncing…';
    case SyncPhase.Offline:
      return 'Waiting for a connection';
    case SyncPhase.Unauthorized:
      return 'Password not accepted';
    case SyncPhase.Unavailable:
      return 'Not available at this address';
    case SyncPhase.Failed:
      return 'Could not sync';
    default:
      return 'Up to date';
  }
}

const StatusIcon: React.FC<StatusIconProps> = ({ phase }) => {
  if (phase === SyncPhase.Syncing) {
    return (
      <RefreshCw size={18} strokeWidth={1.75} className={styles.spinning} />
    );
  }
  return phase === SyncPhase.Idle ? (
    <CloudCheck size={18} strokeWidth={1.75} />
  ) : (
    <CloudOff size={18} strokeWidth={1.75} />
  );
};
