'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getUser } from '@/lib/auth';
import { Home, LogIn, LayoutDashboard } from 'lucide-react';

const LeadDetailPage = dynamic(() => import('@/components/LeadsDetailClient'), { ssr: false });
const CampaignDetailsPage = dynamic(() => import('@/components/CampaignDetailsClient'), { ssr: false });
const ShareDashboardPage = dynamic(() => import('@/components/ShareDashboardClient'), { ssr: false });
const CollegeDetailClient = dynamic(() => import('@/components/CollegeDetailClient'), { ssr: false });
const AcceptInviteClient = dynamic(() => import('@/components/AcceptInviteClient'), { ssr: false });
const DashboardPage = dynamic(() => import('@/app/dashboard/page'), { ssr: false });

export default function NotFound() {
  const [resolvedComponent, setResolvedComponent] = useState(null);
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const rawPath = typeof window !== 'undefined' ? window.location.pathname || '' : '';
    const path = rawPath.replace(/\/+$/, '') || '/';
    const loggedInUser = getUser();
    setUser(loggedInUser);

    // If user attempted to reach /dashboard directly or trailing slash /dashboard/
    if (path === '/dashboard') {
      if (!loggedInUser) {
        window.location.replace('/login');
        return;
      }
      setResolvedComponent('dashboard');
      return;
    }

    // Dynamic client routes
    if (path.startsWith('/leads/') && path.split('/')[2]) {
      setResolvedComponent('lead');
    } else if (path.startsWith('/campaigns/') && path.split('/')[2]) {
      setResolvedComponent('campaign');
    } else if (path.startsWith('/share/') && path.split('/')[2]) {
      setResolvedComponent('share');
    } else if ((path.startsWith('/catalogue/') || path.startsWith('/colleges/')) && path.split('/')[2]) {
      setResolvedComponent('college');
    } else if (path.startsWith('/invite/') && path.split('/')[2]) {
      setResolvedComponent('invite');
    }
  }, []);

  if (resolvedComponent === 'dashboard') {
    return <DashboardPage />;
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

  if (resolvedComponent === 'college') {
    return <CollegeDetailClient />;
  }

  if (resolvedComponent === 'invite') {
    return <AcceptInviteClient />;
  }

  const handleReturnToDashboard = () => {
    window.location.href = '/dashboard';
  };

  const handleGoToLogin = () => {
    window.location.href = '/login';
  };

  const handleGoToHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 24, textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', padding: '36px 24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🧭</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' }}>Page Not Found</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: 1.5 }}>
          The page you requested does not exist or may have been moved.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mounted && user ? (
            <>
              <button
                type="button"
                onClick={handleReturnToDashboard}
                className="btn btn-primary btn-full"
                style={{ justifyContent: 'center', height: 44, borderRadius: 10, fontSize: 14, fontWeight: 700, gap: 8, cursor: 'pointer' }}
              >
                <LayoutDashboard size={18} />
                Return to Dashboard
              </button>

              <button
                type="button"
                onClick={handleGoToLogin}
                className="btn btn-ghost btn-full"
                style={{ justifyContent: 'center', height: 40, borderRadius: 10, fontSize: 13, gap: 6, cursor: 'pointer' }}
              >
                <LogIn size={16} />
                Sign Out / Switch Account
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoToLogin}
                className="btn btn-primary btn-full"
                style={{ justifyContent: 'center', height: 44, borderRadius: 10, fontSize: 14, fontWeight: 700, gap: 8, cursor: 'pointer' }}
              >
                <LogIn size={18} />
                Sign In to Your Account
              </button>

              <button
                type="button"
                onClick={handleGoToHome}
                className="btn btn-ghost btn-full"
                style={{ justifyContent: 'center', height: 40, borderRadius: 10, fontSize: 13, gap: 6, cursor: 'pointer' }}
              >
                <Home size={16} />
                Return to Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
