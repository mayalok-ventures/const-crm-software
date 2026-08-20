'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#080c14', color: '#94a3b8' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px', borderTopColor: '#f59e0b' }} />
        <p style={{ fontSize: 14, color: '#f59e0b', fontWeight: 600 }}>Loading SuperAdmin Command Center...</p>
      </div>
    </div>
  );
}
