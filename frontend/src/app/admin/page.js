'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';

export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (user?.role === 'superadmin' || user?.isAdmin) {
      router.replace('/superadmin-dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#090d16', color: '#94a3b8' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontSize: 14 }}>Redirecting to Unified SuperAdmin Command Center...</p>
      </div>
    </div>
  );
}
