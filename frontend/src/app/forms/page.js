'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import FormsModule from '@/components/admin/modules/FormsModule';
import { getUser } from '@/lib/auth';
import { Sliders, Sparkles, Shield, ArrowRight, LayoutTemplate } from 'lucide-react';

export default function FormCenterPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setCurrentUser(user);
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <div className="app-container" style={{ paddingBottom: 80 }}>
      {/* Main Content Area */}
      <main className="main-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        {/* Top Header Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
          borderRadius: 20,
          padding: '24px 28px',
          color: '#ffffff',
          marginBottom: 24,
          boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                Form Center • Dynamic Schema
              </span>
              <span style={{
                background: 'rgba(251, 191, 36, 0.25)',
                color: '#fef08a',
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700
              }}>
                {currentUser?.industryType || 'Universal'} CRM
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Custom Forms & Pipeline Engine
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 600 }}>
              Create, reorder, and configure dynamic fields for your Prospect Lead Form and Product Catalog. Changes apply instantly across your team and web forms.
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '10px 16px',
            borderRadius: 14,
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}>
            <Sparkles size={18} style={{ color: '#fbbf24' }} />
            <div style={{ fontSize: 12 }}>
              <strong style={{ display: 'block', color: '#fff' }}>Full Control</strong>
              <span style={{ opacity: 0.8, fontSize: 11 }}>Agency & Solo Customization</span>
            </div>
          </div>
        </div>

        {/* Dynamic Form Builder Component */}
        <div style={{
          background: '#ffffff',
          borderRadius: 20,
          border: '1px solid var(--border, #e2e8f0)',
          padding: '20px 24px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
        }}>
          <FormsModule theme="light" />
        </div>
      </main>

      {/* Global Navigation (Sidebar on Desktop, BottomNav on Mobile) */}
      <BottomNav active="forms" />
    </div>
  );
}
