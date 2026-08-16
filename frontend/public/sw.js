const CACHE_NAME = 'salescrm-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first strategy with safe Response fallback
self.addEventListener('fetch', (event) => {
  // Always let non-GET and API calls pass straight to network
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Return valid network response
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        // Fallback to cache or a safe blank 404 Response (never return undefined)
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('', { status: 404, statusText: 'Not Found' });
      })
  );
});
