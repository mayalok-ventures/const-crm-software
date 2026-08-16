// CoreSetu CRM Service Worker — v3
// Network-first with stale-while-revalidate fallback. Guaranteed valid Response.

const CACHE_VERSION = 'coresetu-v3';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/login',
  '/manifest.json',
  '/favicon.ico',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
];

// ── INSTALL: Pre-cache critical assets ──────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache error (some assets may not exist yet):', err);
      });
    })
  );
});

// ── ACTIVATE: Clear all old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => {
          console.log(`[SW] Deleting old cache: ${k}`);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network-first with guaranteed Response fallback ───────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never intercept:
  // 1. Non-GET requests (POST, PUT, DELETE etc.)
  // 2. Backend API calls
  // 3. External CDN (Cloudinary, Google Fonts, etc.)
  // 4. Chrome extensions or non-http schemes
  if (
    req.method !== 'GET' ||
    req.url.includes('/api/') ||
    req.url.includes('cloudinary.com') ||
    req.url.includes('fonts.googleapis.com') ||
    req.url.includes('fonts.gstatic.com') ||
    req.url.includes('checkout.razorpay.com') ||
    !req.url.startsWith('http')
  ) {
    return; // Let browser handle it natively
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);

      try {
        // Network-first: always try fresh network response
        const networkResponse = await fetch(req);

        // Only cache successful same-origin responses
        if (
          networkResponse.ok &&
          networkResponse.type === 'basic' &&
          networkResponse.status === 200
        ) {
          cache.put(req, networkResponse.clone());
        }

        return networkResponse;
      } catch (networkError) {
        // Network failed — serve from cache if available
        const cached = await cache.match(req, { ignoreSearch: false });
        if (cached) {
          console.log(`[SW] Serving from cache: ${req.url}`);
          return cached;
        }

        // For navigation requests, return cached /index.html for SPA routing
        if (req.mode === 'navigate') {
          const indexCache = await cache.match('/');
          if (indexCache) return indexCache;
        }

        // Last resort: return a valid 503 Response (never undefined)
        return new Response(
          JSON.stringify({ error: 'You appear to be offline. Please check your connection.' }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    })()
  );
});

// ── BACKGROUND SYNC (future): handle offline queued form submissions ─────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
