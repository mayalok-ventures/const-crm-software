import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import NotificationPoller from '@/components/NotificationPoller';
import SecurityWarningBanner from '@/components/SecurityWarningBanner';
import Owner2FAModal from '@/components/Owner2FAModal';
import SubscriptionLifecycleBanner from '@/components/SubscriptionLifecycleBanner';
import FollowUpAlertManager from '@/components/FollowUpAlertManager';
import UserSyncManager from '@/components/UserSyncManager';
import { AlarmProvider } from '@/lib/AlarmContext';
import { ContextMenuProvider } from '@/components/contextmenu/ContextMenuContext';
import ContextMenu from '@/components/contextmenu/ContextMenu';
import AppShell from '@/components/AppShell';
import Providers from '@/components/Providers';
import PwaInstallPrompt from '@/components/common/PwaInstallPrompt';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata = {
  title: 'SalesCRM — Enterprise Sales & CRM Platform',
  description: 'Fast, lightweight CRM for sales professionals and agencies. Manage leads, send WhatsApp follow-ups, and close deals on the go.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SalesCRM',
  },
};

export const viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://api.sahyak.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.sahyak.com" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#6366f1" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <Script
          id="pwa-service-worker"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                if (isLocal) {
                  // In local development, unregister any active service worker to prevent HMR / Fast Refresh reload loops
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    for (var i = 0; i < regs.length; i++) {
                      regs[i].unregister();
                      console.log('[PWA] Development mode: Unregistered active ServiceWorker:', regs[i].scope);
                    }
                  });
                } else {
                  // In production environments (Cloudflare Pages, mobile PWA), register Serwist ServiceWorker
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(function(reg) {
                      console.log('[PWA] ServiceWorker registered, scope:', reg.scope);
                      reg.addEventListener('updatefound', function() {
                        var newSW = reg.installing;
                        if (newSW) {
                          newSW.addEventListener('statechange', function() {
                            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                              newSW.postMessage({ type: 'SKIP_WAITING' });
                            }
                          });
                        }
                      });
                    }).catch(function(err) {
                      console.warn('[PWA] ServiceWorker registration failed:', err);
                    });
                  });
                }
              }
            `
          }}
        />
        <Providers>
          <AlarmProvider>
            <ContextMenuProvider>
              <SecurityWarningBanner />
              <Owner2FAModal />
              <SubscriptionLifecycleBanner />
              <UserSyncManager />
              <AppShell>
                {children}
              </AppShell>
              <ContextMenu />
              <NotificationPoller />
              <FollowUpAlertManager />
              <PwaInstallPrompt />
            </ContextMenuProvider>
            <Toaster
              position="top-center"
              containerStyle={{ zIndex: 999999 }}
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                },
              }}
            />
          </AlarmProvider>
        </Providers>
      </body>
    </html>
  );
}
