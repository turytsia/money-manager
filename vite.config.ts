/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, posix, relative, sep } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { createFileStore } from './server/fileStore.js';
import { createPasswordAuthenticator } from './server/passwordAuthenticator.js';
import { createSyncHandler, type SyncHandler } from './server/syncHandler.js';

const OUTPUT_DIRECTORY = 'dist';
const SERVICE_WORKER_FILE = 'sw.js';
const BUILD_ID_PLACEHOLDER = '__BUILD_ID__';
const PRECACHE_PLACEHOLDER = "['__PRECACHE_URLS__']";
const BUILD_ID_LENGTH = 12;
const APP_VERSION: string = JSON.parse(
  readFileSync('package.json', 'utf8'),
).version;

const LOCAL_SYNC_PATH = '/api/sync';
const LOCAL_SYNC_DIRECTORY = '.sync-data';
const LOCAL_SYNC_PASSWORD = 'dev';
const LOCAL_ORIGIN = 'http://localhost';

// A relative base lets the same build run from any address or sub-path.
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorkerManifest(), localSyncApi()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  build: { target: 'es2022', assetsInlineLimit: 0 },
  test: {
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/polyfills.ts', './src/setupTests.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts'],
        },
      },
    ],
  },
});

/**
 * Fills the service worker with the list of built files and a build id, so
 * the app is fully cached for offline use and updates when any file changes.
 */
function serviceWorkerManifest(): Plugin {
  return {
    name: 'service-worker-manifest',
    apply: 'build',
    closeBundle(): void {
      const files = listFiles(OUTPUT_DIRECTORY)
        .filter((file) => file !== SERVICE_WORKER_FILE)
        .sort();
      const hash = createHash('sha256');
      files.forEach((file) => {
        hash.update(file);
        hash.update(readFileSync(join(OUTPUT_DIRECTORY, file)));
      });
      const buildId = hash.digest('hex').slice(0, BUILD_ID_LENGTH);
      const path = join(OUTPUT_DIRECTORY, SERVICE_WORKER_FILE);
      const source = readFileSync(path, 'utf8');
      if (
        !source.includes(BUILD_ID_PLACEHOLDER) ||
        !source.includes(PRECACHE_PLACEHOLDER)
      ) {
        throw new Error(`${SERVICE_WORKER_FILE} is missing its placeholders`);
      }
      writeFileSync(
        path,
        source
          .replace(BUILD_ID_PLACEHOLDER, buildId)
          .replace(PRECACHE_PLACEHOLDER, JSON.stringify(files)),
      );
    },
  };
}

/**
 * Makes cloud sync work on your own computer. `npm run dev` and
 * `npm run preview` answer the same requests as the deployed app, but keep
 * the data in a local folder. The password is "dev" unless SYNC_PASSWORD
 * is set.
 */
function localSyncApi(): Plugin {
  const handleSync = createSyncHandler({
    store: createFileStore(LOCAL_SYNC_DIRECTORY),
    authenticator: createPasswordAuthenticator(
      process.env.SYNC_PASSWORD ?? LOCAL_SYNC_PASSWORD,
    ),
  });
  const middleware = (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ): void => {
    if (!request.url?.startsWith(LOCAL_SYNC_PATH)) {
      next();
      return;
    }
    forwardToHandler(handleSync, request, response).catch((error) => {
      console.error(error);
      response.statusCode = 500;
      response.end();
    });
  };

  return {
    name: 'local-sync-api',
    configureServer(server): void {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server): void {
      server.middlewares.use(middleware);
    },
  };
}

/** Turns a Node request into a web Request, and the Response back again. */
async function forwardToHandler(
  handle: SyncHandler,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const chunks: Array<Buffer> = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const headers = new Headers();
  Object.entries(request.headers).forEach(([name, value]) => {
    if (value !== undefined) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
  });
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const webResponse = await handle(
    new Request(LOCAL_ORIGIN + request.url, {
      method: request.method,
      headers,
      body: hasBody ? new Uint8Array(Buffer.concat(chunks)) : undefined,
    }),
  );
  response.statusCode = webResponse.status;
  webResponse.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}

function listFiles(directory: string, root: string = directory): Array<string> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listFiles(path, root);
    }
    return [relative(root, path).split(sep).join(posix.sep)];
  });
}
