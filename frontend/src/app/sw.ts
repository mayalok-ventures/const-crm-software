import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, NetworkFirst, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

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
      handler: new NetworkFirst({
        cacheName: 'rsc-flight-payloads',
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// Ensure clean cache boundaries on service worker activation
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((keys: string[]) => {
      return Promise.all(
        keys
          .filter((k) => k.startsWith('rsc-flight-') && k !== 'rsc-flight-payloads')
          .map((k) => caches.delete(k))
      );
    })
  );
});

interface PushNotificationData {
  title?: string;
  body?: string;
  tag?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  vibrate?: number[];
  actions?: Array<{ action: string; title: string }>;
  url?: string;
  followUpId?: string;
  notificationId?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// WEB PUSH NOTIFICATIONS & CRM FOLLOW-UP ALARM HANDLER
// ─────────────────────────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
  let payload: PushNotificationData = {};
  try {
    payload = event.data ? (event.data.json() as PushNotificationData) : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || '⏰ Sahyak CRM Follow-Up Alert';
  const options: NotificationOptions = {
    body: payload.body || 'You have an urgent candidate counseling call due now!',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: payload.tag || 'crm-alarm-engine',
    renotify: payload.renotify !== undefined ? payload.renotify : true,
    requireInteraction: payload.requireInteraction !== undefined ? payload.requireInteraction : true,
    vibrate: payload.vibrate || [300, 150, 300, 150, 450],
    actions: payload.actions || [
      { action: 'open_action', title: 'Action / Note' },
      { action: 'snooze_15', title: 'Snooze 15m' },
    ],
    data: {
      url: payload.url || '/follow-ups',
      followUpId: payload.followUpId || (payload.data?.followUpId as string | undefined),
      notificationId: payload.notificationId || (payload.data?.notificationId as string | undefined),
      ...payload.data,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const eventData = (event.notification.data as { url?: string; notificationId?: string } | undefined) || {};
  let targetUrl = eventData.url || '/follow-ups';

  if (event.action === 'snooze_15') {
    if (targetUrl.includes('?')) {
      targetUrl += '&action=snooze&delayMinutes=15';
    } else {
      targetUrl += '?action=snooze&delayMinutes=15';
    }
  }

  const notifId = eventData.notificationId;
  if (notifId) {
    try {
      fetch(`/api/notifications/${notifId}/clicked`, { method: 'POST', keepalive: true }).catch(() => {});
    } catch (_) {}
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: readonly Client[]) => {
      for (const client of clientList) {
        const windowClient = client as WindowClient;
        if ('focus' in windowClient && windowClient.url.includes(self.location.origin)) {
          windowClient.navigate(targetUrl);
          return windowClient.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
