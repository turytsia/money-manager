import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpSyncProvider } from '../src/utilities/sync/httpSyncProvider';
import {
  PullStatus,
  PushStatus,
  SyncFailure,
  type SyncProvider,
} from '../src/utilities/sync/syncProvider';
import { createFileStore } from './fileStore.js';
import {
  createPasswordAuthenticator,
  createToken,
} from './passwordAuthenticator.js';
import { createSyncHandler } from './syncHandler.js';

const ORIGIN = 'https://example.test';
const ENDPOINT = './api/sync';
const PASSWORD = 'correct horse battery staple';
const DOCUMENT = { app: 'money-manager', version: 2, transactions: [] };
const CHANGED_DOCUMENT = { ...DOCUMENT, currency: 'EUR' };

/**
 * Runs the app's side of sync against the server's side, with a made-up
 * network in between, to prove the two agree on how they talk.
 */
describe('the app talking to the sync server', () => {
  let directory: string;
  let contentTypes: Array<string | null>;
  let provider: SyncProvider;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sync-test-'));
    contentTypes = [];
    const handle = createSyncHandler({
      store: createFileStore(directory),
      authenticator: createPasswordAuthenticator(PASSWORD),
    });
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      const request = new Request(new URL(url, `${ORIGIN}/`), init);
      contentTypes.push(request.headers.get('content-type'));
      return handle(request);
    });
    provider = createHttpSyncProvider(ENDPOINT, createToken(PASSWORD));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(directory, { recursive: true, force: true });
  });

  it('should find nothing before anything was saved', async () => {
    expect(await provider.pull(null)).toEqual({ status: PullStatus.Empty });
  });

  it('should get back what it saved', async () => {
    const pushed = await provider.push(DOCUMENT, null);

    expect(pushed.status).toBe(PushStatus.Saved);
    expect(await provider.pull(null)).toEqual({
      status: PullStatus.Found,
      document: {
        version: pushed.status === PushStatus.Saved ? pushed.version : '',
        data: DOCUMENT,
      },
    });
  });

  it('should send its data compressed', async () => {
    await provider.push(DOCUMENT, null);

    expect(contentTypes).toEqual(['application/gzip']);
  });

  it('should be told when it already has the latest copy', async () => {
    const pushed = await provider.push(DOCUMENT, null);
    const version = pushed.status === PushStatus.Saved ? pushed.version : '';

    expect(await provider.pull(version)).toEqual({
      status: PullStatus.Unchanged,
    });
  });

  it('should be told when someone else saved first', async () => {
    await provider.push(DOCUMENT, null);

    expect(await provider.push(CHANGED_DOCUMENT, 'stale')).toEqual({
      status: PushStatus.Conflict,
    });
  });

  it('should fail with "unauthorized" for a wrong password', async () => {
    const stranger = createHttpSyncProvider(ENDPOINT, createToken('wrong'));

    await expect(stranger.pull(null)).rejects.toMatchObject({
      failure: SyncFailure.Unauthorized,
    });
  });

  it('should fail with "unavailable" where there is no sync server', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response('<html>Not found</html>', { status: 404 }),
    );

    await expect(provider.pull(null)).rejects.toMatchObject({
      failure: SyncFailure.Unavailable,
    });
  });

  it('should fail with "offline" when the network is down', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(provider.pull(null)).rejects.toMatchObject({
      failure: SyncFailure.Offline,
    });
  });
});
