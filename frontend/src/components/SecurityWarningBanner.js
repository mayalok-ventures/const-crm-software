'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { ShieldAlert, AlertTriangle, ArrowRight, X } from 'lucide-react';

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
      aria-label="Security Warning Alert"
      className="system-top-banner text-white border-b border-amber-500/40 shadow-lg shadow-orange-950/20 transition-all"
      style={{
        background: 'linear-gradient(90deg, #7c2d12 0%, #9a3412 50%, #7c2d12 100%)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          {/* Security Alert Badge */}
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-black/40 border border-amber-400/40 text-amber-200 flex items-center gap-1 shadow-inner flex-shrink-0">
            <AlertTriangle className="w-3 h-3 text-amber-300 animate-pulse" />
            <span>SECURITY WARNING</span>
          </span>

          <span className="text-amber-50 text-xs">
            <strong className="font-bold text-white">2FA Authenticator is not enabled.</strong>{' '}
            <span className="text-amber-100/90 hidden sm:inline">
              Protect your account & organization from unauthorized access.
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <Link
            href="/admin?tab=security"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-amber-50 text-amber-950 font-bold px-3 py-1 rounded-lg text-xs transition-all shadow-md active:scale-95"
          >
            <span>Enable 2FA Now</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-900" />
          </Link>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-amber-200/80 hover:text-white hover:bg-black/20 rounded-md transition-colors"
            title="Dismiss alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
