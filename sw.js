/**
 * Iron Jungle kiosk shell.
 *
 * The iPad lives on gym wifi, so the rule is: the app has to open with no
 * network at all. Navigations go to the network FIRST — a deploy must land on
 * the next reload, which a cache-first worker would prevent — but with a 3 s
 * timeout, so a dead network cannot hold the door open either. Past the timeout
 * the cached shell opens and the kiosk still works.
 *
 * Versioning: bump CACHE whenever the shell changes. `activate` deletes every
 * other ij-shell-* cache, so files left by an older worker cannot be served.
 * Admin shows the page's BUILD string — that, not a force-reload, is how you
 * tell which build is really running.
 */
const CACHE = 'ij-shell-v1';
const SHELL = ['./', 'index.html', 'logo.png', 'manifest.json', 'vendor/'];
const NAV_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll is atomic: a half-precached shell is a shell that opens blank.
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('ij-shell-') && key !== CACHE) {
        await caches.delete(key);
      }
    }
    await self.clients.claim();
  })());
});

/**
 * The shell for a navigation: the network's copy if it arrives within 3 s,
 * otherwise the cached one. A fresh copy is stored under `index.html` because
 * that is the key the fallback reads — the page is served at both `/` and
 * `/index.html`, and only one key can hold the answer.
 */
async function shellFor(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await Promise.race([
      fetch(request),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('navigation timeout')), NAV_TIMEOUT_MS);
      })
    ]);
    if (fresh && fresh.ok) await cache.put('index.html', fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match('index.html');
    if (cached) return cached;
    const root = await cache.match('./');
    if (root) return root;
    // Nothing cached and no network: an error is the honest answer.
    return Response.error();
  }
}

/**
 * Everything else (logo, manifest, the vendored scanner) only changes when the
 * shell version changes, so it is cache-first: instant, and offline by design.
 */
async function assetFor(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) await cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // POST/PUT (nothing here does, but the scanner library might one day) is
  // never cached and never intercepted.
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(shellFor(request));
    return;
  }
  event.respondWith(assetFor(request));
});
