import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthStatus, type Authenticator } from './authenticator.js';
import { createFileStore } from './fileStore.js';
import {
  createPasswordAuthenticator,
  createToken,
} from './passwordAuthenticator.js';
import { createSyncHandler, type SyncHandler } from './syncHandler.js';

const URL = 'https://example.test/api/sync';
const PASSWORD = 'correct horse battery staple';
const DOCUMENT = { app: 'money-manager', version: 2, transactions: [] };
const CHANGED_DOCUMENT = { ...DOCUMENT, currency: 'EUR' };

describe('createSyncHandler', () => {
  let directory: string;
  let handle: SyncHandler;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sync-test-'));
    handle = createSyncHandler({
      store: createFileStore(directory),
      authenticator: createPasswordAuthenticator(PASSWORD),
      now: () => new Date('2026-11-24T10:00:00Z'),
    });
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  describe('when the request does not prove who it is from', () => {
    it('should refuse a wrong password', async () => {
      const response = await handle(
        new Request(URL, {
          headers: { authorization: `Bearer ${createToken('wrong')}` },
        }),
      );

      expect(response.status).toBe(401);
    });

    it('should refuse a request without a password', async () => {
      const response = await handle(new Request(URL));

      expect(response.status).toBe(401);
    });

    it('should refuse everyone while no password is set on the server', async () => {
      const unconfigured = createSyncHandler({
        store: createFileStore(directory),
        authenticator: createPasswordAuthenticator(undefined),
      });

      const response = await unconfigured(createRequest('GET'));

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'not-configured' });
    });
  });

  it('should say there is nothing saved yet', async () => {
    const response = await handle(createRequest('GET'));

    expect(await response.json()).toEqual({ status: 'empty' });
  });

  describe('when a document is saved', () => {
    it('should return it with its version on the next fetch', async () => {
      const saved = await save(handle, DOCUMENT, null);

      const response = await handle(createRequest('GET'));

      expect(saved.status).toBe('saved');
      expect(await response.json()).toEqual({
        status: 'found',
        version: saved.version,
        data: DOCUMENT,
      });
    });

    it('should not send it again to a device that already has it', async () => {
      const { version } = await save(handle, DOCUMENT, null);

      const response = await handle(
        createRequest('GET', undefined, `?known=${version}`),
      );

      expect(await response.json()).toEqual({ status: 'unchanged' });
    });

    it('should accept a body that was compressed', async () => {
      const body = new Uint8Array(
        gzipSync(JSON.stringify({ baseVersion: null, data: DOCUMENT })),
      );

      const response = await handle(
        createRequest('PUT', body, '', 'application/gzip'),
      );

      expect(response.status).toBe(200);
      expect(await readSaved(directory, 'data.json')).toEqual(DOCUMENT);
    });
  });

  describe('when a device saves without having seen the latest version', () => {
    it('should refuse, so newer changes are not overwritten', async () => {
      await save(handle, DOCUMENT, null);

      const response = await handle(
        createRequest(
          'PUT',
          JSON.stringify({ baseVersion: 'stale', data: CHANGED_DOCUMENT }),
        ),
      );

      expect(response.status).toBe(409);
      expect(await readSaved(directory, 'data.json')).toEqual(DOCUMENT);
    });

    it('should refuse a first save when a document already exists', async () => {
      await save(handle, DOCUMENT, null);

      const response = await handle(
        createRequest(
          'PUT',
          JSON.stringify({ baseVersion: null, data: CHANGED_DOCUMENT }),
        ),
      );

      expect(response.status).toBe(409);
    });
  });

  describe('when a saved document is replaced', () => {
    it('should keep a copy of how it was at the start of the day', async () => {
      const first = await save(handle, DOCUMENT, null);
      const second = await save(handle, CHANGED_DOCUMENT, first.version);
      await save(handle, DOCUMENT, second.version);

      expect(await readSaved(directory, 'snapshots/2026-11-24.json')).toEqual(
        DOCUMENT,
      );
    });
  });

  it.each([
    ['text that is not JSON', 'hello'],
    ['a body without data', JSON.stringify({ baseVersion: null })],
    [
      'data from another app',
      JSON.stringify({ baseVersion: null, data: { app: 'other' } }),
    ],
  ])('should reject %s', async (_description, body) => {
    const response = await handle(createRequest('PUT', body));

    expect(response.status).toBe(400);
  });

  it('should reject a body over the size limit', async () => {
    const body = JSON.stringify({
      baseVersion: null,
      data: { ...DOCUMENT, padding: 'x'.repeat(4 * 1024 * 1024) },
    });

    const response = await handle(createRequest('PUT', body));

    expect(response.status).toBe(413);
  });

  it('should keep the documents of different users apart', async () => {
    const authenticator: Authenticator = {
      authenticate: async (request) => ({
        status: AuthStatus.Granted,
        userId: request.headers.get('x-user') ?? 'nobody',
      }),
    };
    const multiUser = createSyncHandler({
      store: createFileStore(directory),
      authenticator,
    });
    await multiUser(
      new Request(URL, {
        method: 'PUT',
        headers: { 'x-user': 'anna' },
        body: JSON.stringify({ baseVersion: null, data: DOCUMENT }),
      }),
    );

    const response = await multiUser(
      new Request(URL, { headers: { 'x-user': 'ben' } }),
    );

    expect(await response.json()).toEqual({ status: 'empty' });
  });
});

function createRequest(
  method: string,
  body?: BodyInit,
  query: string = '',
  contentType: string = 'application/json',
): Request {
  return new Request(URL + query, {
    method,
    headers: {
      authorization: `Bearer ${createToken(PASSWORD)}`,
      'content-type': contentType,
    },
    body,
  });
}

async function save(
  handle: SyncHandler,
  data: object,
  baseVersion: string | null,
): Promise<{ status: string; version: string }> {
  const response = await handle(
    createRequest('PUT', JSON.stringify({ baseVersion, data })),
  );
  return response.json();
}

async function readSaved(directory: string, file: string): Promise<unknown> {
  const text = await readFile(join(directory, 'users/default', file), 'utf8');
  return JSON.parse(text);
}
