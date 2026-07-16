import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const publicRoot = resolve(root, 'apps/web/public');
const manifest = JSON.parse(
  await readFile(resolve(publicRoot, 'manifest.webmanifest'), 'utf8')
);
const serviceWorker = await readFile(resolve(publicRoot, 'sw.js'), 'utf8');
const index = await readFile(resolve(root, 'apps/web/index.html'), 'utf8');

function fail(message) {
  throw new Error(`PWA verification failed: ${message}`);
}

if (
  manifest.id !== '/' ||
  manifest.start_url !== '/' ||
  manifest.scope !== '/' ||
  manifest.display !== 'standalone' ||
  !/^#[0-9a-f]{6}$/i.test(manifest.theme_color)
) {
  fail('manifest application metadata is incomplete');
}

const expectedIcons = new Map([
  ['/icons/tankquest-v1-192.png', [192, 192, 'any']],
  ['/icons/tankquest-v1-512.png', [512, 512, 'any']],
  ['/icons/tankquest-v1-maskable-512.png', [512, 512, 'maskable']],
]);
for (const icon of manifest.icons ?? []) {
  const expected = expectedIcons.get(icon.src);
  if (!expected) fail(`unexpected icon ${icon.src}`);
  const [width, height, purpose] = expected;
  if (
    icon.sizes !== `${width}x${height}` ||
    icon.type !== 'image/png' ||
    icon.purpose !== purpose
  ) {
    fail(`invalid metadata for ${icon.src}`);
  }
  const bytes = await readFile(resolve(publicRoot, `.${icon.src}`));
  if (
    bytes.toString('ascii', 1, 4) !== 'PNG' ||
    bytes.readUInt32BE(16) !== width ||
    bytes.readUInt32BE(20) !== height
  ) {
    fail(`invalid PNG dimensions for ${icon.src}`);
  }
  expectedIcons.delete(icon.src);
}
if (expectedIcons.size > 0) fail('required versioned icons are missing');

const apiGuard = serviceWorker.indexOf("url.pathname === '/api'");
const firstRespondWith = serviceWorker.indexOf('event.respondWith');
if (apiGuard < 0 || firstRespondWith < 0 || apiGuard > firstRespondWith) {
  fail('API denylist must execute before every cache response');
}
if (
  serviceWorker.includes('skipWaiting') ||
  serviceWorker.includes('clients.claim') ||
  serviceWorker.includes("addEventListener('sync'")
) {
  fail('Service Worker must not force activation or queue business sync');
}
if (
  !serviceWorker.includes("request.mode === 'navigate'") ||
  !serviceWorker.includes("caches.match('/')") ||
  !serviceWorker.includes("pathname.startsWith('/assets/')") ||
  !serviceWorker.includes("pathname === '/'") ||
  !serviceWorker.includes("includes('text/html')")
) {
  fail('shell navigation or versioned static caching is incomplete');
}

const shellSection = serviceWorker.slice(
  serviceWorker.indexOf('const APP_SHELL'),
  serviceWorker.indexOf('];') + 2
);
for (const forbidden of ['/api/', '/parent', 'report', 'session', 'reward']) {
  if (shellSection.includes(forbidden)) fail(`shell includes ${forbidden}`);
}
if (!index.includes('rel="manifest"') || !index.includes('theme-color')) {
  fail('index metadata does not link the PWA manifest and theme color');
}

await stat(resolve(publicRoot, 'sw.js'));
await verifyServiceWorkerBehavior(serviceWorker);
console.log('Verified safe PWA shell, cache boundary, and 3 versioned icons.');

async function verifyServiceWorkerBehavior(source) {
  const listeners = new Map();
  const stored = new Map([['/', new Response('<html>shell</html>')]]);
  let cacheWrites = 0;
  const cache = {
    addAll: async () => undefined,
    put: async (key, response) => {
      cacheWrites += 1;
      stored.set(typeof key === 'string' ? key : key.url, response);
    },
  };
  const context = {
    URL,
    Response,
    Promise,
    self: {
      location: { origin: 'https://tankquest.test' },
      addEventListener: (type, listener) => listeners.set(type, listener),
    },
    caches: {
      open: async () => cache,
      keys: async () => [],
      delete: async () => true,
      match: async (key) => stored.get(typeof key === 'string' ? key : key.url),
    },
    fetch: async (request) =>
      new Response(
        new URL(request.url).pathname === '/manifest.webmanifest'
          ? '{"name":"manifest"}'
          : '<html>page</html>',
        {
          headers: {
            'content-type': new URL(request.url).pathname.endsWith(
              '.webmanifest'
            )
              ? 'application/manifest+json'
              : 'text/html',
          },
        }
      ),
  };
  vm.runInNewContext(source, context);
  const onFetch = listeners.get('fetch');
  if (!onFetch) fail('Service Worker fetch handler is missing');

  let apiResponse;
  onFetch({
    request: fakeRequest('/api'),
    respondWith: (response) => {
      apiResponse = response;
    },
  });
  if (apiResponse !== undefined || cacheWrites !== 0) {
    fail('API requests must bypass Service Worker responses and caches');
  }

  const manifestResponse = captureResponse(onFetch, '/manifest.webmanifest');
  await manifestResponse;
  if (cacheWrites !== 0) {
    fail('non-root navigation must not replace the application shell');
  }

  const rootResponse = captureResponse(onFetch, '/');
  await rootResponse;
  if (cacheWrites !== 1) fail('HTML root navigation must refresh the shell');
}

function fakeRequest(pathname) {
  return {
    method: 'GET',
    mode: 'navigate',
    url: `https://tankquest.test${pathname}`,
  };
}

function captureResponse(onFetch, pathname) {
  let response;
  onFetch({
    request: fakeRequest(pathname),
    respondWith: (value) => {
      response = value;
    },
  });
  if (!response) fail(`navigation ${pathname} was not handled`);
  return response;
}
