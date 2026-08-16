// CoreSetu CRM Service Worker — v4
// Network-first with stale-while-revalidate fallback for offline support.

const CACHE_VERSION = 'coresetu-v4';
const STATIC_ASSETS = [
  '/',
  '/dashboard/',
  '/login/',
  '/projects/',
  '/whatsapp/',
  '/templates/',
  '/profile/',
  '/manifest.json',
  '/favicon.ico',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
];

// ── INSTALL: Pre-cache critical assets ──────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache warning:', err);
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

// ── FETCH: Network-first without breaking Next.js router prefetch ───────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never intercept non-GET, APIs, or external 3rd-party services
  if (
    req.method !== 'GET' ||
    req.url.includes('/api/') ||
    req.url.includes('cloudinary.com') ||
    req.url.includes('fonts.googleapis.com') ||
    req.url.includes('fonts.gstatic.com') ||
    req.url.includes('checkout.razorpay.com') ||
    !req.url.startsWith('http')
  ) {
    return; // Pass through to browser natively
  }

  // Pass-through aborted requests or Next.js internal router data
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);

      try {
        const networkResponse = await fetch(req);

        // Cache successful same-origin responses
        if (
          networkResponse &&
          networkResponse.ok &&
          networkResponse.type === 'basic' &&
          networkResponse.status === 200
        ) {
          cache.put(req, networkResponse.clone());
        }

        return networkResponse;
      } catch (networkError) {
        // If aborted by client navigation, do not synthesize 503
        if (networkError.name === 'AbortError') {
          throw networkError;
        }

        // Try exact cache match
        const cached = await cache.match(req);
        if (cached) {
          return cached;
        }

        // For navigation requests when offline, serve cached SPA root
        if (req.mode === 'navigate') {
          const fallback = await cache.match('/') || await cache.match('/dashboard/');
          if (fallback) return fallback;
        }

        // Rethrow network error to allow native browser / router fallback
        throw networkError;
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
