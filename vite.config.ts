/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const OUTPUT_DIRECTORY = 'dist';
const SERVICE_WORKER_FILE = 'sw.js';
const BUILD_ID_PLACEHOLDER = '__BUILD_ID__';
const PRECACHE_PLACEHOLDER = "['__PRECACHE_URLS__']";
const BUILD_ID_LENGTH = 12;
const APP_VERSION: string = JSON.parse(
  readFileSync('package.json', 'utf8'),
).version;

// A relative base lets the same build run from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorkerManifest()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  build: { target: 'es2022', assetsInlineLimit: 0 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/polyfills.ts', './src/setupTests.ts'],
    restoreMocks: true,
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

function listFiles(directory: string, root: string = directory): Array<string> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listFiles(path, root);
    }
    return [relative(root, path).split(sep).join(posix.sep)];
  });
}
