'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import {
  Zap, ArrowLeft, Check, Copy, ExternalLink, RefreshCw,
  Globe, Shield, AlertCircle, Plus, Trash2, CheckCircle2, Play
} from 'lucide-react';

export default function IntegrationsPage() {
  const router = useRouter();
  const [metaIntegrations, setMetaIntegrations] = useState([]);
  const [googleIntegrations, setGoogleIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingMeta, setTestingMeta] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const [metaRes, googleRes] = await Promise.allSettled([
        api.get('/integrations/meta'),
        api.get('/integrations/google')
      ]);

      if (metaRes.status === 'fulfilled' && metaRes.value.data) {
        setMetaIntegrations(Array.isArray(metaRes.value.data) ? metaRes.value.data : (metaRes.value.data.integrations || []));
      }
      if (googleRes.status === 'fulfilled' && googleRes.value.data) {
        setGoogleIntegrations(Array.isArray(googleRes.value.data) ? googleRes.value.data : (googleRes.value.data.integrations || []));
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard! 📋');
    setTimeout(() => setCopiedKey(''), 2500);
  };

  const handleTestMetaLead = async () => {
    setTestingMeta(true);
    try {
      await api.post('/integrations/meta/test', {
        name: 'Sarah Connor (Meta Test Lead)',
        phone: '919876543210',
        email: 'sarah.connor@meta-ads-test.com',
        formName: 'Instagram Instant Lead Form',
        campaignName: 'Summer Enterprise Promo 2026',
        adSetName: 'Retargeting Audience',
        adName: 'Story Video Ad 01'
      });
      toast.success('Test Meta Lead injected into "New Leads" pipeline! 🔵');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to inject test Meta lead');
    } finally {
      setTestingMeta(false);
    }
  };

  const handleTestGoogleLead = async () => {
    setTestingGoogle(true);
    try {
      await api.post('/integrations/google/test', {
        name: 'Alex Mercer (Google Test Lead)',
        phone: '919812345678',
        email: 'alex.mercer@google-ads-test.com',
        campaignName: 'Google Search High-Intent 2026',
        adGroupName: 'Enterprise Software Keywords',
        formName: 'Google Lead Extension Form'
      });
      toast.success('Test Google Lead injected into "New Leads" pipeline! 🔴');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to inject test Google lead');
    } finally {
      setTestingGoogle(false);
    }
  };

  const handleDisconnectMeta = async (id) => {
    if (!window.confirm('Are you sure you want to disconnect this Meta Ads integration?')) return;
    try {
      await api.delete(`/integrations/meta/${id}`);
      toast.success('Meta Ads integration disconnected.');
      fetchIntegrations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disconnect');
    }
  };

  const handleDisconnectGoogle = async (id) => {
    if (!window.confirm('Are you sure you want to disconnect this Google Ads integration?')) return;
    try {
      await api.delete(`/integrations/google/${id}`);
      toast.success('Google Ads integration disconnected.');
      fetchIntegrations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disconnect');
    }
  };

  const metaWebhookUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/integrations/meta/webhook`;
  const googleWebhookUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/integrations/google/webhook`;
  const metaVerifyToken = 'crm_meta_webhook_secret_2026';

  return (
    <div className="app-shell">
      <div className="page-container max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => router.back()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text)',
                padding: 4,
                display: 'flex',
                borderRadius: 8
              }}
              aria-label="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="page-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={20} color="var(--accent)" /> Automated Ad & Lead Integrations
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Direct webhooks & OAuth connectors for Facebook, Instagram, Google Ads & Web Forms
              </p>
            </div>
          </div>
          <button
            onClick={fetchIntegrations}
            className="btn btn-ghost btn-sm"
            style={{ borderRadius: 10, gap: 6 }}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Active Receiver Status Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(16,185,129,0.06) 100%)',
            border: '1.5px solid rgba(99,102,241,0.25)',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: '#10b981',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                flexShrink: 0
              }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  Automated Lead Ingestion Engine Active ⚡
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Inbound leads from connected sources are instantly tagged, assigned, and routed to <strong>Stage 1 (New Leads)</strong> in real-time.
                </p>
              </div>
            </div>
            <Link href="/dashboard" className="btn btn-secondary btn-sm" style={{ borderRadius: 8, fontSize: 12 }}>
              View Pipeline
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* ─────────────────────────────────────────────────────────────
                CARD 1: META ADS (FACEBOOK & INSTAGRAM)
               ───────────────────────────────────────────────────────────── */}
            <div className="card" style={{ padding: '20px 18px', borderLeft: '4px solid #2563eb', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: 'rgba(37,99,235,0.12)',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 18
                    }}>
                      🔵
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                        Meta Ads (FB & Instagram)
                      </h2>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lead Generation & Instant Forms</span>
                    </div>
                  </div>
                  <span className="badge" style={{
                    background: metaIntegrations.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                    color: metaIntegrations.length > 0 ? '#10b981' : 'var(--text-muted)',
                    fontWeight: 700
                  }}>
                    {metaIntegrations.length > 0 ? '🟢 Connected' : '⚪ Ready to Connect'}
                  </span>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
                  Receive instant lead notifications from Facebook & Instagram ad campaigns. Inbound prospects land directly with <strong style={{ color: '#2563eb' }}>🔵 Meta Ads</strong> pill tags, ad set name, and form answers.
                </p>

                {/* Webhook Details for Manual Setup */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Meta Webhook Callback URL
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <input
                      className="input"
                      readOnly
                      value={metaWebhookUrl}
                      style={{ fontSize: 11, height: 32, fontFamily: 'monospace' }}
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(metaWebhookUrl, 'meta_url')}
                      className="btn btn-ghost btn-sm"
                      style={{ height: 32, padding: '0 8px' }}
                      title="Copy URL"
                    >
                      {copiedKey === 'meta_url' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    </button>
                  </div>

                  <span style={{ fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Verify Token
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      className="input"
                      readOnly
                      value={metaVerifyToken}
                      style={{ fontSize: 11, height: 32, fontFamily: 'monospace' }}
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(metaVerifyToken, 'meta_token')}
                      className="btn btn-ghost btn-sm"
                      style={{ height: 32, padding: '0 8px' }}
                      title="Copy Token"
                    >
                      {copiedKey === 'meta_token' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={handleTestMetaLead}
                  disabled={testingMeta}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, gap: 5, borderRadius: 8, fontSize: 12 }}
                >
                  <Play size={12} color="#2563eb" /> {testingMeta ? 'Simulating...' : 'Test Lead Simulation'}
                </button>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/integrations/meta/oauth`}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, background: '#2563eb', borderColor: '#2563eb', gap: 5, borderRadius: 8, fontSize: 12 }}
                >
                  <ExternalLink size={12} /> Connect Meta
                </a>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                CARD 2: GOOGLE ADS (SEARCH, PMAX, YOUTUBE)
               ───────────────────────────────────────────────────────────── */}
            <div className="card" style={{ padding: '20px 18px', borderLeft: '4px solid #dc2626', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: 'rgba(220,38,38,0.12)',
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 18
                    }}>
                      🔴
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                        Google Ads Lead Forms
                      </h2>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Search, Performance Max & YouTube</span>
                    </div>
                  </div>
                  <span className="badge" style={{
                    background: googleIntegrations.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                    color: googleIntegrations.length > 0 ? '#10b981' : 'var(--text-muted)',
                    fontWeight: 700
                  }}>
                    {googleIntegrations.length > 0 ? '🟢 Connected' : '⚪ Ready to Connect'}
                  </span>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
                  Capture high-intent leads directly from Google Search ads and asset lead forms. Inbound leads land with <strong style={{ color: '#dc2626' }}>🔴 Google Ads</strong> tags, keyword groups, and campaign names.
                </p>

                {/* Webhook Details for Google Ads Lead Extension */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Google Lead Form Webhook URL
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      className="input"
                      readOnly
                      value={googleWebhookUrl}
                      style={{ fontSize: 11, height: 32, fontFamily: 'monospace' }}
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(googleWebhookUrl, 'google_url')}
                      className="btn btn-ghost btn-sm"
                      style={{ height: 32, padding: '0 8px' }}
                      title="Copy URL"
                    >
                      {copiedKey === 'google_url' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={handleTestGoogleLead}
                  disabled={testingGoogle}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, gap: 5, borderRadius: 8, fontSize: 12 }}
                >
                  <Play size={12} color="#dc2626" /> {testingGoogle ? 'Simulating...' : 'Test Lead Simulation'}
                </button>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/integrations/google/oauth`}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626', gap: 5, borderRadius: 8, fontSize: 12 }}
                >
                  <ExternalLink size={12} /> Connect Google
                </a>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                CARD 3: WEBSITE & CUSTOM WEBHOOKS (ZAPIER / MAKE)
               ───────────────────────────────────────────────────────────── */}
            <div className="card" style={{ padding: '20px 18px', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: 'rgba(16,185,129,0.12)',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 18
                    }}>
                      🟢
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                        Website & Custom Webhooks
                      </h2>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Zapier, Make, WordPress & Web Forms</span>
                    </div>
                  </div>
                  <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700 }}>
                    🟢 Universal Ingestion
                  </span>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
                  Connect WordPress Contact Forms, Elementor, Webflow, Shopify, or Zapier. Leads post via standard JSON API with custom fields and UTM campaign attribution.
                </p>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    REST Endpoint (`POST /api/leads`)
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      className="input"
                      readOnly
                      value={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/leads`}
                      style={{ fontSize: 11, height: 32, fontFamily: 'monospace' }}
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/leads`, 'rest_leads')}
                      className="btn btn-ghost btn-sm"
                      style={{ height: 32, padding: '0 8px' }}
                      title="Copy Endpoint"
                    >
                      {copiedKey === 'rest_leads' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <Link href="/templates" className="btn btn-secondary btn-sm btn-full" style={{ borderRadius: 8, fontSize: 12 }}>
                  Manage Response Templates
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="integrations" />
    </div>
  );
}
