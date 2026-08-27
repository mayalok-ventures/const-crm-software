'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth';
import {
  ArrowRight,
  ShieldCheck,
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
  Flame,
  Globe,
  Building2,
  GraduationCap,
  Home as HomeIcon,
  Laptop,
  Check,
  BellRing,
  Clock,
  LogOut
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
      {/* Background Ambient Glows */}
      <div
        className="landing-glow-orb"
        style={{
          top: '-150px',
          left: '20%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(147, 51, 234, 0.1) 60%, transparent 80%)'
        }}
      />
      <div
        className="landing-glow-orb"
        style={{
          top: '30%',
          right: '-10%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(79, 70, 229, 0.08) 60%, transparent 80%)'
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          1. STICKY GLASSMORPHIC NAVBAR
          ───────────────────────────────────────────────────────────── */}
      <header className="landing-nav">
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(79, 70, 229, 0.4)',
              overflow: 'hidden'
            }}>
              <Image
                src="/logo.png"
                alt="SalesCRM"
                width={36}
                height={36}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <div>
              <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.5px', color: '#ffffff' }}>
                Sales<span style={{ color: '#818cf8' }}>CRM</span>
              </span>
              <span style={{
                display: 'block',
                fontSize: 9.5,
                fontWeight: 600,
                color: '#94a3b8',
                letterSpacing: '0.6px',
                textTransform: 'uppercase'
              }}>
                Enterprise Suite
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <a href="#features" style={{ color: '#cbd5e1', fontSize: 13.5, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>
              Features
            </a>
            <a href="#whatsapp" style={{ color: '#cbd5e1', fontSize: 13.5, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>
              WhatsApp Engine
            </a>
            <a href="#solutions" style={{ color: '#cbd5e1', fontSize: 13.5, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>
              Industries
            </a>
            <a href="#security" style={{ color: '#cbd5e1', fontSize: 13.5, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}>
              Security
            </a>
          </nav>

          {/* Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user ? (
              <Link
                href="/dashboard"
                className="landing-btn-primary"
                style={{ padding: '9px 18px', fontSize: 13.5 }}
              >
                <span>Go to Dashboard</span>
                <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="landing-btn-ghost"
                  style={{ padding: '8px 16px', fontSize: 13 }}
                >
                  <Lock size={13} style={{ color: '#a5b4fc' }} />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/signup"
                  className="landing-btn-primary"
                  style={{ padding: '8px 18px', fontSize: 13 }}
                >
                  <span>Create Account</span>
                  <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION
          ───────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '70px 24px 40px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Top Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div className="landing-hero-badge">
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 10px #10b981'
            }} className="pulse-animation" />
            <span>Next-Gen Sales & Operations Command Center</span>
            <Sparkles size={14} color="#f59e0b" />
          </div>
        </div>

        {/* Main Headline */}
        <h1 className="landing-hero-title" style={{ maxWidth: '960px', margin: '0 auto 20px' }}>
          Close Deals <span className="landing-gradient-text">3x Faster</span> with Intelligent Sales & WhatsApp CRM
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.25rem)',
          color: '#94a3b8',
          maxWidth: '720px',
          margin: '0 auto 36px',
          lineHeight: 1.6,
          fontWeight: 400
        }}>
          Instantly ingest leads from Meta Ads, trigger 1-click WhatsApp follow-ups, auto-assign reps, and manage full sales pipelines with bank-grade 2FA security.
        </p>

        {/* Hero CTA Buttons */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          marginBottom: 44
        }}>
          <Link
            href="/signup"
            className="landing-btn-primary"
            style={{ padding: '14px 30px', fontSize: 16, borderRadius: 14 }}
          >
            <span>Start Free Agency Trial</span>
            <ArrowRight size={18} />
          </Link>

          <Link
            href="/login"
            className="landing-btn-ghost"
            style={{ padding: '14px 28px', fontSize: 16, borderRadius: 14 }}
          >
            <Lock size={16} color="#a5b4fc" />
            <span>Sign In to Workspace</span>
          </Link>
        </div>

        {/* Trust Badges */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px 32px',
          color: '#64748b',
          fontSize: 13,
          fontWeight: 500
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={15} color="#10b981" />
            <span>Zero Setup Fees</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={15} color="#6366f1" />
            <span>TOTP 2FA & Multi-Tenant Isolation</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Smartphone size={15} color="#38bdf8" />
            <span>Mobile PWA & Offline Sync</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={15} color="#f59e0b" />
            <span>Sub-Second WhatsApp Automation</span>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            3. INTERACTIVE CRM SHOWCASE / GLASSMORPHIC MOCKUP
            ───────────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 56, position: 'relative' }}>
          <div className="landing-mockup-frame">
            {/* macOS Chrome Header */}
            <div style={{
              padding: '12px 18px',
              background: 'rgba(30, 41, 59, 0.8)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <div style={{ display: 'flex', gap: 7 }}>
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#10b981' }} />
              </div>
              <div style={{
                flex: 1,
                maxWidth: '380px',
                margin: '0 auto',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: 8,
                padding: '4px 12px',
                fontSize: 11.5,
                color: '#94a3b8',
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
            <div style={{ padding: '24px 20px', textAlign: 'left', background: 'rgba(15, 23, 42, 0.95)' }}>
              {/* Top Stats Strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 14,
                marginBottom: 22
              }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Active Pipeline Value</span>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>$148,500 <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>+34.8%</span></div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Leads Ingested (Today)</span>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>84 Inquiries <span style={{ fontSize: 12, color: '#a5b4fc' }}>Meta & Webhook</span></div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>WhatsApp Response Rate</span>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', marginTop: 4 }}>92.4% <span style={{ fontSize: 12, color: '#94a3b8' }}>&lt; 2 min avg</span></div>
                </div>
              </div>

              {/* Interactive Pipeline Board Showcase */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14
              }}>
                {/* Column 1: New Leads */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>⚡ New Inbound (24)</span>
                    <span style={{ fontSize: 10, background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '2px 6px', borderRadius: 6 }}>Meta Ads</span>
                  </div>
                  <div style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    marginBottom: 8
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: '#ffffff' }}>Amitav Sengupta</strong>
                      <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>$12,000</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 8px' }}>Apex Growth • High Intent Enquiry</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: 9.5, background: 'rgba(79, 70, 229, 0.2)', color: '#a5b4fc', padding: '2px 6px', borderRadius: 4 }}>WhatsApp Triggered</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: In Discovery */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fcd34d' }}>💬 In Discovery (16)</span>
                    <span style={{ fontSize: 10, background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d', padding: '2px 6px', borderRadius: 6 }}>Active</span>
                  </div>
                  <div style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    marginBottom: 8
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: '#ffffff' }}>Pooja Varma</strong>
                      <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>$24,500</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 8px' }}>Skyline Realty • Unit 402 Luxury Villa</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: 9.5, background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d', padding: '2px 6px', borderRadius: 4 }}>Site Visit Scheduled</span>
                    </div>
                  </div>
                </div>

                {/* Column 3: Closed Won */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#86efac' }}>🎉 Closed Won (38)</span>
                    <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.2)', color: '#86efac', padding: '2px 6px', borderRadius: 6 }}>Revenue Booked</span>
                  </div>
                  <div style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    marginBottom: 8
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: '#ffffff' }}>Rohan Mehra</strong>
                      <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>$65,000</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 8px' }}>Oxford MBA Admission • Token Deposited</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: 9.5, background: 'rgba(16, 185, 129, 0.2)', color: '#86efac', padding: '2px 6px', borderRadius: 4 }}>Receipt Sent via WA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Micro-Widget */}
          <div
            className="float-slow-animation"
            style={{
              position: 'absolute',
              bottom: '-25px',
              right: '25px',
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid rgba(79, 70, 229, 0.4)',
              borderRadius: 16,
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 15px 35px rgba(0, 0, 0, 0.5), 0 0 20px rgba(79, 70, 229, 0.25)',
              backdropFilter: 'blur(16px)'
            }}
          >
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <MessageSquare size={20} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>1-Click WhatsApp Ingestion</div>
              <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Dynamic {'{name}'} token replaced in 0.1s</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. CORE SUPERPOWERS / BENTO GRID
          ───────────────────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: '1240px', margin: '0 auto', padding: '90px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div className="landing-hero-badge" style={{ marginBottom: 12 }}>
            <Zap size={14} color="#f59e0b" />
            <span>Built For High-Velocity Sales Teams</span>
          </div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.5px' }}>
            Everything You Need To <span className="landing-gradient-text">Dominate Your Market</span>
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 15, maxWidth: '640px', margin: '12px auto 0' }}>
            Eliminate messy spreadsheets, lost follow-ups, and disconnected tools with a unified operations engine.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24
        }}>
          {/* Bento Card 1: Lead Ingestion */}
          <div className="landing-bento-card">
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18
            }}>
              <Zap size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>
              Omni-Channel Lead Ingestion
            </h3>
            <p style={{ fontSize: 13.5, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
              Direct webhooks for Meta (Facebook & Instagram Ads), Google Forms, website inquiry widgets, and CSV bulk import with instant auto-deduplication.
            </p>
          </div>

          {/* Bento Card 2: WhatsApp Automation */}
          <div className="landing-bento-card" id="whatsapp">
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18
            }}>
              <MessageSquare size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>
              1-Click WhatsApp Engine
            </h3>
            <p style={{ fontSize: 13.5, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
              Launch instant WhatsApp chats without saving numbers. Pre-approved dynamic templates replace client names, status, and deal info on the fly.
            </p>
          </div>

          {/* Bento Card 3: 2FA & Bank-Grade Security */}
          <div className="landing-bento-card" id="security">
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18
            }}>
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>
              Enterprise Security & 2FA
            </h3>
            <p style={{ fontSize: 13.5, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
              Complete Google Authenticator / Authy TOTP 2FA, 8-digit emergency backup recovery codes, tenant data encryption, and strict RBAC permission matrices.
            </p>
          </div>

          {/* Bento Card 4: Follow-up Alarms */}
          <div className="landing-bento-card">
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18
            }}>
              <BellRing size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>
              Automated Follow-up Alarms
            </h3>
            <p style={{ fontSize: 13.5, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
              Never let a high-value prospect go cold. Scheduled alarms, overdue notification badges, and multi-device push reminders keep sales reps accountable.
            </p>
          </div>

          {/* Bento Card 5: Mobile PWA */}
          <div className="landing-bento-card">
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(236, 72, 153, 0.15)',
              border: '1px solid rgba(236, 72, 153, 0.3)',
              color: '#f472b6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18
            }}>
              <Smartphone size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>
              Mobile-First Progressive Web App
            </h3>
            <p style={{ fontSize: 13.5, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
              Install instantly to iOS & Android home screens. Native feel, offline queueing, instant phone dialing, and swipeable Kanban lead cards.
            </p>
          </div>

          {/* Bento Card 6: Analytics & Commission */}
          <div className="landing-bento-card">
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(20, 184, 166, 0.15)',
              border: '1px solid rgba(20, 184, 166, 0.3)',
              color: '#2dd4bf',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18
            }}>
              <BarChart3 size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>
              Live Executive Analytics
            </h3>
            <p style={{ fontSize: 13.5, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
              Real-time rep performance leaderboards, pipeline conversion velocity, stage dropout analysis, and deal revenue forecasting.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. INDUSTRY SOLUTION WORKFLOWS (Interactive Tabs)
          ───────────────────────────────────────────────────────────── */}
      <section id="solutions" style={{
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '80px 24px',
        background: 'rgba(15, 23, 42, 0.4)',
        borderRadius: 32,
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="landing-hero-badge" style={{ marginBottom: 12 }}>
            <Layers size={14} color="#818cf8" />
            <span>Tailored Industry Blueprints</span>
          </div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Configured For Your Exact Vertical
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 14.5, marginTop: 10 }}>
            Select your industry to see how SalesCRM automatically tunes your pipeline and schemas.
          </p>
        </div>

        {/* Tab Buttons */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 36
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
                  padding: '10px 18px',
                  borderRadius: 12,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 0 20px rgba(99, 102, 241, 0.3)' : 'none'
                }}
              >
                <Icon size={16} color={isSelected ? '#818cf8' : '#94a3b8'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Details Card */}
        <div style={{
          maxWidth: '840px',
          margin: '0 auto',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 20,
          padding: '32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 28,
          alignItems: 'center'
        }}>
          <div>
            <div style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.12)',
              padding: '4px 10px',
              borderRadius: 20,
              marginBottom: 12
            }}>
              {selectedIndustry.metric}
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', margin: '0 0 10px' }}>
              {selectedIndustry.label} Solution
            </h3>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              {selectedIndustry.tagline}
            </p>
            <Link
              href="/signup"
              className="landing-btn-primary"
              style={{ fontSize: 13.5, padding: '10px 20px' }}
            >
              <span>Deploy {selectedIndustry.label} Blueprint</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selectedIndustry.features.map((feat, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. STATS & PROOF STRIP
          ───────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 20,
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#ffffff', letterSpacing: '-1px' }}>50,000+</div>
            <div style={{ fontSize: 13.5, color: '#94a3b8', marginTop: 4 }}>Leads Processed Monthly</div>
          </div>
          <div>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#818cf8', letterSpacing: '-1px' }}>3.4x</div>
            <div style={{ fontSize: 13.5, color: '#94a3b8', marginTop: 4 }}>Faster Deal Closure Velocity</div>
          </div>
          <div>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#38bdf8', letterSpacing: '-1px' }}>99.9%</div>
            <div style={{ fontSize: 13.5, color: '#94a3b8', marginTop: 4 }}>Operational Uptime & SLA</div>
          </div>
          <div>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#34d399', letterSpacing: '-1px' }}>100%</div>
            <div style={{ fontSize: 13.5, color: '#94a3b8', marginTop: 4 }}>Multi-Tenant Data Privacy</div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. BOTTOM CTA BANNER
          ───────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.25) 0%, rgba(147, 51, 234, 0.2) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: 28,
          padding: '60px 32px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div
            className="landing-glow-orb"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)'
            }}
          />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px', margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: '#ffffff', margin: '0 0 16px', letterSpacing: '-0.5px' }}>
              Ready To Supercharge Your Sales Operations?
            </h2>
            <p style={{ fontSize: 16, color: '#cbd5e1', margin: '0 0 32px', lineHeight: 1.6 }}>
              Join forward-thinking agencies and fast-scaling enterprises using SalesCRM to automate leads, WhatsApp outreach, and closed revenue.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14 }}>
              <Link
                href="/signup"
                className="landing-btn-primary"
                style={{ padding: '14px 32px', fontSize: 16, borderRadius: 14 }}
              >
                <span>Create Agency Account</span>
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/login"
                className="landing-btn-ghost"
                style={{ padding: '14px 28px', fontSize: 16, borderRadius: 14 }}
              >
                <Lock size={16} color="#a5b4fc" />
                <span>Sign In to Workspace</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. CLEAN MINIMAL FOOTER
          ───────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#060911',
        padding: '40px 24px 32px'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/logo.png" alt="SalesCRM" width={28} height={28} style={{ borderRadius: 8 }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>SalesCRM</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>© {new Date().getFullYear()} CoreSetu Technologies.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 13 }}>
            <Link href="/terms" style={{ color: '#94a3b8', textDecoration: 'none' }}>
              Terms of Service
            </Link>
            <Link href="/privacy" style={{ color: '#94a3b8', textDecoration: 'none' }}>
              Privacy Policy
            </Link>
            <Link href="/data-deletion" style={{ color: '#94a3b8', textDecoration: 'none' }}>
              Data Deletion
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span>Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
