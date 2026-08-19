'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LeadDetailPage from '@/components/LeadsDetailClient';
import CampaignDetailsPage from '@/components/CampaignDetailsClient';
import ShareDashboardPage from '@/components/ShareDashboardClient';

export default function NotFound() {
  const [resolvedComponent, setResolvedComponent] = useState(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const path = window.location.pathname;

    if (path.startsWith('/leads/') && path.split('/')[2]) {
      setResolvedComponent('lead');
    } else if (path.startsWith('/campaigns/') && path.split('/')[2]) {
      setResolvedComponent('campaign');
    } else if (path.startsWith('/share/') && path.split('/')[2]) {
      setResolvedComponent('share');
    }
  }, []);

  if (!isClient) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (resolvedComponent === 'lead') {
    return <LeadDetailPage />;
  }

  if (resolvedComponent === 'campaign') {
    return <CampaignDetailsPage />;
  }

  if (resolvedComponent === 'share') {
    return <ShareDashboardPage />;
  }

  return (
    <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 24, textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: '32px 24px' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' }}>Page Not Found</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
          The link you visited does not exist or has been moved.
        </p>
        <Link href="/dashboard" className="btn btn-primary btn-full" style={{ justifyContent: 'center', height: 42, borderRadius: 10 }}>
          Return to Dashboard 🏠
        </Link>
      </div>
    </div>
  );
}
