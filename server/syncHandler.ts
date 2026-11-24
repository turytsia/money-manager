import { AuthStatus, type Authenticator } from './authenticator.js';
import { VersionConflictError, type DocumentStore } from './documentStore.js';

/** Kept under Vercel's 4.5 MB limit for one request. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const SNAPSHOT_LIFETIME_DAYS = 60;
const DOCUMENT_APP_ID = 'money-manager';
const GZIP_CONTENT_TYPE = 'application/gzip';
const KNOWN_VERSION_PARAMETER = 'known';
const ISO_DATE_LENGTH = 10;

const RESPONSE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
} as const;

export interface SyncHandlerOptions {
  store: DocumentStore;
  authenticator: Authenticator;
  now?: () => Date;
}

export type SyncHandler = (request: Request) => Promise<Response>;

interface SavePayload {
  /** The version the sender last saw, or null if it saw no document. */
  baseVersion: string | null;
  data: object;
}

/**
 * Handles the two requests the app makes: GET to fetch the saved document
 * and PUT to replace it. Nothing here is tied to a hosting or storage
 * vendor; those arrive as `store` and `authenticator`.
 *
 * A PUT only succeeds if the sender has seen the latest version. That is
 * what stops two devices from overwriting each other's changes.
 */
export function createSyncHandler({
  store,
  authenticator,
  now = () => new Date(),
}: SyncHandlerOptions): SyncHandler {
  async function handleGet(
    request: Request,
    userId: string,
  ): Promise<Response> {
    const key = getDocumentKey(userId);
    const knownVersion = new URL(request.url).searchParams.get(
      KNOWN_VERSION_PARAMETER,
    );
    const version = await store.readVersion(key);
    if (version !== null && version === knownVersion) {
      return respond(200, { status: 'unchanged' });
    }
    const document = version === null ? null : await store.read(key);
    if (!document) {
      return respond(200, { status: 'empty' });
    }
    // The saved body is already JSON, so it is passed through as it is.
    const body = `{"status":"found","version":${JSON.stringify(document.version)},"data":${document.body}}`;
    return new Response(body, { status: 200, headers: RESPONSE_HEADERS });
  }

  async function handlePut(
    request: Request,
    userId: string,
  ): Promise<Response> {
    const text = await readBody(request);
    if (text === undefined) {
      return respond(413, { error: 'too-large' });
    }
    const payload = parsePayload(text);
    if (!payload) {
      return respond(400, { error: 'invalid' });
    }
    const key = getDocumentKey(userId);
    const currentVersion = await store.readVersion(key);
    if (currentVersion !== payload.baseVersion) {
      return respond(409, { status: 'conflict' });
    }
    if (currentVersion !== null) {
      await keepDailySnapshot(userId, key);
    }
    try {
      const version = await store.write(key, JSON.stringify(payload.data), {
        expectedVersion: currentVersion,
      });
      return respond(200, { status: 'saved', version });
    } catch (error) {
      if (error instanceof VersionConflictError) {
        return respond(409, { status: 'conflict' });
      }
      throw error;
    }
  }

  /**
   * Before the first change of each day, keeps a copy of the document as
   * it was. A mistake that gets synced can then be undone from that copy.
   */
  async function keepDailySnapshot(userId: string, key: string): Promise<void> {
    const snapshotKey = getSnapshotKey(userId, now());
    if ((await store.readVersion(snapshotKey)) !== null) {
      return;
    }
    const current = await store.read(key);
    if (current) {
      await writeIfAbsent(store, snapshotKey, current.body);
    }
  }

  return async (request) => {
    const auth = await authenticator.authenticate(request);
    if (auth.status !== AuthStatus.Granted) {
      return auth.status === AuthStatus.NotConfigured
        ? respond(503, { error: 'not-configured' })
        : respond(401, { error: 'unauthorized' });
    }
    try {
      if (request.method === 'GET') {
        return await handleGet(request, auth.userId);
      }
      if (request.method === 'PUT') {
        return await handlePut(request, auth.userId);
      }
      return respond(405, { error: 'method-not-allowed' });
    } catch (error) {
      console.error('Sync request failed', error);
      return respond(500, { error: 'failed' });
    }
  };
}

export function getDocumentKey(userId: string): string {
  return `users/${userId}/data.json`;
}

export function getSnapshotKey(userId: string, date: Date): string {
  const day = date.toISOString().slice(0, ISO_DATE_LENGTH);
  return `users/${userId}/snapshots/${day}.json`;
}

async function writeIfAbsent(
  store: DocumentStore,
  key: string,
  body: string,
): Promise<void> {
  try {
    await store.write(key, body, {
      expectedVersion: null,
      expiresInDays: SNAPSHOT_LIFETIME_DAYS,
    });
  } catch (error) {
    // Another request made the same snapshot first, which is just as good.
    if (!(error instanceof VersionConflictError)) {
      throw error;
    }
  }
}

/** Returns the body as text, or undefined when it is over the size limit. */
async function readBody(request: Request): Promise<string | undefined> {
  if (!request.body) {
    return '';
  }
  const isCompressed = request.headers
    .get('content-type')
    ?.startsWith(GZIP_CONTENT_TYPE);
  const stream = isCompressed
    ? request.body.pipeThrough(new DecompressionStream('gzip'))
    : request.body;

  // Read in pieces and stop early, so a body that unpacks to something
  // huge cannot use up the function's memory.
  const reader = stream.getReader();
  const chunks: Array<Uint8Array> = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parsePayload(text: string): SavePayload | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const { baseVersion = null, data } = parsed;
  const isValid =
    (baseVersion === null || typeof baseVersion === 'string') &&
    isRecord(data) &&
    data.app === DOCUMENT_APP_ID;
  return isValid ? { baseVersion, data } : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function respond(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: RESPONSE_HEADERS,
  });
}
