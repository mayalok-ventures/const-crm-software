'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { AlertTriangle, Clock, Lock, ArrowRight } from 'lucide-react';

export default function SubscriptionLifecycleBanner() {
  const pathname = usePathname();
  const [lifecycle, setLifecycle] = useState(null);
  const [user, setUser] = useState(null);

  const checkStatus = () => {
    const isAuthPage = pathname === '/login' || pathname === '/signup';
    if (isAuthPage) {
      setLifecycle(null);
      setUser(null);
      return;
    }

    const localUser = getUser();
    setUser(localUser);
    if (localUser?.subscriptionLifecycle) {
      setLifecycle(localUser.subscriptionLifecycle);
    } else {
      setLifecycle(null);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleUpdate = () => checkStatus();
    window.addEventListener('user-updated', handleUpdate);
    return () => window.removeEventListener('user-updated', handleUpdate);
  }, [pathname]);

  if (!lifecycle || lifecycle.state === 'ACTIVE' || user?.role === 'superadmin') {
    return null;
  }

  // 1. LOCKED STATE (CRITICAL LOCKOUT)
  if (lifecycle.state === 'LOCKED') {
    return (
      <aside aria-label="Subscription Lock Alert" className="system-top-banner bg-rose-900 text-white border-b border-rose-800">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 font-medium min-w-0">
            <Lock className="w-4 h-4 text-rose-300 flex-shrink-0" />
            <span>
              {lifecycle.isSubAgent ? (
                <>🔒 <strong>ORGANIZATION SUBSCRIPTION LOCKED:</strong> Your organization’s plan has expired. Please contact your Organization Owner ({lifecycle.companyName || 'Owner'}).</>
              ) : (
                <>🔒 <strong>ACCOUNT LOCKED:</strong> Your subscription grace period has ended. Write access is disabled until renewal.</>
              )}
            </span>
          </div>

          {!lifecycle.isSubAgent && (
            <Link
              href="/plans"
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors shadow-sm ml-auto flex-shrink-0"
            >
              <span>Renew Plan Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </aside>
    );
  }

  // 2. GRACE PERIOD STATE (URGENT WARNING)
  if (lifecycle.state === 'GRACE_PERIOD') {
    return (
      <aside aria-label="Grace Period Alert" className="system-top-banner bg-amber-600 text-white border-b border-amber-700">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 font-medium min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-200 flex-shrink-0" />
            <span>
              🚨 <strong>GRACE PERIOD ACTIVE:</strong> Plan expired! System will lock in{' '}
              <strong>{lifecycle.graceDaysLeft ?? 1} day(s)</strong>.
            </span>
          </div>

          {!lifecycle.isSubAgent && (
            <Link
              href="/plans"
              className="inline-flex items-center gap-1.5 bg-slate-900/40 hover:bg-slate-900/60 border border-white/30 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors shadow-sm ml-auto flex-shrink-0"
            >
              <span>Renew Plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </aside>
    );
  }

  // 3. EXPIRING SOON STATE (7-DAY REMINDER)
  if (lifecycle.state === 'EXPIRING_SOON') {
    return (
      <aside aria-label="Subscription Expiring Alert" className="system-top-banner bg-amber-500/10 border-b border-amber-500/25 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 text-amber-900 font-medium min-w-0">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              ⚠️ Your plan expires in <strong>{lifecycle.daysLeft} day(s)</strong>. Renew now to maintain uninterrupted access.
            </span>
          </div>

          {!lifecycle.isSubAgent && (
            <Link
              href="/plans"
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs transition-colors shadow-sm ml-auto flex-shrink-0"
            >
              <span>Renew Subscription</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </aside>
    );
  }

  return null;
}
