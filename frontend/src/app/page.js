'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getToken, getUser } from '@/lib/auth';
import { ArrowRight, Lock, UserPlus, Sparkles } from 'lucide-react';

export default function RootGatewayPage() {
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = getToken();
    if (token) {
      const u = getUser();
      setUser(u);
    }
  }, []);

  return (
    <div style={{
      minHeight: '100dvh',
      width: '100%',
      backgroundColor: '#f8fafc',
      backgroundImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(99, 102, 241, 0.09), transparent 75%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      margin: 0,
      boxSizing: 'border-box',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Central Branding & Auth Buttons Card */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: '440px',
        width: '100%',
        animation: 'fadeIn 0.4s ease-out'
      }}>
        {/* Premium Brand Logo */}
        <div style={{
          width: 76,
          height: 76,
          borderRadius: 22,
          background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 30px -4px rgba(79, 70, 229, 0.35), 0 0 0 1px rgba(79, 70, 229, 0.1)',
          marginBottom: 20,
          position: 'relative'
        }}>
          <Image
            src="/logo.png"
            alt="Sahyak CRM Logo"
            width={58}
            height={58}
            style={{ objectFit: 'contain', borderRadius: 16 }}
            priority
          />
        </div>

        {/* Brand Name & Domain in Bold Typography */}
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 2.75rem)',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: '#0f172a',
          margin: '0 0 6px',
          lineHeight: 1.15
        }}>
          Sahyak<span style={{ color: '#4f46e5' }}>.</span>
        </h1>

        <div style={{
          fontSize: '0.95rem',
          fontWeight: 600,
          color: '#64748b',
          letterSpacing: '0.04em',
          marginBottom: 36,
          background: 'rgba(255, 255, 255, 0.8)',
          border: '1px solid #e2e8f0',
          padding: '4px 14px',
          borderRadius: 20,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
        }}>
          crm.sahyak.com
        </div>

        {/* Action Buttons */}
        {mounted && user ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link
              href="/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 48,
                borderRadius: 14,
                background: '#4f46e5',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: 15,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
            >
              <span>Go to Dashboard</span>
              <ArrowRight size={16} />
            </Link>

            <Link
              href="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 44,
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#475569',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
            >
              <span>Switch Account</span>
            </Link>
          </div>
        ) : (
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <Link
              href="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 48,
                borderRadius: 14,
                background: '#4f46e5',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: 15,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
            >
              <Lock size={16} />
              <span>Sign In</span>
            </Link>

            <Link
              href="/signup"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 48,
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                fontWeight: 600,
                fontSize: 15,
                textDecoration: 'none',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
            >
              <Sparkles size={16} color="#4f46e5" />
              <span>Create Account</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
