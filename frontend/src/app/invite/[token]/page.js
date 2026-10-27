import React, { Suspense } from 'react';
import AcceptInviteClient from '@/components/AcceptInviteClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ token: 'placeholder' }];
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    }>
      <AcceptInviteClient />
    </Suspense>
  );
}
