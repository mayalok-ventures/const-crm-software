'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import {
  GraduationCap,
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { getResolvedRouteParam, isValidToken } from '@/lib/routeParams';

export default function AcceptInviteClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const resolveToken = () => {
    const fromParam = getResolvedRouteParam(params, 'token', 'invite', isValidToken);
    if (fromParam) return fromParam;
    const fromQuery = searchParams?.get('token');
    if (fromQuery && isValidToken(fromQuery) && fromQuery !== 'placeholder') return fromQuery;
    return '';
  };

  const [token, setToken] = useState(resolveToken);

  useEffect(() => {
    const resolved = resolveToken();
    if (resolved && resolved !== token) {
      setToken(resolved);
    }
  }, [params, searchParams]);

  const [verifying, setVerifying] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token || token === 'placeholder') return;

    const verifyToken = async () => {
      setVerifying(true);
      setErrorMsg('');
      try {
        const res = await api.get(`/workspace/invitations/${token}/verify`);
        if (res.data?.success && res.data?.data) {
          setInviteData(res.data.data);
          if (res.data.data.email) {
            setName(res.data.data.email.split('@')[0].replace(/[._]/g, ' '));
          }
        } else {
          setErrorMsg(res.data?.message || 'Invalid invitation link');
        }
      } catch (err) {
        setErrorMsg(
          err.response?.data?.message ||
          'This invitation link is invalid, expired, or has already been accepted.'
        );
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleAccept = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      return toast.error('Please enter your full name');
    }
    if (!password || password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/workspace/invitations/${token}/accept`, {
        name: name.trim(),
        password,
      });

      if (res.data?.token) {
        setAuth(res.data.user, res.data.token);
        toast.success(`Welcome to ${inviteData?.workspaceName || 'the team'}! 🎉`);
        router.push('/dashboard');
      } else {
        toast.success('Invitation accepted successfully! Please sign in.');
        router.push('/login');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#f8fafc',
      backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.1), transparent)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#0f172a',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.4)',
            marginBottom: 12,
          }}>
            <GraduationCap size={26} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Admission CRM
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Team Workspace Onboarding
          </p>
        </div>

        {/* State 1: Verifying */}
        {verifying && (
          <div className="card" style={{
            background: '#ffffff',
            padding: 32,
            borderRadius: 18,
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
            textAlign: 'center',
          }}>
            <div className="spinner" style={{ margin: '0 auto 16px', width: 28, height: 28 }} />
            <p style={{ fontSize: 14, color: '#64748b', margin: 0, fontWeight: 500 }}>
              Verifying team invitation token...
            </p>
          </div>
        )}

        {/* State 2: Invalid or Expired Error */}
        {!verifying && errorMsg && (
          <div className="card" style={{
            background: '#ffffff',
            padding: 28,
            borderRadius: 18,
            border: '1px solid #fee2e2',
            boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.08)',
            textAlign: 'center',
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <AlertCircle size={28} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: '#1e293b' }}>
              Invitation Unavailable
            </h2>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.5, margin: '0 0 20px' }}>
              {errorMsg}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link href="/login" className="btn btn-primary" style={{ height: 40, padding: '0 20px' }}>
                Sign In to Account
              </Link>
            </div>
          </div>
        )}

        {/* State 3: Valid Invitation Form */}
        {!verifying && inviteData && (
          <div className="card" style={{
            background: '#ffffff',
            padding: 28,
            borderRadius: 18,
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 30px -8px rgba(0, 0, 0, 0.07)',
          }}>
            {/* Invite Banner */}
            <div style={{
              padding: '12px 14px',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06), rgba(99, 102, 241, 0.04))',
              border: '1px solid rgba(79, 70, 229, 0.15)',
              borderRadius: 12,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Building2 size={20} color="#4f46e5" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Invited to Workspace
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {inviteData.workspaceName}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>
                  Role: <strong style={{ textTransform: 'capitalize', color: '#334155' }}>{inviteData.role}</strong>
                  {inviteData.team ? ` • ${inviteData.team}` : ''}
                </div>
              </div>
            </div>

            <form onSubmit={handleAccept} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 5 }}>Email Address</label>
                <input
                  type="email"
                  value={inviteData.email}
                  disabled
                  className="input"
                  style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 5 }}>Your Full Name *</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 5 }}>Create Password *</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 5 }}>Confirm Password *</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{
                  height: 44,
                  marginTop: 6,
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  fontWeight: 600,
                  fontSize: 14,
                  gap: 8,
                }}
              >
                {submitting ? (
                  <div className="spinner" style={{ width: 18, height: 18 }} />
                ) : (
                  <>
                    Accept Invitation & Join Team <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: '#4f46e5', fontWeight: 600 }}>
                  Sign in here
                </Link>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
