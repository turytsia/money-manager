/** A document as a store keeps it. */
export interface StoredDocument {
  body: string;
  /** Changes every time the document is written. */
  version: string;
}

export interface WriteOptions {
  /**
   * Only write if the document is still at this version. Use null to
   * require that it does not exist yet. Leave out to always write.
   */
  expectedVersion?: string | null;
  /** Lets the store delete the document on its own after this many days. */
  expiresInDays?: number;
}

/**
 * Where documents are kept. This is the only thing the sync code knows
 * about storage, so moving to another vendor means writing one new
 * implementation of this interface and nothing else.
 */
export interface DocumentStore {
  /** The version of a document, or null if there is none. */
  readVersion: (key: string) => Promise<string | null>;
  read: (key: string) => Promise<StoredDocument | null>;
  /** Saves a document and returns its new version. */
  write: (key: string, body: string, options?: WriteOptions) => Promise<string>;
}

/** Thrown by `write` when the document is not at the expected version. */
export class VersionConflictError extends Error {
  constructor(key: string) {
    super(`"${key}" is not at the expected version`);
    this.name = 'VersionConflictError';
  }
}
