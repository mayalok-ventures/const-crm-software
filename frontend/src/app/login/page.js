'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { Eye, EyeOff, ShieldCheck, Zap, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

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
  const [resending, setResending] = useState(false);

  const [errorMsg, setErrorMsg] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'suspended') {
        return params.get('reason') || 'Your account has been suspended for violating platform policies.';
      }
    }
    return '';
  });

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
        toast.success(`Verification code sent via ${data.method === 'whatsapp' ? 'WhatsApp 📲' : 'Email 📧'}`);
        return;
      }

      setAuth(data, data.token);
      toast.success(`Welcome back, ${data.name}! 👋`);
      if (data.role === 'superadmin' || data.isAdmin) {
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
    if (!otp.trim()) return toast.error('Please enter the 6-digit verification code');

    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-2fa', {
        tempToken,
        otp: otp.trim(),
      });
      setAuth(data, data.token);
      toast.success(`Security check passed! Welcome, ${data.name}! 🚀`);
      if (data.role === 'superadmin' || data.isAdmin) {
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

  const handleResend2FA = async () => {
    if (resending) return;
    setResending(true);
    try {
      await api.post('/auth/resend-2fa', { tempToken });
      toast.success('New verification code sent! 📲');
    } catch (err) {
      toast.error('Failed to resend code. Please try logging in again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            {step2FA ? (
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(79, 70, 229, 0.35)'
              }}>
                <ShieldCheck size={32} color="white" />
              </div>
            ) : (
              <Image
                src="/logo.png"
                alt="SalesCRM Logo"
                width={64}
                height={64}
                style={{ borderRadius: 18, objectFit: 'contain', boxShadow: '0 8px 32px rgba(79, 70, 229, 0.35)' }}
                priority
              />
            )}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
            {step2FA ? 'Authenticator Verification' : 'SalesCRM'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>
            {step2FA
              ? 'Enter the 6-digit code from Google Authenticator or Authy app'
              : 'Universal Sales & Operations Command Center'}
          </p>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--red)', borderRadius: 12, padding: '12px 14px', marginBottom: 20, fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start', textAlign: 'left' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong style={{ display: 'block', marginBottom: 2 }}>Account Suspended</strong>
              {errorMsg}
            </div>
          </div>
        )}

        {!step2FA ? (
          /* Step 1: Standard Password Login */
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Email or Phone</label>
              <input
                className="input"
                type="text"
                placeholder="Enter email or phone number"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                inputMode="email"
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: 48 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-full" style={{ marginTop: 8, height: 44, borderRadius: 12 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Don't have an account? </span>
              <Link href="/signup" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Create Agency Account
              </Link>
            </div>
          </form>
        ) : (
          /* Step 2: 2FA TOTP Screen */
          <form onSubmit={handleVerify2FA} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                autoFocus
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: 10,
                  textAlign: 'center',
                  padding: '14px 0',
                  borderRadius: 14,
                  border: '2px solid var(--accent)',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 8 }}>
                Open Authenticator app on your phone & enter the live code
              </span>
            </div>

            <button type="submit" disabled={loading || otp.length < 6} className="btn btn-primary btn-full" style={{ height: 44, borderRadius: 12 }}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Verify Code & Sign In'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => { setStep2FA(false); setOtp(''); }}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 12 }}
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
