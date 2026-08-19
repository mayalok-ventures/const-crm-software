'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUser, setUser as saveLocalUser } from '@/lib/auth';
import api from '@/lib/api';
import { AlertTriangle, Clock, Lock, ArrowRight, Sparkles } from 'lucide-react';

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

  if (!lifecycle || lifecycle.state === 'ACTIVE' || user?.isAdmin || user?.role === 'superadmin') {
    return null;
  }

  // 1. LOCKED STATE (CRITICAL LOCKOUT)
  if (lifecycle.state === 'LOCKED') {
    return (
      <div style={{
        background: 'linear-gradient(90deg, #7f1d1d 0%, #991b1b 100%)',
        color: '#ffffff',
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 998,
        boxShadow: '0 4px 12px rgba(127, 29, 29, 0.4)',
        gap: 12,
        flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={18} color="#fca5a5" />
          <span>
            {lifecycle.isSubAgent ? (
              <>🔒 <strong>ORGANIZATION SUBSCRIPTION LOCKED:</strong> Your organization’s plan has expired. Please ask your Organization Owner ({lifecycle.companyName || 'Owner'}) to renew.</>
            ) : (
              <>🔒 <strong>ACCOUNT LOCKED:</strong> Your subscription grace period has ended. Write access is disabled until renewal.</>
            )}
          </span>
        </div>

        {!lifecycle.isSubAgent && (
          <Link
            href="/plans"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#ef4444',
              padding: '4px 14px',
              borderRadius: 8,
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}
          >
            Renew Plan Now <ArrowRight size={13} />
          </Link>
        )}
      </div>
    );
  }

  // 2. GRACE PERIOD STATE (URGENT WARNING)
  if (lifecycle.state === 'GRACE_PERIOD') {
    return (
      <div style={{
        background: 'linear-gradient(90deg, #c2410c 0%, #ea580c 100%)',
        color: '#ffffff',
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 998,
        boxShadow: '0 4px 12px rgba(194, 65, 12, 0.35)',
        gap: 12,
        flexWrap: 'wrap',
        animation: 'pulse 2s infinite ease-in-out',
        borderBottom: '1px solid rgba(255,255,255,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={18} color="#fed7aa" />
          <span>
            🚨 <strong>GRACE PERIOD ACTIVE:</strong> Plan expired! System will lock in{' '}
            <strong>{lifecycle.graceDaysLeft ?? 1} day(s)</strong>. Renew immediately to prevent disruption.
          </span>
        </div>

        {!lifecycle.isSubAgent && (
          <Link
            href="/plans"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(0,0,0,0.3)',
              padding: '4px 14px',
              borderRadius: 8,
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.4)'
            }}
          >
            Renew Plan <ArrowRight size={13} />
          </Link>
        )}
      </div>
    );
  }

  // 3. EXPIRING SOON STATE (7-DAY REMINDER)
  if (lifecycle.state === 'EXPIRING_SOON') {
    return (
      <div style={{
        background: 'linear-gradient(90deg, #d97706 0%, #f59e0b 100%)',
        color: '#ffffff',
        padding: '8px 16px',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 998,
        boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)',
        gap: 10,
        flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={16} color="#fef3c7" />
          <span>
            ⚠️ Your plan expires in <strong>{lifecycle.daysLeft} day(s)</strong>. Renew now to maintain uninterrupted access.
          </span>
        </div>

        {!lifecycle.isSubAgent && (
          <Link
            href="/plans"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(0,0,0,0.2)',
              padding: '3px 10px',
              borderRadius: 6,
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: 11,
              fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.3)'
            }}
          >
            Renew Subscription <ArrowRight size={12} />
          </Link>
        )}
      </div>
    );
  }

  return null;
}
