// ARKA Finance — High Performance Service Worker
// Enables PWA Standalone Mode & Instant Auto-SkipWaiting on Vercel Deployment

const CACHE_NAME = 'arka-finance-v1';

self.addEventListener('install', (event) => {
  // Instantly activate new service worker without waiting
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all active window clients immediately
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ALWAYS bypass cache for version.json and API calls to guarantee instant update detection!
  if (url.pathname.endsWith('/version.json') || url.pathname.includes('/rest/v1/') || url.hostname.includes('supabase')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network first strategy with fallback to cache for static resources
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
