'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUser, setUser as saveLocalUser } from '@/lib/auth';
import api from '@/lib/api';
import { ShieldAlert, ArrowRight } from 'lucide-react';

export default function SecurityWarningBanner() {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(false);

  const check2FAStatus = async () => {
    const isAuthPage = pathname === '/login' || pathname === '/signup';
    if (isAuthPage) {
      setShowBanner(false);
      return;
    }

    const localUser = getUser();
    if (!localUser) {
      setShowBanner(false);
      return;
    }

    // If local user explicitly has 2FA enabled, hide immediately
    if (localUser.twoFactorEnabled === true) {
      setShowBanner(false);
      return;
    }

    // Authoritative check with backend API to avoid stale localStorage
    try {
      const { data } = await api.get('/auth/me');
      if (data) {
        saveLocalUser(data);
        if (data.twoFactorEnabled === true || data.twoFactorSecret) {
          setShowBanner(false);
          return;
        }
      }
      setShowBanner(true);
    } catch {
      // If API fails, fallback to local state
      setShowBanner(!localUser.twoFactorEnabled);
    }
  };

  useEffect(() => {
    check2FAStatus();

    const handle2FAUpdate = () => check2FAStatus();
    window.addEventListener('2fa-status-changed', handle2FAUpdate);
    return () => window.removeEventListener('2fa-status-changed', handle2FAUpdate);
  }, [pathname]);

  if (!showBanner) return null;

  return (
    <div style={{
      background: 'linear-gradient(90deg, #b45309 0%, #d97706 100%)',
      color: '#ffffff',
      padding: '8px 16px',
      fontSize: 12,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 999,
      boxShadow: '0 2px 8px rgba(180, 83, 9, 0.3)',
      gap: 10,
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ShieldAlert size={16} />
        <span>⚠️ Enhance your account security: 2FA Authenticator is not enabled.</span>
      </div>

      <Link
        href="/profile"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(0,0,0,0.25)',
          padding: '3px 10px',
          borderRadius: 6,
          color: '#ffffff',
          textDecoration: 'none',
          fontSize: 11,
          fontWeight: 700,
          border: '1px solid rgba(255,255,255,0.3)'
        }}
      >
        Setup 2FA Authenticator <ArrowRight size={12} />
      </Link>
    </div>
  );
}
