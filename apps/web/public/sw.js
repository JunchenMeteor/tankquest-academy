const CACHE_PREFIX = 'tankquest-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v0.5.0`;
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/tankquest-v1-192.png',
  '/icons/tankquest-v1-512.png',
  '/icons/tankquest-v1-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Business and child data always use the network. Never pass API requests to a cache.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkNavigation(request, url.pathname));
    return;
  }

  if (isCacheableStaticPath(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

function isCacheableStaticPath(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.webmanifest'
  );
}

async function networkNavigation(request, pathname) {
  try {
    const response = await fetch(request);
    if (
      pathname === '/' &&
      response.ok &&
      response.headers.get('content-type')?.includes('text/html')
    ) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/', response.clone());
    }
    return response;
  } catch {
    return (await caches.match('/')) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}
