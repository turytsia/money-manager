import {
  createBackupDocument,
  parseBackupDocument,
  toDataSnapshot,
} from '../backup';
import type { Store } from '../store';
import { hasPendingChanges } from './pendingChanges';
import {
  PullStatus,
  PushStatus,
  SyncError,
  SyncFailure,
  type SyncProviderFactory,
} from './syncProvider';

/** How long to wait after a change, so a burst of changes is sent once. */
const CHANGE_DELAY = 2500;
const RETRY_DELAY = 30_000;

/** How often coming back to the app checks for changes from other devices. */
const FOREGROUND_CHECK_INTERVAL = 60_000;

/** Tries again this many times when another device keeps saving first. */
const MAX_ATTEMPTS = 4;

export enum SyncPhase {
  Off = 'off',
  /** On, and not doing anything right now. */
  Idle = 'idle',
  Syncing = 'syncing',
  /** The server could not be reached. It will be tried again. */
  Offline = 'offline',
  /** The server no longer accepts the saved password. */
  Unauthorized = 'unauthorized',
  /** There is no sync server at this address. */
  Unavailable = 'unavailable',
  Failed = 'failed',
}

export interface SyncStatus {
  phase: SyncPhase;
  /** When the last successful sync finished, in milliseconds. */
  syncedAt: number | null;
}

export interface SyncEngine {
  getStatus: () => SyncStatus;
  subscribe: (listener: () => void) => () => void;
  /**
   * Turns sync on and runs the first sync. If that does not succeed, sync
   * is turned off again and the phase tells what went wrong.
   */
  connect: (token: string) => Promise<SyncPhase>;
  disconnect: () => void;
  syncNow: () => Promise<SyncPhase>;
  /** Starts syncing on its own. Returns a function that stops it. */
  start: () => () => void;
}

/**
 * Keeps the data on this device and the copy in the cloud the same.
 *
 * One sync is: fetch the cloud copy if it changed, combine it with what is
 * here, and send the result back if this device has anything new. Sending
 * only works if nobody else saved in between; if someone did, it starts
 * over. The app never waits for any of this: it works from the device and
 * syncing happens in the background.
 */
