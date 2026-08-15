'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { syncUser, getToken } from '@/lib/auth';

/**
 * USER SYNC MANAGER
 *
 * Real-time background cache invalidator and subscriber state reconciler.
 * Listens for window focus, tab visibility recovery, and navigation transitions
 * to silently sync live plan status, limits, and grace-period lifecycle from MongoDB.
 */
export default function UserSyncManager() {
  const pathname = usePathname();
  const lastSyncRef = useRef(0);

  const triggerSync = (reason) => {
    const isAuthPage = pathname === '/login' || pathname === '/signup';
    if (isAuthPage) return;

    const token = getToken();
    if (!token) return;

    const now = Date.now();
    // Throttle sync calls to max once every 2.5 seconds
    if (now - lastSyncRef.current < 2500) return;
    lastSyncRef.current = now;

    syncUser();
  };

  useEffect(() => {
    // 1. Initial mount sync
    triggerSync('mount');

    // 2. Window focus listener (when user clicks back into CRM tab)
    const handleFocus = () => triggerSync('window_focus');
    window.addEventListener('focus', handleFocus);

    // 3. Document visibility listener (switching browser tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerSync('tab_visible');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 4. Trigger sync on page navigation
  useEffect(() => {
    triggerSync('route_change');
  }, [pathname]);

  return null;
}
