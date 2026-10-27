'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn, getUser, hasPermission, canAccessRoute } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import FormsModule from '@/components/admin/modules/FormsModule';
import api from '@/lib/api';

export default function FormsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setMounted(true);
    const checkAuth = () => {
      const u = getUser();
      if (!isLoggedIn() || !u) {
        router.push('/login');
        return;
      }
      if (!canAccessRoute(u, '/forms')) {
        router.push('/leads');
        return;
      }
      setUser(u);
    };

    checkAuth();
    window.addEventListener('user-updated', checkAuth);
    return () => window.removeEventListener('user-updated', checkAuth);
  }, [router]);

  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#f8fafc] text-slate-800 pb-24 md:pb-12">
      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-lg">
                📋
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Form Studio & Intake Builder
              </h1>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Customize dynamic intake fields, required questions, and lead forms tailored for your admission consultancy.
            </p>
          </div>
        </div>

        {/* Form Module */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <FormsModule />
        </div>
      </main>
      <BottomNav active="forms" />
    </div>
  );
}
