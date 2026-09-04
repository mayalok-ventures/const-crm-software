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
        maxWidth: '470px',
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
        maxWidth: '470px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        padding: '28px 20px',
        boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Brand Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
              marginBottom: 10
            }}>
              <Image
                src="/logo.png"
                alt="SalesCRM Logo"
                width={40}
                height={40}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </Link>

          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.3px' }}>
            Create Your Account
          </h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
            Deploy your dedicated Sales & WhatsApp Command Center
          </p>
        </div>

        {/* Segmented Switcher: Sign In / Create Account */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 10,
          marginBottom: 20,
          border: '1px solid #e2e8f0'
        }}>
          <Link
            href="/login"
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
            <Lock size={13} />
            <span>Sign In</span>
          </Link>
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
            <Sparkles size={13} color="#4f46e5" />
            <span>Create Account</span>
          </button>
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Strict Role Selection */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
              Select Account Role *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, workStatus: 'company_owner' }))}
                style={{
                  padding: '12px 10px',
                  borderRadius: 10,
                  border: form.workStatus === 'company_owner' ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                  background: form.workStatus === 'company_owner' ? '#eef2ff' : '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease'
                }}
              >
                <Building2 size={20} color={form.workStatus === 'company_owner' ? '#4f46e5' : '#64748b'} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>Agency Owner</span>
                <span style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.2 }}>Manage reps & pool</span>
              </button>

              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, workStatus: 'independent_agent' }))}
                style={{
                  padding: '12px 10px',
                  borderRadius: 10,
                  border: form.workStatus === 'independent_agent' ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                  background: form.workStatus === 'independent_agent' ? '#eef2ff' : '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease'
                }}
              >
                <Briefcase size={20} color={form.workStatus === 'independent_agent' ? '#4f46e5' : '#64748b'} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>Solo Agent</span>
                <span style={{ fontSize: 10.5, color: '#64748b', lineHeight: 1.2 }}>Individual sales pipeline</span>
              </button>
            </div>
          </div>

          {/* Industry Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              <Layers size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#4f46e5' }} />
              Industry Vertical *
            </label>
            <select
              value={form.industryType}
              onChange={set('industryType')}
              required
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                padding: '9px 12px',
                fontSize: 13.5,
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              {INDUSTRY_OPTIONS.map(ind => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Education Sector Sub-Profiles */}
          {form.industryType === 'Education' && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GraduationCap size={16} color="#4f46e5" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                    Select Education Sub-Profile *
                  </span>
                </div>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#0369a1',
                  background: '#e0f2fe',
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
                        borderRadius: 8,
                        border: isSelected ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                        background: isSelected ? '#eef2ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: isSelected ? '#4f46e5' : '#f1f5f9',
                        color: isSelected ? '#ffffff' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <IconComponent size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: isSelected ? '#4338ca' : '#0f172a' }}>
                            {sub.title}
                          </span>
                          {isSelected && <CheckCircle2 size={13} color="#4f46e5" />}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>{sub.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {form.workStatus === 'company_owner' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                <Building2 size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#4f46e5' }} />
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
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  padding: '9px 12px',
                  fontSize: 13.5,
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              <User size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#4f46e5' }} />
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
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                padding: '9px 12px',
                fontSize: 13.5,
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                <Mail size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#4f46e5' }} />
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
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  padding: '9px 10px',
                  fontSize: 13,
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                <Phone size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#4f46e5' }} />
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
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  padding: '9px 10px',
                  fontSize: 13,
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                <Lock size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#4f46e5' }} />
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
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    padding: '9px 34px 9px 10px',
                    fontSize: 13,
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: 2
                  }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
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
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  padding: '9px 10px',
                  fontSize: 13,
                  color: '#0f172a',
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
              marginTop: 4
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
            <Link href="/terms" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Privacy Policy</Link>.
          </p>
        </form>

        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#64748b' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
