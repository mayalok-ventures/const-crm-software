'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  AlertTriangle,
  ArrowLeft,
  Lock,
  Mail,
  Smartphone,
  Sparkles,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  KeyRound
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [step2FA, setStep2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorMethod, setTwoFactorMethod] = useState('');
  const [maskedTarget, setMaskedTarget] = useState('');
  const [otp, setOtp] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  const [errorMsg, setErrorMsg] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'suspended') {
        return params.get('reason') || 'Your account has been suspended for violating platform policies.';
      }
    }
    return '';
  });

  const handleWipeLocalBrowserStorage = async () => {
    if (!confirm('This will wipe all local CRM cookies, localStorage, and cached data from this browser. Proceed?')) return;
    try {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      if (window.indexedDB && window.indexedDB.databases) {
        const dbs = await window.indexedDB.databases();
        dbs.forEach((db) => {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        });
      }
      toast.success('All local browser storage wiped clean! 🧹');
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    } catch (e) {
      console.error('Storage clear error:', e);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier || !password) return toast.error('Please fill all fields');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { identifier, password });

      if (data.requires2FA) {
        setTempToken(data.tempToken);
        setTwoFactorMethod(data.method);
        setMaskedTarget(data.maskedTarget || '');
        setStep2FA(true);
        if (data.method === 'totp') {
          toast.success('Please enter the 6-digit code from your authenticator app 🔐');
        } else {
          toast.success(`Verification code sent via ${data.method === 'whatsapp' ? 'WhatsApp 📲' : 'Email 📧'}`);
        }
        return;
      }

      setAuth(data, data.token);
      toast.success(`Welcome back, ${data.name}! 👋`);
      if (data.role === 'superadmin') {
        router.replace('/superadmin-dashboard');
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    if (!useRecovery && !otp.trim()) return toast.error('Please enter the 6-digit verification code');
    if (useRecovery && !recoveryCode.trim()) return toast.error('Please enter your emergency backup code');

    setLoading(true);
    try {
      const payload = { tempToken };
      if (useRecovery) {
        payload.recoveryCode = recoveryCode.trim().toUpperCase();
      } else {
        payload.otp = otp.replace(/\D/g, '').trim();
      }

      const { data } = await api.post('/auth/verify-2fa', payload);
      setAuth(data, data.token);
      toast.success(`Security check passed! Welcome, ${data.name}! 🚀`);
      if (data.role === 'superadmin') {
        router.replace('/superadmin-dashboard');
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleReset2FAEmergency = async () => {
    if (!confirm('Are you sure you want to remove 2FA from your account? You will be signed in directly with your password.')) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-2fa-emergency', {
        identifier,
        password,
      });
      setAuth(data, data.token);
      toast.success('2FA successfully removed! Welcome back! 🎉');
      if (data.role === 'superadmin') {
        router.replace('/superadmin-dashboard');
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#090d16',
      backgroundImage: 'radial-gradient(circle at 50% 10%, rgba(79, 70, 229, 0.15) 0%, rgba(15, 23, 42, 0) 60%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
      color: '#f8fafc',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Background Ambient Orbs */}
      <div style={{
        position: 'absolute',
        top: '-120px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '560px',
        height: '380px',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(147, 51, 234, 0.08) 50%, transparent 70%)',
        filter: 'blur(70px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Back to Home Link */}
      <div style={{
        position: 'absolute',
        top: 24,
        left: 24,
        zIndex: 10
      }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: '#94a3b8',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
            padding: '6px 12px',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease'
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Main Glassmorphic Auth Card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '36px 30px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(79, 70, 229, 0.15)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Brand Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{
              width: 58,
              height: 58,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(79, 70, 229, 0.45)',
              marginBottom: 12
            }}>
              {step2FA ? (
                <ShieldCheck size={30} color="#ffffff" />
              ) : (
                <Image
                  src="/logo.png"
                  alt="SalesCRM Logo"
                  width={46}
                  height={46}
                  style={{ objectFit: 'contain' }}
                  priority
                />
              )}
            </div>
          </Link>

          <h1 style={{ fontSize: 23, fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.3px' }}>
            {step2FA ? 'Authenticator Check' : 'Sign in to SalesCRM'}
          </h1>
          <p style={{ color: '#94a3b8', marginTop: 6, fontSize: 13 }}>
            {step2FA
              ? 'Enter the 6-digit code from Google Authenticator'
              : 'Universal Sales & Operations Command Center'}
          </p>
        </div>

        {/* Toggle Tabs: Sign In / Create Account */}
        {!step2FA && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: 4,
            borderRadius: 12,
            marginBottom: 24,
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <button
              type="button"
              style={{
                padding: '8px 0',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
              }}
            >
              <Lock size={13} />
              <span>Sign In</span>
            </button>
            <Link
              href="/signup"
              style={{
                padding: '8px 0',
                borderRadius: 8,
                color: '#94a3b8',
                fontWeight: 500,
                fontSize: 13,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'color 0.2s'
              }}
            >
              <Sparkles size={13} />
              <span>Create Account</span>
            </Link>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 20,
            fontSize: 13,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1, color: '#ef4444' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: 2, color: '#f87171' }}>Account Suspended</strong>
              {errorMsg}
            </div>
          </div>
        )}

        {!step2FA ? (
          /* Step 1: Standard Password Login */
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Email or Phone Number
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="name@company.com or phone"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 12,
                    padding: '11px 14px 11px 38px',
                    fontSize: 14,
                    color: '#ffffff',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#6366f1';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <Mail size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 12,
                    padding: '11px 44px 11px 38px',
                    fontSize: 14,
                    color: '#ffffff',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#6366f1';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <Lock size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#ffffff',
                fontSize: 14.5,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.5)',
                transition: 'all 0.2s ease',
                marginTop: 4
              }}
            >
              {loading ? (
                <div className="spinner" style={{ width: 18, height: 18, borderTopColor: '#ffffff' }} />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

            <p style={{ textAlign: 'center', fontSize: 11.5, color: '#64748b', margin: '4px 0 0', lineHeight: 1.5 }}>
              By signing in, you agree to our{' '}
              <Link href="/terms" style={{ color: '#818cf8', textDecoration: 'underline' }}>Terms of Service</Link>{' '}
              and{' '}
              <Link href="/privacy" style={{ color: '#818cf8', textDecoration: 'underline' }}>Privacy Policy</Link>.
            </p>

            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Don&apos;t have an account? </span>
              <Link href="/signup" style={{ color: '#818cf8', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Create Agency Account →
              </Link>
            </div>

            <div style={{ textAlign: 'center', marginTop: 12, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                type="button"
                onClick={handleWipeLocalBrowserStorage}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => (e.target.style.color = '#94a3b8')}
                onMouseLeave={(e) => (e.target.style.color = '#64748b')}
              >
                <span>🧹 Reset / Wipe Local Browser Storage</span>
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: 2FA TOTP Screen */
          <form onSubmit={handleVerify2FA} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {!useRecovery ? (
              <div style={{ textAlign: 'center' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 10 }}>
                  6-Digit Authenticator Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  style={{
                    width: '100%',
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: 12,
                    textAlign: 'center',
                    padding: '14px 0',
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '2px solid #6366f1',
                    color: '#ffffff',
                    outline: 'none',
                    boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.25)',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: 11.5, color: '#94a3b8', display: 'block', marginTop: 10 }}>
                  Open Google Authenticator or Authy to retrieve your 6-digit code
                </span>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 10 }}>
                  Emergency Backup Recovery Code
                </label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="XXXX-XXXX"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  autoFocus
                  style={{
                    width: '100%',
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: 4,
                    textAlign: 'center',
                    padding: '12px 0',
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '2px solid #6366f1',
                    color: '#ffffff',
                    outline: 'none',
                    boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.25)',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: 11.5, color: '#94a3b8', display: 'block', marginTop: 10 }}>
                  Enter one of your 8-digit emergency backup recovery keys
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!useRecovery && otp.length < 6) || (useRecovery && !recoveryCode.trim())}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.5)'
              }}
            >
              {loading ? (
                <div className="spinner" style={{ width: 18, height: 18, borderTopColor: '#ffffff' }} />
              ) : (
                <>
                  <KeyRound size={15} />
                  <span>{useRecovery ? 'Verify Recovery Code' : 'Verify Code & Sign In'}</span>
                </>
              )}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => { setUseRecovery(!useRecovery); setOtp(''); setRecoveryCode(''); }}
                style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {useRecovery ? 'Use 6-Digit Authenticator App Code' : 'Lost Device? Use Emergency Recovery Code'}
              </button>

              <button
                type="button"
                onClick={handleReset2FAEmergency}
                style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                🔓 Remove / Reset 2FA with Password
              </button>

              <button
                type="button"
                onClick={() => { setStep2FA(false); setOtp(''); setRecoveryCode(''); setUseRecovery(false); }}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: '#94a3b8',
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <ArrowLeft size={14} /> Back to login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
