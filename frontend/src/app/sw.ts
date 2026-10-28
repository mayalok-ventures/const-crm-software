import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, StaleWhileRevalidate, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      matcher: ({ url }: { url: URL }) =>
        url.pathname.endsWith('.txt') &&
        !url.pathname.startsWith('/api') &&
        !url.pathname.includes('/api/'),
      handler: new StaleWhileRevalidate({
        cacheName: 'rsc-flight-payloads',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 12 * 60 * 60, // 12 hours max cache age
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// ─────────────────────────────────────────────────────────────
// WEB PUSH NOTIFICATIONS & CRM FOLLOW-UP ALARM HANDLER
// ─────────────────────────────────────────────────────────────
self.addEventListener('push', (event: any) => {
  let payload: { title?: string; body?: string; url?: string; tag?: string; priority?: string } = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || '⏰ Sahyak CRM Follow-Up Alert';
  const options: any = {
    body: payload.body || 'You have an urgent candidate counseling call due now!',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: payload.tag || 'crm-alarm-engine',
    requireInteraction: true, // Persists until user interacts
    vibrate: [300, 150, 300, 150, 450],
    data: {
      url: payload.url || '/follow-ups',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/follow-ups';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
      for (const client of clientList) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
