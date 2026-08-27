'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth';
import {
  ArrowRight,
  Zap,
  MessageSquare,
  Layers,
  Users,
  CheckCircle2,
  Lock,
  ChevronRight,
  Smartphone,
  Sparkles,
  BarChart3,
  Globe,
  Building2,
  GraduationCap,
  Home as HomeIcon,
  Laptop,
  Check,
  BellRing,
  Clock,
  Compass
} from 'lucide-react';

const INDUSTRY_TABS = [
  {
    id: 'agency',
    label: 'Digital Agencies',
    icon: Building2,
    tagline: 'Client lead routing, multi-account pooling & rep assignment',
    features: [
      'Multi-channel Meta & Google Ads lead capture',
      'Automated round-robin lead allocation to agents',
      'Per-client WhatsApp follow-up templates & tracking',
      'Commission & closed revenue reporting'
    ],
    metric: '+142% Team Output'
  },
  {
    id: 'education',
    label: 'Higher Ed & EdTech',
    icon: GraduationCap,
    tagline: 'Admissions pipeline, course counselling & token fee collection',
    features: [
      'Direct integration with college catalogues & courses',
      'Counsellor follow-up alarms & WhatsApp reminders',
      'Merit & document verification status tracker',
      'Overseas IELTS/GRE & visa stage workflows'
    ],
    metric: '3.8x More Enrollments'
  },
  {
    id: 'realestate',
    label: 'Real Estate & Builders',
    icon: HomeIcon,
    tagline: 'Inventory booking, unit availability & site-visit scheduling',
    features: [
      'Live unit & inventory availability tracker',
      'Automated site visit alarms & location dispatch',
      'Client budget & configuration qualification tags',
      'Direct WhatsApp brochure & walkthrough sharing'
    ],
    metric: '68% Visit Show Rate'
  },
  {
    id: 'saas',
    label: 'B2B SaaS & Tech',
    icon: Laptop,
    tagline: 'Demo booking, trial-to-paid conversion & pipeline velocity',
    features: [
      'Inbound webhook lead sync in under 500ms',
      'Deal value forecasting & stage velocity metrics',
      'Instant demo confirmation via WhatsApp & Email',
      'Tier-based subscription & lifecycle monitoring'
    ],
    metric: '45% Faster Deal Closure'
  }
];

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('agency');

  useEffect(() => {
    const token = getToken();
    if (token) {
      const u = getUser();
      setUser(u);
    }
  }, []);

  const selectedIndustry = INDUSTRY_TABS.find(t => t.id === activeTab) || INDUSTRY_TABS[0];

  return (
    <div className="landing-root">
      {/* Background Soft Ambient Accents */}
      <div
        className="landing-glow-orb"
        style={{
          top: '-120px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '700px',
          height: '450px',
          background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.12) 0%, rgba(224, 231, 255, 0.05) 50%, transparent 70%)'
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          1. STICKY LIGHT NAVBAR (Stripe / Linear Style)
          ───────────────────────────────────────────────────────────── */}
      <header className="landing-nav">
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
              overflow: 'hidden'
            }}>
              <Image
                src="/logo.png"
                alt="SalesCRM"
                width={32}
                height={32}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <div>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.4px', color: '#0f172a' }}>
                Sales<span style={{ color: '#4f46e5' }}>CRM</span>
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="desktop-nav-links">
            <a href="#features" style={{ color: '#475569', fontSize: 13.5, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>
              Features
            </a>
            <a href="#whatsapp" style={{ color: '#475569', fontSize: 13.5, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>
              WhatsApp Engine
            </a>
            <a href="#solutions" style={{ color: '#475569', fontSize: 13.5, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>
              Industries
            </a>
          </nav>

          {/* Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user ? (
              <Link
                href="/dashboard"
                className="landing-btn-primary"
                style={{ padding: '8px 16px', fontSize: 13.5 }}
              >
                <span>Go to Dashboard</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="landing-btn-ghost"
                  style={{ padding: '8px 16px', fontSize: 13 }}
                >
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/signup"
                  className="landing-btn-primary"
                  style={{ padding: '8px 18px', fontSize: 13 }}
                >
                  <span>Get Started Free</span>
                  <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION (High-end Enterprise SaaS Typography)
          ───────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '96px 24px 64px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Subtle Category Pill Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div className="landing-hero-badge">
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#4f46e5',
            }} />
            <span>Next-Gen Sales & Operations CRM</span>
            <Sparkles size={13} color="#f59e0b" />
          </div>
        </div>

        {/* Main Headline (Strictly 'Close Deals 3x Faster.') */}
        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.035em',
            color: '#0f172a',
            margin: '0 auto 18px',
            maxWidth: '800px'
          }}
        >
          Close Deals 3x Faster.
        </h1>

        {/* Sub-headline (Strictly requested text & max width) */}
        <p
          style={{
            fontSize: '1.125rem',
            color: '#64748b',
            lineHeight: 1.6,
            maxWidth: '580px',
            margin: '0 auto 36px',
            fontWeight: 400
          }}
        >
          Intelligent CRM built for WhatsApp. Ingest Meta leads, automate follow-ups, and scale your sales pipeline securely.
        </p>

        {/* Hero CTA Buttons */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          marginBottom: 48
        }}>
          <Link
            href="/signup"
            className="landing-btn-primary"
            style={{ padding: '13px 28px', fontSize: 15, borderRadius: 12 }}
          >
            <span>Start Free Trial</span>
            <ArrowRight size={16} />
          </Link>

          <Link
            href="/login"
            className="landing-btn-ghost"
            style={{ padding: '13px 24px', fontSize: 15, borderRadius: 12 }}
          >
            <span>Sign In to Workspace</span>
          </Link>
        </div>

        {/* Trust Badges Strip (NO 2FA) */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px 28px',
          color: '#64748b',
          fontSize: 13,
          fontWeight: 500
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={15} color="#10b981" />
            <span>Zero Setup Fees</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={15} color="#4f46e5" />
            <span>Instant Meta Ads Sync</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageSquare size={15} color="#0284c7" />
            <span>1-Click WhatsApp Outreach</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Smartphone size={15} color="#f59e0b" />
            <span>Mobile PWA Ready</span>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            3. CLASSICAL LIGHT CRM DASHBOARD SHOWCASE
            ───────────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 56, position: 'relative' }}>
          <div className="landing-mockup-frame">
            {/* macOS Chrome Header */}
            <div style={{
              padding: '12px 18px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <div style={{ display: 'flex', gap: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
              </div>
              <div style={{
                flex: 1,
                maxWidth: '360px',
                margin: '0 auto',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '4px 12px',
                fontSize: 11.5,
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}>
                <Lock size={11} color="#10b981" />
                <span>crm.coresetu.com/dashboard/pipeline</span>
              </div>
            </div>

            {/* Showcase Body Preview */}
            <div style={{ padding: '24px 20px', textAlign: 'left', background: '#ffffff' }}>
              {/* Top Stats Strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 14,
                marginBottom: 22
              }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Pipeline Value</span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>$148,500 <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>+34.8%</span></div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Leads Ingested (Today)</span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>84 Inquiries <span style={{ fontSize: 12, color: '#4f46e5' }}>Meta & Webhook</span></div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>WhatsApp Response Rate</span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981', marginTop: 4 }}>92.4% <span style={{ fontSize: 12, color: '#64748b' }}>&lt; 2 min avg</span></div>
                </div>
              </div>

              {/* Interactive Pipeline Board Showcase */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14
              }}>
                {/* Column 1: New Leads */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>⚡ New Inbound (24)</span>
                    <span style={{ fontSize: 10, background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>Meta Ads</span>
                  </div>
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '10px 12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: '#0f172a' }}>Amitav Sengupta</strong>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>$12,000</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 8px' }}>Apex Growth • High Intent Enquiry</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: 9.5, background: '#eef2ff', color: '#4f46e5', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>WhatsApp Triggered</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: In Discovery */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>💬 In Discovery (16)</span>
                    <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>Active</span>
                  </div>
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '10px 12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: '#0f172a' }}>Pooja Varma</strong>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>$24,500</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 8px' }}>Skyline Realty • Unit 402 Luxury Villa</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: 9.5, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Site Visit Scheduled</span>
                    </div>
                  </div>
                </div>

                {/* Column 3: Closed Won */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>🎉 Closed Won (38)</span>
                    <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>Revenue Booked</span>
                  </div>
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #bbf7d0',
                    borderRadius: 10,
                    padding: '10px 12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: '#0f172a' }}>Rohan Mehra</strong>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>$65,000</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 8px' }}>Oxford MBA Admission • Token Deposited</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: 9.5, background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Receipt Sent via WA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Pill */}
          <div
            className="float-slow-animation"
            style={{
              position: 'absolute',
              bottom: '-20px',
              right: '25px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 12px 28px -6px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <MessageSquare size={18} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>1-Click WhatsApp Ingestion</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Dynamic personalized outreach in 0.1s</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. CORE SUPERPOWERS / BENTO GRID
          ───────────────────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="landing-hero-badge" style={{ marginBottom: 12 }}>
            <Zap size={13} color="#4f46e5" />
            <span>Built For High-Velocity Sales</span>
          </div>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '-0.03em' }}>
            Everything You Need To Grow Revenue
          </h2>
          <p style={{ color: '#64748b', fontSize: 15, maxWidth: '580px', margin: '10px auto 0' }}>
            Eliminate messy spreadsheets, lost leads, and disconnected tools with an intuitive sales command center.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24
        }}>
          {/* Card 1: Lead Ingestion */}
          <div className="landing-bento-card">
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <Zap size={22} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
              Omni-Channel Lead Ingestion
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Direct webhooks for Meta (Facebook & Instagram Ads), Google Forms, inquiry widgets, and CSV bulk import with auto-deduplication.
            </p>
          </div>

          {/* Card 2: WhatsApp Automation */}
          <div className="landing-bento-card" id="whatsapp">
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#ecfdf5',
              border: '1px solid #d1fae5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <MessageSquare size={22} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
              1-Click WhatsApp Engine
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Launch instant WhatsApp chats without saving numbers. Pre-approved dynamic templates replace client names and deal info on the fly.
            </p>
          </div>

          {/* Card 3: Follow-up Alarms */}
          <div className="landing-bento-card">
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <BellRing size={22} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
              Automated Follow-up Alarms
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Never let a high-value prospect go cold. Scheduled alarms, overdue notification badges, and push reminders keep reps accountable.
            </p>
          </div>

          {/* Card 4: Industry Blueprints */}
          <div className="landing-bento-card">
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#eef2ff',
              border: '1px solid #e0e7ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <Layers size={22} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
              Tailored Industry Workflows
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Plug-and-play custom pipeline schemas for Higher Education, Real Estate, Digital Agencies, and B2B SaaS out of the box.
            </p>
          </div>

          {/* Card 5: Mobile PWA */}
          <div className="landing-bento-card">
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fdf2f8',
              border: '1px solid #fce7f3',
              color: '#db2777',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <Smartphone size={22} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
              Mobile-First Progressive Web App
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Install directly to iOS & Android home screens. Native feel, offline queueing, instant phone dialing, and swipeable Kanban cards.
            </p>
          </div>

          {/* Card 6: Analytics */}
          <div className="landing-bento-card">
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f0fdfa',
              border: '1px solid #ccfbf1',
              color: '#0d9488',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <BarChart3 size={22} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
              Live Executive Analytics
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Real-time rep performance leaderboards, pipeline conversion velocity, stage dropout analysis, and deal revenue forecasting.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. INDUSTRY SOLUTION WORKFLOWS (Interactive Tabs)
          ───────────────────────────────────────────────────────────── */}
      <section id="solutions" style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '70px 24px',
        background: '#ffffff',
        borderRadius: 24,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="landing-hero-badge" style={{ marginBottom: 10 }}>
            <Layers size={13} color="#4f46e5" />
            <span>Tailored Solutions</span>
          </div>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.3rem)', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Configured For Your Industry
          </h2>
          <p style={{ color: '#64748b', fontSize: 14.5, marginTop: 8 }}>
            Select your industry to see how SalesCRM automatically tunes your pipeline and enquiry schemas.
          </p>
        </div>

        {/* Tab Buttons */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 32
        }}>
          {INDUSTRY_TABS.map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                  background: isSelected ? '#eef2ff' : '#ffffff',
                  color: isSelected ? '#4338ca' : '#64748b',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={16} color={isSelected ? '#4f46e5' : '#64748b'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Details Card */}
        <div style={{
          maxWidth: '820px',
          margin: '0 auto',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 18,
          padding: '28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          alignItems: 'center'
        }}>
          <div>
            <div style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              color: '#0369a1',
              background: '#e0f2fe',
              padding: '3px 9px',
              borderRadius: 16,
              marginBottom: 10
            }}>
              {selectedIndustry.metric}
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
              {selectedIndustry.label} Solution
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', margin: '0 0 18px', lineHeight: 1.5 }}>
              {selectedIndustry.tagline}
            </p>
            <Link
              href="/signup"
              className="landing-btn-primary"
              style={{ fontSize: 13.5, padding: '9px 18px' }}
            >
              <span>Deploy {selectedIndustry.label} Blueprint</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedIndustry.features.map((feat, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: '#ffffff',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0'
              }}>
                <Check size={15} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, color: '#334155' }}>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. STATS STRIP
          ───────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '70px 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 20,
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: 40, fontWeight: 700, color: '#0f172a', letterSpacing: '-1px' }}>50,000+</div>
            <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>Leads Processed Monthly</div>
          </div>
          <div>
            <div style={{ fontSize: 40, fontWeight: 700, color: '#4f46e5', letterSpacing: '-1px' }}>3.4x</div>
            <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>Faster Deal Closure Velocity</div>
          </div>
          <div>
            <div style={{ fontSize: 40, fontWeight: 700, color: '#0284c7', letterSpacing: '-1px' }}>99.9%</div>
            <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>Operational Uptime & SLA</div>
          </div>
          <div>
            <div style={{ fontSize: 40, fontWeight: 700, color: '#059669', letterSpacing: '-1px' }}>100%</div>
            <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>Multi-Tenant Data Privacy</div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. BOTTOM CTA BANNER
          ───────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 70px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
          borderRadius: 24,
          padding: '52px 32px',
          textAlign: 'center',
          color: '#ffffff',
          boxShadow: '0 20px 40px -15px rgba(79, 70, 229, 0.35)'
        }}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(1.85rem, 4vw, 2.6rem)', fontWeight: 700, margin: '0 0 14px', letterSpacing: '-0.03em' }}>
              Ready To Scale Your Sales Operations?
            </h2>
            <p style={{ fontSize: 15, color: '#e0e7ff', margin: '0 0 28px', lineHeight: 1.6 }}>
              Join forward-thinking agencies and fast-scaling enterprises using SalesCRM to automate leads, WhatsApp outreach, and closed revenue.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              <Link
                href="/signup"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#ffffff',
                  color: '#4338ca',
                  fontWeight: 600,
                  fontSize: 15,
                  padding: '12px 26px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <span>Create Agency Account</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 15,
                  padding: '12px 24px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                <span>Sign In</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. MINIMAL LIGHT FOOTER
          ───────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid #e2e8f0',
        background: '#ffffff',
        padding: '36px 24px 28px'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image src="/logo.png" alt="SalesCRM" width={24} height={24} style={{ borderRadius: 6 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>SalesCRM</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>© {new Date().getFullYear()} CoreSetu Technologies.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13 }}>
            <Link href="/terms" style={{ color: '#64748b', textDecoration: 'none' }}>
              Terms of Service
            </Link>
            <Link href="/privacy" style={{ color: '#64748b', textDecoration: 'none' }}>
              Privacy Policy
            </Link>
            <Link href="/data-deletion" style={{ color: '#64748b', textDecoration: 'none' }}>
              Data Deletion
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span>Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
