'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { ShieldAlert, ArrowRight, X } from 'lucide-react';

export default function SecurityWarningBanner() {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(false);

  const check2FAStatus = () => {
    const isAuthPage = pathname === '/login' || pathname === '/signup';
    if (isAuthPage) {
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

    // Hide immediately if user has 2FA enabled
    if (localUser.twoFactorEnabled === true || localUser.twoFactorSecret) {
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

  if (!showBanner) return null;

  return (
    <aside aria-label="Security Alert" className="system-top-banner bg-amber-500/10 border-b border-amber-500/25 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2 text-amber-900 font-medium min-w-0">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="truncate">
            <strong className="font-bold text-amber-950">Enhance your account security:</strong> 2FA Authenticator is not enabled.
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <Link
            href="/admin?tab=security"
            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs transition-colors shadow-sm"
          >
            <span>Setup 2FA</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-amber-700 hover:text-amber-950 hover:bg-amber-500/20 rounded-md transition-colors"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
