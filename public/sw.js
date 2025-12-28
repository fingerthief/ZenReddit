const CACHE_NAME = 'zen-reddit-v3';
const URLS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(URLS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For API calls or external resources, use network-only but with a simple error fallback if needed
  if (url.origin !== self.location.origin || url.pathname.includes('/api/') || url.pathname.includes('.json')) {
     return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request).catch(() => {
          // If both fail and it's a navigation request, return index.html
          if (event.request.mode === 'navigate') {
            return caches.match('index.html');
          }
        });
      })
  );
});