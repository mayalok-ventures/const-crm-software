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
    <aside
      aria-label="Security Alert"
      className="system-top-banner bg-[#0b1120] text-white border-b border-slate-800 shadow-md transition-all"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="truncate text-slate-200">
            <strong className="font-bold text-amber-400">Enhance your account security:</strong>{' '}
            <span className="text-slate-300">2FA Authenticator is not enabled.</span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <Link
            href="/admin?tab=security"
            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs transition-all shadow-sm shadow-amber-500/20"
          >
            <span>Setup 2FA</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