export function createSyncEngine(
  store: Store,
  createProvider: SyncProviderFactory,
): SyncEngine {
  const listeners = new Set<() => void>();
  let status: SyncStatus = {
    phase: store.getState().sync ? SyncPhase.Idle : SyncPhase.Off,
    syncedAt: store.getState().sync?.syncedAt ?? null,
  };
  let running: Promise<SyncPhase> | null = null;
  let isRerunNeeded = false;
  let timer: number | undefined;
  let lastCheckedAt = 0;

  function setStatus(phase: SyncPhase): void {
    const syncedAt = store.getState().sync?.syncedAt ?? null;
    if (phase === status.phase && syncedAt === status.syncedAt) {
      return;
    }
    status = { phase, syncedAt };
    listeners.forEach((listener) => listener());
  }

  async function syncOnce(): Promise<SyncPhase> {
    const token = store.getState().sync?.token;
    if (token === undefined) {
      return SyncPhase.Off;
    }
    const provider = createProvider(token);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const version = store.getState().sync?.version ?? null;
      const pulled = await provider.pull(version);
      if (pulled.status === PullStatus.Found) {
        const backup = parseBackupDocument(pulled.document.data);
        // An unreadable cloud copy is left alone rather than overwritten.
        if (!backup) {
          throw new SyncError(SyncFailure.Unknown);
        }
        const snapshot = toDataSnapshot(
          backup,
          store.getState().settings.currency,
        );
        if (!store.applyRemote(snapshot, pulled.document.version)) {
          throw new SyncError(SyncFailure.Unknown);
        }
      }
      const state = store.getState();
      if (!state.sync) {
        return SyncPhase.Off;
      }
      const isCloudEmpty = pulled.status === PullStatus.Empty;
      const baseVersion = isCloudEmpty ? null : state.sync.version;
      const generation = store.getGeneration();
      if (baseVersion !== null && !hasPendingChanges(state.sync.pending)) {
        store.markSynced(baseVersion, generation);
        return SyncPhase.Idle;
      }
      const pushed = await provider.push(
        createBackupDocument(state, new Date()),
        baseVersion,
      );
      if (pushed.status === PushStatus.Saved) {
        store.markSynced(pushed.version, generation);
        return SyncPhase.Idle;
      }
    }
    return SyncPhase.Failed;
  }

  /** Runs a sync. Calls made while one is running share its result. */
  function sync(): Promise<SyncPhase> {
    if (running) {
      isRerunNeeded = true;
      return running;
    }
    if (!store.getState().sync) {
      setStatus(SyncPhase.Off);
      return Promise.resolve(SyncPhase.Off);
    }
    window.clearTimeout(timer);
    running = (async () => {
      let phase = SyncPhase.Idle;
      try {
        do {
          isRerunNeeded = false;
          setStatus(SyncPhase.Syncing);
          phase = await syncOnce();
          // Something changed while this sync was running: go again.
          const pending = store.getState().sync?.pending;
          if (pending && hasPendingChanges(pending)) {
            isRerunNeeded = true;
          }
        } while (isRerunNeeded && phase === SyncPhase.Idle);
      } catch (error) {
        phase = toPhase(error);
      } finally {
        running = null;
        lastCheckedAt = Date.now();
      }
      setStatus(phase);
      if (phase === SyncPhase.Offline || phase === SyncPhase.Failed) {
        schedule(RETRY_DELAY);
      }
      return phase;
    })();
    return running;
  }

  function schedule(delay: number): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void sync(), delay);
  }

  /** A wrong password or a missing server will not fix itself by retrying. */
  function canSyncOnItsOwn(): boolean {
    return (
      store.getState().sync !== null &&
      status.phase !== SyncPhase.Unauthorized &&
      status.phase !== SyncPhase.Unavailable
    );
  }

  return {
    getStatus: () => status,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect: async (token) => {
      if (!store.enableSync(token)) {
        return SyncPhase.Failed;
      }
      const phase = await sync();
      if (phase !== SyncPhase.Idle) {
        window.clearTimeout(timer);
        store.disableSync();
        setStatus(SyncPhase.Off);
      }
      return phase;
    },
    disconnect: () => {
      window.clearTimeout(timer);
      store.disableSync();
      setStatus(SyncPhase.Off);
    },
    syncNow: sync,
    start: () => {
      let lastGeneration = store.getGeneration();
      const unsubscribe = store.subscribe(() => {
        const generation = store.getGeneration();
        if (generation !== lastGeneration && canSyncOnItsOwn()) {
          schedule(CHANGE_DELAY);
        }
        lastGeneration = generation;
      });
      const handleVisibilityChange = (): void => {
        if (!canSyncOnItsOwn()) {
          return;
        }
        const pending = store.getState().sync?.pending;
        const hasUnsentChanges = pending && hasPendingChanges(pending);
        const isCheckDue =
          Date.now() - lastCheckedAt > FOREGROUND_CHECK_INTERVAL;
        // Leaving the app sends what is waiting; coming back checks for news.
        if (document.hidden ? hasUnsentChanges : isCheckDue) {
          void sync();
        }
      };
      const handleOnline = (): void => {
        if (canSyncOnItsOwn()) {
          void sync();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('online', handleOnline);
      if (canSyncOnItsOwn()) {
        void sync();
      }
      return () => {
        unsubscribe();
        window.clearTimeout(timer);
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        );
        window.removeEventListener('online', handleOnline);
      };
    },
  };
}

function toPhase(error: unknown): SyncPhase {
  if (!(error instanceof SyncError)) {
    console.error('Sync failed', error);
    return SyncPhase.Failed;
  }
  switch (error.failure) {
    case SyncFailure.Unauthorized:
      return SyncPhase.Unauthorized;
    case SyncFailure.Unavailable:
      return SyncPhase.Unavailable;
    case SyncFailure.Offline:
      return SyncPhase.Offline;
    case SyncFailure.Unknown:
      return SyncPhase.Failed;
  }
}
