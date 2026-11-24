import {
  PullStatus,
  PushStatus,
  SyncError,
  SyncFailure,
  type SyncProvider,
} from './syncProvider';

const JSON_CONTENT_TYPE = 'application/json';
const GZIP_CONTENT_TYPE = 'application/gzip';
const KNOWN_VERSION_PARAMETER = 'known';

/** Answers that mean "there is no sync server here", not "try again". */
const UNAVAILABLE_STATUSES: ReadonlyArray<number> = [404, 405, 503];
const UNAUTHORIZED_STATUSES: ReadonlyArray<number> = [401, 403];
const CONFLICT_STATUS = 409;

interface EncodedBody {
  body: BodyInit;
  contentType: string;
}

/**
 * Talks to the app's own sync endpoint (see `server/syncHandler.ts`). The
 * endpoint is plain HTTP and JSON, so it can sit on any host.
 */
export function createHttpSyncProvider(
  endpoint: string,
  token: string,
): SyncProvider {
  const authorization = `Bearer ${token}`;

  return {
    pull: async (knownVersion) => {
      const query =
        knownVersion === null
          ? ''
          : `?${KNOWN_VERSION_PARAMETER}=${encodeURIComponent(knownVersion)}`;
      const answer = await request(endpoint + query, {
        headers: { Authorization: authorization },
        cache: 'no-store',
      });
      if (answer.status === PullStatus.Found) {
        if (typeof answer.version !== 'string') {
          throw new SyncError(SyncFailure.Unknown);
        }
        return {
          status: PullStatus.Found,
          document: { version: answer.version, data: answer.data },
        };
      }
      if (
        answer.status === PullStatus.Empty ||
        answer.status === PullStatus.Unchanged
      ) {
        return { status: answer.status };
      }
      throw new SyncError(SyncFailure.Unavailable);
    },
    push: async (data, baseVersion) => {
      const { body, contentType } = await encodeBody(
        JSON.stringify({ baseVersion, data }),
      );
      const answer = await request(endpoint, {
        method: 'PUT',
        headers: { Authorization: authorization, 'Content-Type': contentType },
        body,
      });
      if (answer.status === PushStatus.Conflict) {
        return { status: PushStatus.Conflict };
      }
      if (
        answer.status === PushStatus.Saved &&
        typeof answer.version === 'string'
      ) {
        return { status: PushStatus.Saved, version: answer.version };
      }
      throw new SyncError(SyncFailure.Unknown);
    },
  };
}

async function request(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new SyncError(SyncFailure.Offline);
  }
  if (UNAUTHORIZED_STATUSES.includes(response.status)) {
    throw new SyncError(SyncFailure.Unauthorized);
  }
  const answer = await readJson(response);
  if (!answer || UNAVAILABLE_STATUSES.includes(response.status)) {
    throw new SyncError(SyncFailure.Unavailable);
  }
  if (!response.ok && response.status !== CONFLICT_STATUS) {
    throw new SyncError(SyncFailure.Unknown);
  }
  return answer;
}

/** A host without the sync endpoint answers with a web page, not JSON. */
async function readJson(
  response: Response,
): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed: unknown = await response.json();
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Compresses the upload where the browser can, to save mobile data. */
async function encodeBody(text: string): Promise<EncodedBody> {
  if (typeof CompressionStream === 'undefined') {
    return { body: text, contentType: JSON_CONTENT_TYPE };
  }
  const compressed = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return {
    body: await new Response(compressed).blob(),
    contentType: GZIP_CONTENT_TYPE,
  };
}
