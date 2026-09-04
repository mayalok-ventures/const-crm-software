'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, isOwner } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import ProfileModule from '@/components/admin/modules/ProfileModule';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'superadmin') {
      router.replace('/superadmin-dashboard');
      return;
    }
    setCurrentUser(user);
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="app-shell pb-mobile-nav">
      <div className="page-container max-w-5xl mx-auto w-full px-3 sm:px-6 lg:px-8 pb-8">
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/dashboard" className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200 bg-white shadow-sm">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="page-title text-slate-900 font-bold" style={{ fontSize: 'clamp(18px, 4vw, 22px)', margin: 0 }}>
                {isOwner(currentUser)
                  ? 'Organization & Profile'
                  : 'My Profile'}
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {isOwner(currentUser)
                  ? 'Manage organization identity and administrator preferences'
                  : 'Manage your personal account credentials, work information and preferences'}
              </p>
            </div>
          </div>
        </div>

        <ProfileModule
          currentUser={currentUser}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
            if (typeof window !== 'undefined') {
              try {
                const stored = localStorage.getItem('user');
                if (stored) {
                  const parsed = JSON.parse(stored);
                  localStorage.setItem('user', JSON.stringify({ ...parsed, ...updatedUser }));
                }
              } catch (e) {}
            }
          }}
        />
      </div>
      <BottomNav active="profile" />
    </div>
  );
}
