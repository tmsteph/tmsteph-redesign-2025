const CACHE_NAME = 'tmsteph-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/finance.html',
  '/health.html',
  '/opensource.html',
  '/spirituality.html',
  '/stagehand.html',
  '/pwa.js',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-48x48.png',
  '/favicon-64x64.png',
  '/manifest.webmanifest',
  '/icons/pwa-icon-192.png',
  '/icons/pwa-icon-512.png',
  '/admin/index.html',
  '/admin/style.css',
  '/admin/admin.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(
        STATIC_ASSETS.map((asset) => new URL(asset, self.location.origin).toString())
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(request) || isSameOrigin(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_ASSETS.includes(url.pathname);
}

function isSameOrigin(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) {
      return cached;
    }

    if (request.mode === 'navigate') {
      const fallback = await caches.match(
        new URL('/index.html', self.location.origin).toString(),
        { ignoreSearch: true }
      );
      if (fallback) {
        return fallback;
      }
    }

    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await caches.match(request, { ignoreSearch: true });

  const networkFetch = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkFetch;
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
