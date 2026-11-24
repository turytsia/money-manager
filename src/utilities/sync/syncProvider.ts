export enum PullStatus {
  /** The cloud copy is the one this device already has. */
  Unchanged = 'unchanged',
  /** Nothing has been saved to the cloud yet. */
  Empty = 'empty',
  Found = 'found',
}

export enum PushStatus {
  Saved = 'saved',
  /** The cloud copy changed since this device last saw it. */
  Conflict = 'conflict',
}

export enum SyncFailure {
  /** The server does not accept the password. */
  Unauthorized = 'unauthorized',
  /** There is no working sync server at this address. */
  Unavailable = 'unavailable',
  /** The server could not be reached. */
  Offline = 'offline',
  Unknown = 'unknown',
}

export interface RemoteDocument {
  /** Changes every time the document is saved. */
  version: string;
  data: unknown;
}

export type PullResult =
  | { status: PullStatus.Unchanged | PullStatus.Empty }
  | { status: PullStatus.Found; document: RemoteDocument };

export type PushResult =
  | { status: PushStatus.Saved; version: string }
  | { status: PushStatus.Conflict };

/**
 * A place in the cloud that keeps one document per user. This is all the
 * app knows about the cloud, so using another service means writing one
 * new implementation of this interface.
 */
export interface SyncProvider {
  /** Fetches the cloud copy, unless it is still at `knownVersion`. */
  pull: (knownVersion: string | null) => Promise<PullResult>;
  /**
   * Replaces the cloud copy, but only if it is still at `baseVersion`
   * (null meaning there is none yet).
   */
  push: (data: unknown, baseVersion: string | null) => Promise<PushResult>;
}

/** Makes a provider for the person the token belongs to. */
export type SyncProviderFactory = (token: string) => SyncProvider;

export class SyncError extends Error {
  readonly failure: SyncFailure;

  constructor(failure: SyncFailure) {
    super(`Sync failed: ${failure}`);
    this.name = 'SyncError';
    this.failure = failure;
  }
}
