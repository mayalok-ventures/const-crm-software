import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import NotificationPoller from '@/components/NotificationPoller';
import SecurityWarningBanner from '@/components/SecurityWarningBanner';
import SubscriptionLifecycleBanner from '@/components/SubscriptionLifecycleBanner';
import FollowUpAlertManager from '@/components/FollowUpAlertManager';
import UserSyncManager from '@/components/UserSyncManager';

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
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#6366f1" />
        <link rel="manifest" href="/manifest.json" />
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
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
            `
          }}
        />
      </head>
      <body className={inter.className}>
        <SecurityWarningBanner />
        <SubscriptionLifecycleBanner />
        <UserSyncManager />
        {children}
        <NotificationPoller />
        <FollowUpAlertManager />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '14px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            },
          }}
        />
      </body>
    </html>
  );
}
