import {
  PullStatus,
  PushStatus,
  SyncError,
  SyncFailure,
  type SyncProviderFactory,
} from '../../utilities/sync/syncProvider';

export interface MemoryCloudOptions {
  /** The only token the cloud accepts. */
  token?: string;
  /** Set to false to make every request fail as if there were no network. */
  isOnline?: boolean;
}

export interface MemoryCloud {
  createProvider: SyncProviderFactory;
  /** What is saved in the cloud right now, or undefined if nothing is. */
  getDocument: () => unknown;
  /** Saves a document the way another device would. */
  saveFromOtherDevice: (data: unknown) => void;
  setOnline: (isOnline: boolean) => void;
  /** How many times something was saved. */
  getPushCount: () => number;
}

/** The token of the password "secret", which the cloud accepts by default. */
export const SECRET_TOKEN =
  '4ba9f28f8bca8481bc717b37bd5841f8160eb5e213a3f2f91869e288a451cc2d';

/** A stand-in for the cloud that keeps one document in memory. */
export function createMemoryCloud({
  token: acceptedToken = SECRET_TOKEN,
  isOnline: isInitiallyOnline = true,
}: MemoryCloudOptions = {}): MemoryCloud {
  let document: unknown;
  let versionNumber = 0;
  let pushCount = 0;
  let isOnline = isInitiallyOnline;

  const getVersion = (): string | null =>
    document === undefined ? null : `v${versionNumber}`;

  const check = (token: string): void => {
    if (!isOnline) {
      throw new SyncError(SyncFailure.Offline);
    }
    if (token !== acceptedToken) {
      throw new SyncError(SyncFailure.Unauthorized);
    }
  };

  const save = (data: unknown): string => {
    document = structuredClone(data);
    versionNumber += 1;
    return `v${versionNumber}`;
  };

  return {
    createProvider: (token) => ({
      pull: async (knownVersion) => {
        check(token);
        const version = getVersion();
        if (version === null) {
          return { status: PullStatus.Empty };
        }
        return version === knownVersion
          ? { status: PullStatus.Unchanged }
          : {
              status: PullStatus.Found,
              document: { version, data: structuredClone(document) },
            };
      },
      push: async (data, baseVersion) => {
        check(token);
        if (baseVersion !== getVersion()) {
          return { status: PushStatus.Conflict };
        }
        pushCount += 1;
        return { status: PushStatus.Saved, version: save(data) };
      },
    }),
    getDocument: () => document,
    saveFromOtherDevice: (data) => {
      save(data);
    },
    setOnline: (nextIsOnline) => {
      isOnline = nextIsOnline;
    },
    getPushCount: () => pushCount,
  };
}
