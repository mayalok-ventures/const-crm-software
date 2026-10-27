'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getUser, isOwner } from '@/lib/auth';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';

export default function SecurityWarningBanner() {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(false);

  const check2FAStatus = () => {
    const isExcludedPage =
      pathname === '/' ||
      pathname === '/login' ||
      pathname === '/signup' ||
      pathname === '/terms' ||
      pathname === '/privacy' ||
      pathname === '/data-deletion';
    if (isExcludedPage) {
      setShowBanner(false);
      return;
    }

    if (typeof window !== 'undefined') {
      const isDismissed = sessionStorage.getItem('dismissed_2fa_banner');
      if (isDismissed === 'true') {
        setShowBanner(false);
        return;
      }
    }

    const localUser = getUser();
    if (!localUser) {
      setShowBanner(false);
      return;
    }

    // Security Invariant: The 2FA alert must appear ONLY for OWNER users whose 2FA is disabled
    // Never show for: AGENT, MANAGER, EMPLOYEE, SUPER_ADMIN, or when 2FA is enabled
    if (!isOwner(localUser) || localUser.twoFactorEnabled === true) {
      setShowBanner(false);
      return;
    }

    setShowBanner(true);
  };

  useEffect(() => {
    check2FAStatus();

    const handleUpdate = () => check2FAStatus();
    window.addEventListener('2fa-status-changed', handleUpdate);
    window.addEventListener('user-updated', handleUpdate);
    return () => {
      window.removeEventListener('2fa-status-changed', handleUpdate);
      window.removeEventListener('user-updated', handleUpdate);
    };
  }, [pathname]);

  const handleDismiss = () => {
    setShowBanner(false);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('dismissed_2fa_banner', 'true');
      } catch (e) {}
    }
  };

  const handleOpenSetup = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-2fa-setup'));
    }
  };

  if (!showBanner) return null;

  return (
    <aside
      aria-label="Two-Factor Authentication Security Alert"
      className="system-top-banner transition-all"
      style={{
        background: '#fffbeb',
        borderBottom: '1px solid #fde68a',
        color: '#92400e',
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1 rounded-md bg-amber-100 text-amber-700 flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </span>

          <span className="text-[11px] sm:text-xs truncate">
            <strong className="font-semibold text-amber-950">Protect account with 2FA</strong>
            <span className="text-amber-800/80 hidden md:inline ml-1.5">
              Enable authenticator verification to secure candidate data.
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-auto">
          <button
            type="button"
            onClick={handleOpenSetup}
            className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-medium px-2.5 py-1 rounded-md text-[11px] sm:text-xs transition-colors shadow-xs active:scale-95 cursor-pointer"
          >
            <span>Enable</span>
            <ArrowRight className="w-3 h-3 text-white" />
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-amber-700 hover:text-amber-950 hover:bg-amber-100 rounded-md transition-colors"
            title="Dismiss alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
