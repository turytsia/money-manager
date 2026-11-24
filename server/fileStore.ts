import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  VersionConflictError,
  type DocumentStore,
  type StoredDocument,
} from './documentStore.js';

const VERSION_LENGTH = 16;

/**
 * Keeps documents as files in a folder. Used when running the app on your
 * own computer, where there is no cloud storage to talk to.
 */
export function createFileStore(directory: string): DocumentStore {
  async function read(key: string): Promise<StoredDocument | null> {
    try {
      const body = await readFile(join(directory, key), 'utf8');
      return { body, version: getVersion(body) };
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }
      throw error;
    }
  }

  return {
    read,
    readVersion: async (key) => (await read(key))?.version ?? null,
    write: async (key, body, options = {}) => {
      if (options.expectedVersion !== undefined) {
        const currentVersion = (await read(key))?.version ?? null;
        if (currentVersion !== options.expectedVersion) {
          throw new VersionConflictError(key);
        }
      }
      const path = join(directory, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body, 'utf8');
      return getVersion(body);
    },
  };
}

function getVersion(body: string): string {
  return createHash('sha256')
    .update(body)
    .digest('hex')
    .slice(0, VERSION_LENGTH);
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
