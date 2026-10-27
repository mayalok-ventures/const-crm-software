import React, { Suspense } from 'react';
import AcceptInviteClient from '@/components/AcceptInviteClient';

export default function InviteRootPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: 28, height: 28 }} />
          <p style={{ fontSize: 14, color: '#64748b' }}>Loading invitation...</p>
        </div>
      </div>
    }>
      <AcceptInviteClient />
    </Suspense>
  );
}
