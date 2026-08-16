'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { Eye, EyeOff, Zap, User, Mail, Phone, Lock, Building2, Briefcase, ShieldAlert, Layers } from 'lucide-react';

const INDUSTRY_OPTIONS = [
  'Agency',
  'SaaS',
  'Real Estate',
  'E-commerce',
  'Consulting',
  'Healthcare',
  'Education',
  'Other'
];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    workStatus: 'company_owner', // 'company_owner' | 'independent_agent'
    companyName: '',
    industryType: 'Agency',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!form.name || !form.password) return toast.error('Name and password required');
    if (!form.email && !form.phone) return toast.error('Provide email or phone number');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.workStatus === 'company_owner' && !form.companyName.trim()) {
      return toast.error('Please enter your Organization / Agency Name');
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        password: form.password,
        workStatus: form.workStatus,
        companyName: form.companyName || undefined,
        industryType: form.industryType || 'Agency',
      });
      setAuth(data, data.token);
      toast.success(`Account registered! Welcome, ${data.name} 🎉`);

      if (data.role === 'superadmin' || data.isAdmin) {
        router.replace('/superadmin-dashboard');
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ paddingBottom: 20, maxWidth: 480 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
          }}>
            <Image
              src="/logo.png"
              alt="SalesCRM Logo"
              width={56}
              height={56}
              style={{ borderRadius: 14, objectFit: 'contain', boxShadow: '0 8px 32px rgba(79, 70, 229, 0.3)' }}
              priority
            />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
            Create Account
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 13 }}>Universal Sales & Operations Command Center</p>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Strict Role Selection */}
          <div>
            <label className="label" style={{ marginBottom: 6, fontWeight: 700 }}>
              Select Account Role *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, workStatus: 'company_owner' }))}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: form.workStatus === 'company_owner' ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: form.workStatus === 'company_owner' ? 'rgba(79,70,229,0.1)' : 'var(--surface)',
                  color: form.workStatus === 'company_owner' ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Building2 size={20} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>🏢 Agency Owner</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.2 }}>Manage reps, team pool & catalog</span>
              </button>

              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, workStatus: 'independent_agent' }))}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: form.workStatus === 'independent_agent' ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: form.workStatus === 'independent_agent' ? 'rgba(79,70,229,0.1)' : 'var(--surface)',
                  color: form.workStatus === 'independent_agent' ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Briefcase size={20} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>👤 Solo Agent</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.2 }}>Individual sales & direct deals</span>
              </button>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldAlert size={12} color="var(--accent)" />
              <span>Role is locked upon signup and cannot be changed later.</span>
            </p>
          </div>

          {/* Industry Vertical Selector */}
          <div>
            <label className="label">
              <Layers size={12} style={{ display: 'inline', marginRight: 4 }} />
              Industry Vertical *
            </label>
            <select
              className="input"
              value={form.industryType}
              onChange={set('industryType')}
              required
            >
              {INDUSTRY_OPTIONS.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          {form.workStatus === 'company_owner' && (
            <div>
              <label className="label">
                <Building2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                Organization / Agency Name *
              </label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Apex Growth Solutions"
                value={form.companyName}
                onChange={set('companyName')}
                required
              />
            </div>
          )}

          <div>
            <label className="label"><User size={12} style={{ display: 'inline', marginRight: 4 }} />Full Name *</label>
            <input className="input" type="text" placeholder="Your full name" value={form.name} onChange={set('name')} autoComplete="name" required />
          </div>

          <div>
            <label className="label"><Mail size={12} style={{ display: 'inline', marginRight: 4 }} />Email (optional if phone provided)</label>
            <input className="input" type="email" placeholder="your@email.com" value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" />
          </div>

          <div>
            <label className="label"><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />Phone (optional if email provided)</label>
            <input className="input" type="tel" placeholder="+91 9999999999" value={form.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" />
          </div>

          <div>
            <label className="label"><Lock size={12} style={{ display: 'inline', marginRight: 4 }} />Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                placeholder="Min 6 characters"
                value={form.password}
                onChange={set('password')}
                style={{ paddingRight: 48 }}
                autoComplete="new-password"
                required
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Confirm Password *</label>
            <input className="input" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" required />
          </div>

          <button className="btn btn-primary btn-full" type="submit" disabled={loading} style={{ marginTop: 8, height: 44, borderRadius: 12 }}>
            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Complete Registration'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', margin: '12px 0 4px', lineHeight: 1.4 }}>
            By creating an account, you agree to our{' '}
            <Link href="/terms" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Privacy Policy</Link>.
          </p>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
