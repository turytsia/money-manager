import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  get,
  head,
  put,
} from '@vercel/blob';
import {
  VersionConflictError,
  type DocumentStore,
  type StoredDocument,
} from './documentStore.js';

/** The Blob store must be created as private in the Vercel dashboard. */
const ACCESS = 'private';
const CONTENT_TYPE = 'application/json';

/**
 * Keeps documents in Vercel Blob. Vercel connects the store to the project
 * through environment variables, so nothing needs to be passed in here.
 */
export function createVercelBlobStore(): DocumentStore {
  async function readVersion(key: string): Promise<string | null> {
    try {
      return (await head(key)).etag;
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  async function read(key: string): Promise<StoredDocument | null> {
    try {
      // Skipping the cache matters: a cached copy can be a minute old.
      const result = await get(key, { access: ACCESS, useCache: false });
      if (!result || result.statusCode !== 200) {
        return null;
      }
      return {
        body: await new Response(result.stream).text(),
        version: result.blob.etag,
      };
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  return {
    readVersion,
    read,
    write: async (key, body, options = {}) => {
      const { expectedVersion, expiresInDays } = options;
      try {
        const result = await put(key, body, {
          access: ACCESS,
          contentType: CONTENT_TYPE,
          addRandomSuffix: false,
          allowOverwrite: expectedVersion !== null,
          ifMatch: expectedVersion ?? undefined,
          ttlDays: expiresInDays,
        });
        return result.etag;
      } catch (error) {
        const isConflict =
          error instanceof BlobPreconditionFailedError ||
          (expectedVersion === null && (await readVersion(key)) !== null);
        throw isConflict ? new VersionConflictError(key) : error;
      }
    },
  };
}
