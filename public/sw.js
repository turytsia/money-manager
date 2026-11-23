// Both placeholders below are filled in by the build (see vite.config.ts).
const CACHE_PREFIX = 'money-manager-';
const CACHE_NAME = `${CACHE_PREFIX}__BUILD_ID__`;
const PRECACHE_URLS = ['__PRECACHE_URLS__'];
const APP_SHELL_URL = 'index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(removeOldCaches());
});

self.addEventListener('fetch', (event) => {
  if (!isAppRequest(event.request)) {
    return;
  }
  event.respondWith(respond(event.request));
});

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  // 'reload' skips the HTTP cache, so a new build never stores stale files.
  await cache.addAll(
    PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' })),
  );
  await self.skipWaiting();
}

// Other apps can share this origin (GitHub Pages), so only our caches go.
async function removeOldCaches() {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)),
  );
  await self.clients.claim();
}

async function respond(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) {
    return cached;
  }
  if (request.mode === 'navigate') {
    const appShell = await cache.match(APP_SHELL_URL);
    if (appShell) {
      return appShell;
    }
  }
  return fetch(request);
}

function isAppRequest(request) {
  return (
    request.method === 'GET' && request.url.startsWith(self.registration.scope)
  );
}
