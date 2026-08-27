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
  Zap,
  User,
  Mail,
  Phone,
  Lock,
  Building2,
  Briefcase,
  ShieldAlert,
  Layers,
  GraduationCap,
  Laptop,
  Globe,
  BookOpen,
  School,
  Compass,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

const INDUSTRY_OPTIONS = [
  'Agency',
  'SaaS',
  'Real Estate',
  'E-commerce',
  'Consulting',
  'Healthcare',
  'Education',
  'Event Management & Exhibitions',
  'Other'
];

const EDUCATION_SUB_PROFILES_UI = [
  {
    id: 'higher_education',
    title: 'Higher Education',
    subtitle: 'Colleges & Universities',
    desc: 'Campus admissions, degrees, merit lists & token fees',
    icon: GraduationCap,
    badge: 'Colleges',
  },
  {
    id: 'edtech',
    title: 'EdTech Companies',
    subtitle: 'Online Courses & Bootcamps',
    desc: 'Webinars, masterclasses, cohorts & upskilling',
    icon: Laptop,
    badge: 'Bootcamps',
  },
  {
    id: 'study_abroad',
    title: 'Study Abroad',
    subtitle: 'Overseas Education',
    desc: 'Global universities, IELTS/GRE, SOPs, I-20 & Visa filing',
    icon: Globe,
    badge: 'International',
  },
  {
    id: 'test_prep',
    title: 'Test Prep & Coaching',
    subtitle: 'Competitive Exam Institutes',
    desc: 'IIT-JEE, NEET, CAT, UPSC, SAT demos & tests',
    icon: BookOpen,
    badge: 'Entrance Prep',
  },
  {
    id: 'k12',
    title: 'K-12 Schools',
    subtitle: 'Schools & Pre-Schools',
    desc: 'School tours, readiness tests & parent interviews',
    icon: School,
    badge: 'School Boards',
  },
  {
    id: 'admission_consultants',
    title: 'Admission Consultants',
    subtitle: 'Counsellors & Advisors',
    desc: 'Multi-college advisory, quota filing & catalogue',
    icon: Compass,
    badge: 'Hybrid Advisory',
  },
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
    educationSubProfile: 'higher_education',
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
    if (form.industryType === 'Education' && !form.educationSubProfile) {
      return toast.error('Please select your specific Education Sub-Profile');
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
        industryType: form.industryType === 'Event Management & Exhibitions' ? 'Event Management' : (form.industryType || 'Agency'),
        educationSubProfile: form.industryType === 'Education' ? form.educationSubProfile : undefined,
      });
      setAuth(data, data.token);
      toast.success(`Account registered! Welcome, ${data.name} 🎉`);
      if (data.role === 'superadmin') {
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
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#090d16',
      backgroundImage: 'radial-gradient(circle at 50% 5%, rgba(79, 70, 229, 0.15) 0%, rgba(15, 23, 42, 0) 60%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
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
        width: '600px',
        height: '420px',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, rgba(147, 51, 234, 0.08) 50%, transparent 70%)',
        filter: 'blur(80px)',
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
        maxWidth: '490px',
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
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(79, 70, 229, 0.45)',
              marginBottom: 10
            }}>
              <Image
                src="/logo.png"
                alt="SalesCRM Logo"
                width={42}
                height={42}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </Link>

          <h1 style={{ fontSize: 23, fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.3px' }}>
            Create Your Account
          </h1>
          <p style={{ color: '#94a3b8', marginTop: 4, fontSize: 13 }}>
            Deploy your dedicated Sales & WhatsApp Command Center
          </p>
        </div>

        {/* Toggle Tabs: Sign In / Create Account */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: 4,
          borderRadius: 12,
          marginBottom: 20,
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <Link
            href="/login"
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
            <Lock size={13} />
            <span>Sign In</span>
          </Link>
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
            <Sparkles size={13} />
            <span>Create Account</span>
          </button>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          {/* Strict Role Selection */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
              Select Account Role *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, workStatus: 'company_owner' }))}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: form.workStatus === 'company_owner' ? '1.5px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                  background: form.workStatus === 'company_owner' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease',
                  boxShadow: form.workStatus === 'company_owner' ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none'
                }}
              >
                <Building2 size={20} color={form.workStatus === 'company_owner' ? '#818cf8' : '#94a3b8'} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>Agency Owner</span>
                <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.2 }}>Manage reps & pool</span>
              </button>

              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, workStatus: 'independent_agent' }))}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: form.workStatus === 'independent_agent' ? '1.5px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                  background: form.workStatus === 'independent_agent' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease',
                  boxShadow: form.workStatus === 'independent_agent' ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none'
                }}
              >
                <Briefcase size={20} color={form.workStatus === 'independent_agent' ? '#818cf8' : '#94a3b8'} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>Solo Agent</span>
                <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.2 }}>Individual sales pipeline</span>
              </button>
            </div>
          </div>

          {/* Industry Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              <Layers size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#818cf8' }} />
              Industry Vertical *
            </label>
            <select
              value={form.industryType}
              onChange={set('industryType')}
              required
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 13.5,
                color: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              {INDUSTRY_OPTIONS.map(ind => (
                <option key={ind} value={ind} style={{ background: '#0f172a', color: '#ffffff' }}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Education Sector Sub-Profiles */}
          {form.industryType === 'Education' && (
            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 14,
              padding: '14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GraduationCap size={16} color="#818cf8" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>
                    Select Education Sub-Profile *
                  </span>
                </div>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.12)',
                  padding: '2px 8px',
                  borderRadius: 10
                }}>
                  Auto-Configured
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                {EDUCATION_SUB_PROFILES_UI.map((sub) => {
                  const IconComponent = sub.icon;
                  const isSelected = form.educationSubProfile === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, educationSubProfile: sub.id }))}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: isSelected ? '1.5px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: isSelected ? '#4f46e5' : 'rgba(255, 255, 255, 0.08)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <IconComponent size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: isSelected ? '#ffffff' : '#cbd5e1' }}>
                            {sub.title}
                          </span>
                          {isSelected && <CheckCircle2 size={13} color="#818cf8" />}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>{sub.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {form.workStatus === 'company_owner' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                <Building2 size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#818cf8' }} />
                Organization / Agency Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Apex Growth Solutions"
                value={form.companyName}
                onChange={set('companyName')}
                required
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 13.5,
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
              <User size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#818cf8' }} />
              Full Name *
            </label>
            <input
              type="text"
              placeholder="Your full name"
              value={form.name}
              onChange={set('name')}
              autoComplete="name"
              required
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 13.5,
                color: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                <Mail size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#818cf8' }} />
                Email
              </label>
              <input
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                inputMode="email"
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                <Phone size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#818cf8' }} />
                Phone
              </label>
              <input
                type="tel"
                placeholder="+91 9999999999"
                value={form.phone}
                onChange={set('phone')}
                autoComplete="tel"
                inputMode="tel"
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                <Lock size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#818cf8' }} />
                Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min 6 chars"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 12,
                    padding: '10px 36px 10px 12px',
                    fontSize: 13,
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: 2
                  }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                Confirm *
              </label>
              <input
                type="password"
                placeholder="Repeat pass"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                autoComplete="new-password"
                required
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
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
              marginTop: 6
            }}
          >
            {loading ? (
              <div className="spinner" style={{ width: 18, height: 18, borderTopColor: '#ffffff' }} />
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: '#64748b', margin: '4px 0 0', lineHeight: 1.4 }}>
            By registering, you agree to our{' '}
            <Link href="/terms" style={{ color: '#818cf8', textDecoration: 'underline' }}>Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" style={{ color: '#818cf8', textDecoration: 'underline' }}>Privacy Policy</Link>.
          </p>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#94a3b8' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
            Sign In →
          </Link>
        </p>
      </div>
    </div>
  );
}
