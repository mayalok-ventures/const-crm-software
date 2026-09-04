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
  Sparkles,
  ArrowRight,
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
      backgroundColor: '#f8fafc',
      backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.08), transparent)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 12px',
      position: 'relative',
      overflowX: 'hidden',
      color: '#0f172a',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Back to Home Link */}
      <div style={{
        width: '100%',
        maxWidth: '430px',
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'flex-start'
      }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: '#64748b',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
            padding: '6px 12px',
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease'
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Main Light Auth Card */}
      <div style={{
        width: '100%',
        maxWidth: '430px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        padding: '28px 20px',
        boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Brand Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
              marginBottom: 12
            }}>
              {step2FA ? (
                <ShieldCheck size={28} color="#ffffff" />
              ) : (
                <Image
                  src="/logo.png"
                  alt="SalesCRM Logo"
                  width={42}
                  height={42}
                  style={{ objectFit: 'contain' }}
                  priority
                />
              )}
            </div>
          </Link>

          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.3px' }}>
            {step2FA ? 'Authenticator Check' : 'Sign in to SalesCRM'}
          </h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
            {step2FA
              ? 'Enter the 6-digit code from Google Authenticator'
              : 'Universal Sales & Operations Command Center'}
          </p>
        </div>

        {/* Segmented Switcher: Sign In / Create Account */}
        {!step2FA && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: '#f1f5f9',
            padding: 4,
            borderRadius: 10,
            marginBottom: 22,
            border: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              style={{
                padding: '8px 0',
                borderRadius: 7,
                border: 'none',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
              }}
            >
              <Lock size={13} color="#4f46e5" />
              <span>Sign In</span>
            </button>
            <Link
              href="/signup"
              style={{
                padding: '8px 0',
                borderRadius: 7,
                color: '#64748b',
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
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 18,
            fontSize: 13,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1, color: '#ef4444' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: 2, color: '#991b1b' }}>Account Notice</strong>
              {errorMsg}
            </div>
          </div>
        )}

        {!step2FA ? (
          /* Step 1: Standard Password Login */
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
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
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    padding: '10px 14px 10px 38px',
                    fontSize: 13.5,
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#4f46e5';
                    e.target.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
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
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    padding: '10px 42px 10px 38px',
                    fontSize: 13.5,
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#4f46e5';
                    e.target.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: 42,
                borderRadius: 10,
                border: 'none',
                background: '#4f46e5',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
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

            <p style={{ textAlign: 'center', fontSize: 11.5, color: '#64748b', margin: '4px 0 0', lineHeight: 1.4 }}>
              By signing in, you agree to our{' '}
              <Link href="/terms" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Terms of Service</Link>{' '}
              and{' '}
              <Link href="/privacy" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Privacy Policy</Link>.
            </p>

            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Don&apos;t have an account? </span>
              <Link href="/signup" style={{ color: '#4f46e5', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Create Agency Account
              </Link>
            </div>

            <div style={{ textAlign: 'center', marginTop: 10, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                onClick={handleWipeLocalBrowserStorage}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>🧹 Reset / Wipe Local Browser Storage</span>
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: 2FA TOTP Screen */
          <form onSubmit={handleVerify2FA} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!useRecovery ? (
              <div style={{ textAlign: 'center' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
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
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: 10,
                    textAlign: 'center',
                    padding: '12px 0',
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '2px solid #4f46e5',
                    color: '#0f172a',
                    outline: 'none',
                    boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.15)',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: 11.5, color: '#64748b', display: 'block', marginTop: 8 }}>
                  Open Google Authenticator or Authy to retrieve your code
                </span>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
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
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: 4,
                    textAlign: 'center',
                    padding: '10px 0',
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '2px solid #4f46e5',
                    color: '#0f172a',
                    outline: 'none',
                    boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.15)',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: 11.5, color: '#64748b', display: 'block', marginTop: 8 }}>
                  Enter one of your 8-digit emergency backup recovery keys
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!useRecovery && otp.length < 6) || (useRecovery && !recoveryCode.trim())}
              style={{
                width: '100%',
                height: 42,
                borderRadius: 10,
                border: 'none',
                background: '#4f46e5',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)'
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

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { setUseRecovery(!useRecovery); setOtp(''); setRecoveryCode(''); }}
                style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {useRecovery ? 'Use 6-Digit Authenticator App Code' : 'Lost Device? Use Emergency Recovery Code'}
              </button>

              <button
                type="button"
                onClick={handleReset2FAEmergency}
                style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                🔓 Remove / Reset 2FA with Password
              </button>

              <button
                type="button"
                onClick={() => { setStep2FA(false); setOtp(''); setRecoveryCode(''); setUseRecovery(false); }}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  color: '#64748b',
                  padding: '6px 12px',
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
