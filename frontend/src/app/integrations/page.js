'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api, { API_URL } from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import {
  Zap, ArrowLeft, Check, Copy, ExternalLink, RefreshCw,
  Globe, Shield, AlertCircle, Plus, Trash2, CheckCircle2, Play
} from 'lucide-react';

export default function IntegrationsPage() {
  const router = useRouter();
  const [metaIntegrations, setMetaIntegrations] = useState([]);
  const [googleIntegrations, setGoogleIntegrations] = useState([]);
  const [universalWebhooks, setUniversalWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingMeta, setTestingMeta] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  // Google Ads Account Configuration states
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accessibleAccounts, setAccessibleAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [configuringIntegrationId, setConfiguringIntegrationId] = useState(null);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const [metaRes, googleRes, universalRes] = await Promise.allSettled([
        api.get('/integrations/meta'),
        api.get('/integrations/google'),
        api.get('/integrations')
      ]);

      if (metaRes.status === 'fulfilled' && metaRes.value.data) {
        const payload = metaRes.value.data;
        const list = Array.isArray(payload) ? payload : (payload.data || payload.integrations || []);
        setMetaIntegrations(list);
      }
      if (googleRes.status === 'fulfilled' && googleRes.value.data) {
        const payload = googleRes.value.data;
        const list = Array.isArray(payload) ? payload : (payload.data || payload.integrations || []);
        setGoogleIntegrations(list);
      }
      if (universalRes.status === 'fulfilled' && universalRes.value.data) {
        setUniversalWebhooks(universalRes.value.data.universalWebhooks || []);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      
      const googleStatus = params.get('google');
      const integrationStatus = params.get('integration');
      if (integrationStatus === 'google_success' || googleStatus === 'connected') {
        toast.success(`Google Ads account connected! 🔴`);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        fetchIntegrations();
      } else if (integrationStatus === 'google_error' || googleStatus === 'error') {
        const errorMsg = params.get('message') || 'Connection failed';
        toast.error(`Google connection failed: ${errorMsg}`);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        fetchIntegrations();
      }

      const metaStatus = params.get('meta');
      if (integrationStatus === 'meta_success' || metaStatus === 'connected') {
        toast.success(`Meta Ads account connected! 🔵`);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        fetchIntegrations();
      } else if (integrationStatus === 'meta_error' || metaStatus === 'error') {
        const errorMsg = params.get('message') || 'Connection failed';
        toast.error(`Meta connection failed: ${errorMsg}`);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        fetchIntegrations();
      }
    }
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

  const handleConnectGoogle = (e) => {
    e.preventDefault();
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    if (!token) {
      toast.error('Please log in to connect Google Ads');
      router.push('/login');
      return;
    }
    const backendBase = API_URL || 'https://api.coresetu.com/api';
    window.location.href = `${backendBase}/integrations/google/oauth?token=${encodeURIComponent(token)}`;
  };

  const handleConnectMeta = (e) => {
    e.preventDefault();
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    if (!token) {
      toast.error('Please log in to connect Meta Ads');
      router.push('/login');
      return;
    }
    // Direct user to AWS backend endpoint which constructs the Meta OAuth URL with its server redirect_uri
    const backendBase = API_URL || 'https://api.coresetu.com/api';
    window.location.href = `${backendBase}/integrations/meta/oauth?token=${encodeURIComponent(token)}`;
  };

  const handleFetchAccounts = async (integrationId) => {
    try {
      setAccountsLoading(true);
      setAccessibleAccounts([]);
      setSelectedAccountId('');
      setConfiguringIntegrationId(integrationId);
      
      const response = await api.get('/integrations/google/accounts', {
        params: { integrationId }
      });
      
      if (response.data && response.data.success) {
        setAccessibleAccounts(response.data.data || []);
        if (response.data.data?.length === 1) {
          const rawAct = response.data.data[0];
          const cleanId = rawAct.replace('customers/', '');
          setSelectedAccountId(cleanId);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to retrieve accessible accounts');
      setConfiguringIntegrationId(null);
    } finally {
      setAccountsLoading(false);
    }
  };

  const handleConfigureAccount = async () => {
    if (!selectedAccountId) {
      toast.error('Please select an account');
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.post('/api/integrations/google/configure', {
        integrationId: configuringIntegrationId,
        accountId: selectedAccountId,
        accountName: `Google Ads (${selectedAccountId})`,
      });
      
      if (response.data && response.data.success) {
        toast.success('Google Ads customer account configured!');
        setConfiguringIntegrationId(null);
        fetchIntegrations();
      }
    } catch (err) {
      // Retry with local route mapping if root prefix fails
      try {
        const fallbackRes = await api.post('/integrations/google/configure', {
          integrationId: configuringIntegrationId,
          accountId: selectedAccountId,
          accountName: `Google Ads (${selectedAccountId})`,
        });
        if (fallbackRes.data && fallbackRes.data.success) {
          toast.success('Google Ads customer account configured!');
          setConfiguringIntegrationId(null);
          fetchIntegrations();
          return;
        }
      } catch (nestedErr) {
        toast.error(nestedErr.response?.data?.message || 'Failed to configure account');
      }
    } finally {
      setLoading(false);
    }
  };

  const metaWebhookUrl = `${API_URL}/integrations/meta/webhook`;
  const googleWebhookUrl = `${API_URL}/integrations/google/webhook`;
  const metaVerifyToken = 'crm_meta_webhook_secret_2026';

  const isMetaConnected = metaIntegrations.length > 0 && metaIntegrations.some(i => i.status === 'connected');
  const isGoogleFullyConnected = googleIntegrations.length > 0 && googleIntegrations.some(i => i.customerId && i.status === 'connected');
  const isGooglePending = googleIntegrations.length > 0 && !isGoogleFullyConnected;

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
                    background: isMetaConnected ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                    color: isMetaConnected ? '#10b981' : 'var(--text-muted)',
                    fontWeight: 700
                  }}>
                    {isMetaConnected ? '🟢 Connected' : '⚪ Ready to Connect'}
                  </span>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
                  Receive instant lead notifications from Facebook & Instagram ad campaigns. Inbound prospects land directly with <strong style={{ color: '#2563eb' }}>🔵 Meta Ads</strong> pill tags, ad set name, and form answers.
                </p>

                {/* Meta Connected Accounts List */}
                {metaIntegrations.map(integration => (
                  <div key={integration._id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {integration.accountName || integration.pageName || `Meta Page (${integration.pageId || integration.accountId})`}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                          Page ID: {integration.pageId || integration.accountId || 'Sandbox Connected'}
                        </p>
                        {integration.connectedAt && (
                          <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
                            Connected: {new Date(integration.connectedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleDisconnectMeta(integration._id)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#dc2626', padding: '4px 8px', minHeight: 0, height: 28 }}
                          title="Disconnect Meta"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                {!isMetaConnected ? (
                  <button
                    type="button"
                    onClick={handleConnectMeta}
                    disabled={loading}
                    className="btn btn-primary btn-sm btn-full"
                    style={{ flex: 1, background: '#2563eb', borderColor: '#2563eb', gap: 5, borderRadius: 8, fontSize: 12, width: '100%', minHeight: 36 }}
                  >
                    <ExternalLink size={12} /> Connect Meta Account
                  </button>
                ) : (
                  <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, color: '#10b981', fontWeight: 700, fontSize: 13 }}>
                    ✅ Meta Connected
                  </div>
                )}
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
                    background: isGoogleFullyConnected ? 'rgba(16,185,129,0.15)' : isGooglePending ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)',
                    color: isGoogleFullyConnected ? '#10b981' : isGooglePending ? '#d97706' : 'var(--text-muted)',
                    fontWeight: 700
                  }}>
                    {isGoogleFullyConnected ? '🟢 Connected' : isGooglePending ? '🟡 Pending Setup' : '⚪ Ready to Connect'}
                  </span>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
                  Capture high-intent leads directly from Google Search ads and asset lead forms. Inbound leads land with <strong style={{ color: '#dc2626' }}>🔴 Google Ads</strong> tags, keyword groups, and campaign names.
                </p>

                {/* Google Ads Integrations List */}
                {googleIntegrations.map(integration => {
                  const isPendingConfig = !integration.customerId;
                  return (
                    <div key={integration._id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {isPendingConfig ? '⚠️ Configuration Required' : (integration.accountName || `Account (${integration.customerId})`)}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                            {isPendingConfig ? 'Please select a Customer Account' : `Customer ID: ${integration.customerId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}`}
                          </p>
                          {integration.lastSyncAt && (
                            <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
                              Last Sync: {new Date(integration.lastSyncAt).toLocaleString()}
                            </p>
                          )}
                          {integration.lastError && (
                            <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#dc2626', fontWeight: 600 }}>
                              Error: {integration.lastError}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleFetchAccounts(integration._id)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: 11, minHeight: 0, height: 28 }}
                          >
                            Manage
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDisconnectGoogle(integration._id)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#dc2626', padding: '4px 8px', minHeight: 0, height: 28 }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Account Selection Panel */}
                {configuringIntegrationId && (
                  <div style={{ background: 'var(--surface)', border: '1.5px solid rgba(220,38,38,0.25)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                    <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      Select Google Ads Account
                    </h3>
                    
                    {accountsLoading ? (
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Loading accessible customer accounts...</p>
                    ) : accessibleAccounts.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>No accessible Google Ads customer accounts found.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        {accessibleAccounts.map(rawAct => {
                          const cleanId = rawAct.replace('customers/', '');
                          const displayId = cleanId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
                          return (
                            <label key={cleanId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', padding: '6px 8px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)' }}>
                              <input
                                type="radio"
                                name="google_customer_id"
                                value={cleanId}
                                checked={selectedAccountId === cleanId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                              />
                              <span>Customer Account ({displayId})</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleConfigureAccount}
                        disabled={loading || !selectedAccountId}
                        className="btn btn-primary btn-sm"
                        style={{ background: '#dc2626', borderColor: '#dc2626', borderRadius: 8, fontSize: 12, padding: '4px 10px', minHeight: 32 }}
                      >
                        Connect Account
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfiguringIntegrationId(null)}
                        className="btn btn-secondary btn-sm"
                        style={{ borderRadius: 8, fontSize: 12, padding: '4px 10px', minHeight: 32 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={loading}
                  className="btn btn-primary btn-sm btn-full"
                  style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626', gap: 5, borderRadius: 8, fontSize: 12, width: '100%', minHeight: 36 }}
                >
                  <ExternalLink size={12} /> {isGoogleFullyConnected ? 'Reconnect Google' : 'Connect Google'}
                </button>
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
                      value={`${API_URL}/leads`}
                      style={{ fontSize: 11, height: 32, fontFamily: 'monospace' }}
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${API_URL}/leads`, 'rest_leads')}
                      className="btn btn-ghost btn-sm"
                      style={{ height: 32, padding: '0 8px' }}
                      title="Copy Endpoint"
                    >
                      {copiedKey === 'rest_leads' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {/* Active Custom Webhooks List */}
                {universalWebhooks.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                    <span style={{ fontSize: 10.5, textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                      Active Custom Ingestions ({universalWebhooks.length})
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto', paddingRight: 2 }}>
                      {universalWebhooks.map((w, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>
                            🔌 {w.name}
                          </span>
                          <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 10, fontWeight: 700 }}>
                            {w.count} leads
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
