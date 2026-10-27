'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api, { API_URL } from '@/lib/api';
import { getUser, isSuperAdmin, isOwner, isManager, hasPermission } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Zap,
  ArrowLeft,
  RefreshCw,
  Activity,
  BarChart2,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  X
} from 'lucide-react';

// Modular Subcomponents
import ChannelsList from '@/components/integrations/ChannelsList';
import SourcesCampaignReport from '@/components/integrations/SourcesCampaignReport';
import GoogleSheetsWizard from '@/components/integrations/GoogleSheetsWizard';
import SheetStatusDrawer from '@/components/integrations/SheetStatusDrawer';
import CustomWebhookModal from '@/components/integrations/CustomWebhookModal';
import WebsiteFormModal from '@/components/integrations/WebsiteFormModal';
import AssignmentDrawer from '@/components/integrations/AssignmentDrawer';
import AuditLogTable from '@/components/integrations/AuditLogTable';
import MetaPageFormModal from '@/components/integrations/MetaPageFormModal';
import GoogleAdsModal from '@/components/integrations/GoogleAdsModal';
import SubscriptionsList from '@/components/integrations/SubscriptionsList';
import { Layers } from 'lucide-react';

export default function IntegrationsPage() {
  const router = useRouter();

  // Role & Authentication Guard States
  const [authStatus, setAuthStatus] = useState('checking'); // 'checking' | 'authorized' | 'unauthorized' | 'unauthenticated'
  const [currentUser, setCurrentUser] = useState(null);

  // Primary data states
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [activeTab, setActiveTab] = useState('channels'); // 'channels' | 'sources_report' | 'audit_log'
  const [members, setMembers] = useState([]);

  // Inbound Webhook Events (Audit Log)
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventFilter, setEventFilter] = useState('all'); // 'all' | 'failed' | 'dead_letter' | 'completed'
  const [retryingEventId, setRetryingEventId] = useState(null);

  // Modals & Drawers state
  const [sheetWizardOpen, setSheetWizardOpen] = useState(false);
  const [sheetStatusIntegration, setSheetStatusIntegration] = useState(null);
  const [customWebhookModalOpen, setCustomWebhookModalOpen] = useState(false);
  const [websiteFormModalOpen, setWebsiteFormModalOpen] = useState(false);
  const [assignmentIntegration, setAssignmentIntegration] = useState(null);
  const [fieldMappingIntegration, setFieldMappingIntegration] = useState(null);
  const [snippetModalData, setSnippetModalData] = useState(null); // { type, title, code, secret, integration }
  const [metaPageFormModalIntegration, setMetaPageFormModalIntegration] = useState(null);
  const [googleAdsModalIntegration, setGoogleAdsModalIntegration] = useState(null);
  const [googleAdsModalOpen, setGoogleAdsModalOpen] = useState(false);

  // Action states
  const [testingGoogleId, setTestingGoogleId] = useState(null);
  const [testingMetaId, setTestingMetaId] = useState(null);
  const [syncingMetaId, setSyncingMetaId] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');

  // ─────────────────────────────────────────────────────────────
  // 1. DATA FETCHING
  // ─────────────────────────────────────────────────────────────

  const fetchIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);
      const res = await api.get('/integrations');
      const list = res.data?.integrations || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setIntegrations(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Fetch integrations error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Unable to connect to integration backend';
      setApiError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await api.get('/workspace/members');
      if (res.data?.members && Array.isArray(res.data.members)) {
        setMembers(res.data.members.filter((m) => m.status !== 'inactive'));
      }
    } catch (err) {
      const u = getUser();
      if (u) {
        setMembers([{ userId: u._id, name: u.name, email: u.email, role: 'owner' }]);
      }
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      const params = {};
      if (eventFilter !== 'all') params.status = eventFilter;
      const res = await api.get('/integrations/events', { params });
      if (res.data?.events) {
        setEvents(res.data.events);
      }
    } catch (err) {
      console.error('Fetch webhook events error:', err);
    } finally {
      setEventsLoading(false);
    }
  }, [eventFilter]);

  useEffect(() => {
    const checkAuth = () => {
      const user = getUser();
      setCurrentUser(user);
      if (!user) {
        setAuthStatus('unauthenticated');
        router.replace('/login');
        return;
      }

      const canManage = isSuperAdmin(user) || isOwner(user) || isManager(user) || hasPermission(user, 'integrations.manage');
      if (!canManage) {
        setAuthStatus('unauthorized');
        return;
      }

      setAuthStatus('authorized');
      fetchIntegrations();
      fetchMembers();
    };

    checkAuth();
    window.addEventListener('user-updated', checkAuth);

    // Check OAuth return params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const metaStatus = params.get('meta');
      const integrationStatus = params.get('integration');

      if (integrationStatus === 'meta_success' || metaStatus === 'connected') {
        toast.success('Meta Ads account connected successfully! 🔵');
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchIntegrations();
      } else if (integrationStatus === 'meta_error' || metaStatus === 'error') {
        const errorMsg = params.get('message') || 'Connection failed';
        toast.error(`Meta connection failed: ${errorMsg}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    return () => {
      window.removeEventListener('user-updated', checkAuth);
    };
  }, [fetchIntegrations, fetchMembers, router]);

  useEffect(() => {
    if (activeTab === 'audit_log') {
      fetchEvents();
    }
  }, [activeTab, fetchEvents]);


  // ─────────────────────────────────────────────────────────────
  // 2. CLIPBOARD & UTILITY
  // ─────────────────────────────────────────────────────────────

  const copyToClipboard = async (text, key) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedKey(key);
      toast.success('Copied to clipboard! 📋');
      setTimeout(() => setCopiedKey(''), 2500);
    } catch (err) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedKey(key);
        toast.success('Copied to clipboard! 📋');
        setTimeout(() => setCopiedKey(''), 2500);
      } catch (e) {
        toast.error('Failed to copy. Please select and copy manually.');
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 3. CHANNEL ACTIONS
  // ─────────────────────────────────────────────────────────────

  const handleConnectMeta = async () => {
    try {
      setLoading(true);
      const res = await api.get('/integrations/meta/oauth');
      if (res.data?.authorizationUrl) {
        window.location.href = res.data.authorizationUrl;
      } else {
        toast.error('Unable to initialize Meta OAuth session');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Meta OAuth initiation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcileMeta = async (integrationId) => {
    try {
      setSyncingMetaId(integrationId);
      const res = await api.post(`/integrations/meta/sync/${integrationId}`);
      if (res.data?.success) {
        toast.success(`Meta sync completed! Enqueued: ${res.data.enqueuedCount || 0} unseen leads.`);
        fetchIntegrations();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Manual reconciliation failed');
    } finally {
      setSyncingMetaId(null);
    }
  };

  const handleTestMetaLead = async (integrationId) => {
    try {
      setTestingMetaId(integrationId);
      await api.post('/integrations/meta/test', {
        integrationId,
        name: 'Priya Sharma (Meta Test)',
        phone: '919876543210',
        email: 'priya.sharma@meta-ads.example.com',
        formName: 'Meta Instant Form',
        campaignName: 'Instagram Summer Campaign 2026',
      });
      toast.success('Test Meta Lead injected into pipeline! 🔵');
      fetchIntegrations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to inject test Meta lead');
    } finally {
      setTestingMetaId(null);
    }
  };

  const handleTestGoogleLead = async (integrationId) => {
    try {
      setTestingGoogleId(integrationId);
      await api.post('/integrations/google/test', {
        integrationId,
        name: 'Rahul Varma (Google Search Test)',
        phone: '919812345678',
        email: 'rahul.varma@google-ads.example.com',
        campaignName: 'High Intent Engineering Keywords',
        adGroupName: 'B.Tech Colleges India',
        formName: 'Lead Form Asset',
      });
      toast.success('Test Google Lead injected into pipeline! 🔴');
      fetchIntegrations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to inject test Google lead');
    } finally {
      setTestingGoogleId(null);
    }
  };

  const handleRegenerateKey = async (integrationId, providerName) => {
    if (!window.confirm(`Revoke current ${providerName} secret key and generate a new one? Existing webhooks will fail until updated.`)) {
      return;
    }
    try {
      const res = await api.post(`/integrations/${integrationId}/regenerate-key`);
      if (res.data?.success) {
        toast.success('Secret key regenerated successfully!');
        setSnippetModalData({
          type: 'secret_regenerated',
          title: `New ${providerName} Secret Key`,
          secret: res.data.plaintextSecretOnce,
          integration: res.data.integration,
        });
        fetchIntegrations();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to regenerate key');
    }
  };

  const handleDisconnect = async (id, provider) => {
    if (!window.confirm(`Are you sure you want to disconnect this ${provider.toUpperCase()} integration? Inbound leads will be rejected.`)) {
      return;
    }
    try {
      await api.delete(`/integrations/${id}`);
      toast.success('Integration disconnected.');
      fetchIntegrations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to disconnect');
    }
  };

  const handleViewSheetSnippet = async (integration) => {
    try {
      const res = await api.get(`/integrations/${integration._id}/snippet`);
      setSnippetModalData({
        type: 'sheets_script',
        title: `Google Apps Script Auto-Sync Code (${integration.accountName || 'Google Sheet'})`,
        code: res.data?.snippet || '',
        integration,
      });
    } catch (err) {
      toast.error('Failed to load Apps Script snippet');
    }
  };

  const handleViewWebsiteSnippet = async (integration) => {
    try {
      const res = await api.get(`/integrations/${integration._id}/snippet`);
      setSnippetModalData({
        type: 'form_snippet',
        title: `HTML & JavaScript Embed Code (${integration.accountName || 'Website Form'})`,
        code: res.data?.snippet || '',
        integration,
      });
    } catch (err) {
      toast.error('Failed to load website embed snippet');
    }
  };

  const handleViewCustomSnippet = async (integration) => {
    try {
      const res = await api.get(`/integrations/${integration._id}/snippet`);
      setSnippetModalData({
        type: 'custom_snippet',
        title: `Custom Webhook Ingestion API (${integration.accountName || 'Webhook Endpoint'})`,
        code: res.data?.snippet || '',
        integration,
      });
    } catch (err) {
      toast.error('Failed to load custom webhook snippet');
    }
  };

  const handleRetryEvent = async (eventId) => {
    try {
      setRetryingEventId(eventId);
      const res = await api.post(`/integrations/events/${eventId}/retry`);
      if (res.data?.success) {
        toast.success('Webhook event re-queued for immediate processing! ⚡');
        fetchEvents();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to re-drive event');
    } finally {
      setRetryingEventId(null);
    }
  };

  useEffect(() => {
    const handleContextAction = async (e) => {
      const { action, payload } = e.detail || {};
      const targetInt = payload?.id ? integrations.find((i) => String(i._id) === String(payload.id)) : null;

      if (action === 'OPEN_INTEGRATION_SETTINGS') {
        if (targetInt?.provider === 'meta') {
          setMetaPageFormModalIntegration(targetInt);
        } else if (targetInt?.provider === 'google') {
          setGoogleAdsModalIntegration(targetInt);
          setGoogleAdsModalOpen(true);
        } else if (targetInt?.provider === 'sheets') {
          setFieldMappingIntegration(targetInt);
        } else if (targetInt) {
          setAssignmentIntegration(targetInt);
        }
      } else if (action === 'TEST_INTEGRATION') {
        if (targetInt?.provider === 'meta') {
          handleTestMetaLead(targetInt._id);
        } else if (targetInt?.provider === 'google') {
          handleTestGoogleLead(targetInt._id);
        } else if (targetInt?.provider === 'sheets') {
          setSheetStatusIntegration(targetInt);
        } else {
          toast.success('Integration connection active');
        }
      } else if (action === 'VIEW_INTEGRATION_LOGS') {
        setActiveTab('audit_log');
      } else if (action === 'RECONNECT_INTEGRATION') {
        if (targetInt?.provider === 'meta') {
          handleConnectMeta();
        } else if (targetInt?.provider === 'sheets') {
          setSheetWizardOpen(true);
        }
      } else if (action === 'DISCONNECT_INTEGRATION') {
        if (targetInt) {
          handleDisconnect(targetInt._id, targetInt.accountName || targetInt.provider);
        }
      }
    };

    window.addEventListener('crm-context-action', handleContextAction);
    return () => window.removeEventListener('crm-context-action', handleContextAction);
  }, [integrations, handleTestMetaLead, handleTestGoogleLead, handleConnectMeta, handleDisconnect]);

  // Metrics
  const totalCaptured = integrations.reduce((acc, curr) => acc + (curr.totalLeadsCaptured || 0), 0);
  const degradedCount = events.filter((e) => e.status === 'failed' || e.status === 'dead_letter').length;

  // ─────────────────────────────────────────────────────────────
  // RENDER GUARDS
  // ─────────────────────────────────────────────────────────────

  if (authStatus === 'checking') {
    return (
      <div className="app-shell flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={26} className="animate-spin text-indigo-600" />
          <p className="text-xs text-[var(--text-muted)] font-medium">Verifying workspace permissions...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthorized') {
    return (
      <div className="app-shell pb-mobile-nav">
        <div className="max-w-lg mx-auto py-20 px-4 text-center">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Shield size={30} />
            </div>
            <h1 className="text-xl font-bold text-[var(--text)] mb-2">Admin Access Required</h1>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto mb-6 leading-relaxed">
              Lead integration channels, secret keys, and webhook credentials are restricted strictly to{' '}
              <strong>Workspace Administrators and Owners</strong>.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold"
            >
              <ArrowLeft size={14} /> Return to Dashboard
            </Link>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="app-shell pb-mobile-nav" data-crm-canvas="true">
      <div className="page-container max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-5">
        {/* Header & View Switcher */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] p-2 rounded-xl flex items-center justify-center hover:bg-[var(--bg)] transition-colors"
              aria-label="Go Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-[var(--text)] m-0">Automated Lead Ingestion Engine</h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                  Graph API v26.0 Ready
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] m-1 0 0">
                Zero-drop webhooks, lossless 64-bit ID ingestion, campaign attribution & fair round-robin routing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Switcher Tabs */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-1 flex gap-1">
              <button
                onClick={() => setActiveTab('channels')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'channels'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Zap size={14} /> Channels ({integrations.length})
              </button>

              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'subscriptions'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Layers size={14} /> Lead Sources & Routing
              </button>

              <button
                onClick={() => setActiveTab('sources_report')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'sources_report'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <BarChart2 size={14} /> Source & Campaign Report
              </button>

              <button
                onClick={() => setActiveTab('audit_log')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'audit_log'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Activity size={14} /> Audit Log
                {degradedCount > 0 && (
                  <span className="bg-rose-500 text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold">
                    {degradedCount}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={() => {
                fetchIntegrations();
                if (activeTab === 'audit_log') fetchEvents();
              }}
              disabled={loading || eventsLoading}
              className="p-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
              title="Refresh Channels"
            >
              <RefreshCw size={14} className={loading || eventsLoading ? 'animate-spin text-indigo-600' : ''} />
            </button>
          </div>
        </div>

        {/* Receiver Status Hero Banner */}
        <div className="bg-gradient-to-r from-indigo-50/40 via-emerald-50/20 to-purple-50/30 border border-indigo-100 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text)] m-0">Persistent Queue & Deduplication Engine Online ⚡</h2>
              <p className="text-xs text-[var(--text-muted)] m-0.5 0 0">
                Inbound leads are persisted with an immediate 200 OK, deduplicated by phone/email/UUID, and assigned in Stage 1.
              </p>
            </div>
          </div>

          <div className="flex gap-4 sm:border-l sm:border-[var(--border)] sm:pl-4">
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Total Ingested</span>
              <div className="text-lg font-black text-[var(--text)]">{totalCaptured.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Active Channels</span>
              <div className="text-lg font-black text-emerald-600">
                {integrations.filter((i) => i.status === 'connected').length}
              </div>
            </div>
          </div>
        </div>

        {/* API Error Banner */}
        {apiError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle size={16} />
              <span>{apiError}</span>
            </div>
            <button
              onClick={fetchIntegrations}
              className="bg-rose-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-rose-700 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ACTIVE TAB CONTENT
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'channels' && (
          <ChannelsList
            integrations={integrations}
            loading={loading}
            copiedKey={copiedKey}
            copyToClipboard={copyToClipboard}
            onConnectMeta={handleConnectMeta}
            onReconcileMeta={handleReconcileMeta}
            onTestMetaLead={handleTestMetaLead}
            onTestGoogleLead={handleTestGoogleLead}
            onRegenerateKey={handleRegenerateKey}
            onDisconnect={handleDisconnect}
            syncingMetaId={syncingMetaId}
            testingMetaId={testingMetaId}
            testingGoogleId={testingGoogleId}
            onOpenAssignment={(integration) => setAssignmentIntegration(integration)}
            onOpenFieldMapping={(integration) => setFieldMappingIntegration(integration)}
            onOpenMetaPageForm={(integration) => setMetaPageFormModalIntegration(integration)}
            onOpenGoogleAdsModal={(integration) => {
              setGoogleAdsModalIntegration(integration || null);
              setGoogleAdsModalOpen(true);
            }}
            onOpenSheetWizard={() => setSheetWizardOpen(true)}
            onOpenSheetStatus={(integration) => setSheetStatusIntegration(integration)}
            onOpenSheetSnippet={handleViewSheetSnippet}
            onOpenWebsiteFormModal={() => setWebsiteFormModalOpen(true)}
            onOpenWebsiteSnippet={handleViewWebsiteSnippet}
            onOpenCustomWebhookModal={() => setCustomWebhookModalOpen(true)}
            onOpenCustomSnippet={handleViewCustomSnippet}
          />
        )}

        {activeTab === 'subscriptions' && (
          <SubscriptionsList />
        )}

        {activeTab === 'sources_report' && (
          <SourcesCampaignReport
            onSelectCampaignForFilter={(camp) => {
              router.push(`/leads?platform=${camp.platform}&campaignName=${encodeURIComponent(camp.campaignName)}`);
            }}
          />
        )}

        {activeTab === 'audit_log' && (
          <AuditLogTable
            events={events}
            eventsLoading={eventsLoading}
            eventFilter={eventFilter}
            setEventFilter={setEventFilter}
            onRetryEvent={handleRetryEvent}
            retryingEventId={retryingEventId}
          />
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          GLOBAL MODALS & DRAWERS
         ───────────────────────────────────────────────────────────── */}

      {/* 1. Google Sheets Step-by-Step Setup Wizard */}
      {sheetWizardOpen && (
        <GoogleSheetsWizard
          isOpen={sheetWizardOpen}
          members={members}
          onClose={() => setSheetWizardOpen(false)}
          onSuccess={() => {
            setSheetWizardOpen(false);
            fetchIntegrations();
          }}
        />
      )}

      {/* 2. Real-Time Google Sheet Status Drawer */}
      {sheetStatusIntegration && (
        <SheetStatusDrawer
          isOpen={Boolean(sheetStatusIntegration)}
          integration={sheetStatusIntegration}
          onClose={() => setSheetStatusIntegration(null)}
          onRefreshStatus={() => {
            fetchIntegrations();
          }}
        />
      )}

      {/* 3. Custom Webhook Setup Modal */}
      {customWebhookModalOpen && (
        <CustomWebhookModal
          isOpen={customWebhookModalOpen}
          members={members}
          onClose={() => setCustomWebhookModalOpen(false)}
          onSuccess={() => {
            setCustomWebhookModalOpen(false);
            fetchIntegrations();
          }}
        />
      )}

      {/* 4. Website Form Endpoint Modal */}
      {websiteFormModalOpen && (
        <WebsiteFormModal
          isOpen={websiteFormModalOpen}
          members={members}
          onClose={() => setWebsiteFormModalOpen(false)}
          onSuccess={() => {
            setWebsiteFormModalOpen(false);
            fetchIntegrations();
          }}
        />
      )}

      {/* 5. Team Assignment Rules Drawer */}
      {assignmentIntegration && (
        <AssignmentDrawer
          isOpen={Boolean(assignmentIntegration)}
          integration={assignmentIntegration}
          members={members}
          onClose={() => setAssignmentIntegration(null)}
          onSaveSuccess={() => {
            setAssignmentIntegration(null);
            fetchIntegrations();
          }}
          onSaved={() => {
            setAssignmentIntegration(null);
            fetchIntegrations();
          }}
        />
      )}

      {/* 6. Field Mapping & "Where Will Data Go?" Drawer */}
      {fieldMappingIntegration && (
        <FieldMappingDrawer
          isOpen={Boolean(fieldMappingIntegration)}
          integration={fieldMappingIntegration}
          onClose={() => setFieldMappingIntegration(null)}
          onSaveSuccess={() => {
            setFieldMappingIntegration(null);
            fetchIntegrations();
          }}
          onSaved={() => {
            setFieldMappingIntegration(null);
            fetchIntegrations();
          }}
        />
      )}

      {/* 7. Meta Facebook Page & Lead Form Selection Modal */}
      {metaPageFormModalIntegration && (
        <MetaPageFormModal
          isOpen={Boolean(metaPageFormModalIntegration)}
          integration={metaPageFormModalIntegration}
          onClose={() => setMetaPageFormModalIntegration(null)}
          onSuccess={() => {
            setMetaPageFormModalIntegration(null);
            fetchIntegrations();
          }}
          onReconnect={handleConnectMeta}
        />
      )}

      {/* 8. Google Ads 5-Step Guided Setup Modal */}
      {googleAdsModalOpen && (
        <GoogleAdsModal
          isOpen={googleAdsModalOpen}
          integration={googleAdsModalIntegration}
          members={members}
          onClose={() => {
            setGoogleAdsModalOpen(false);
            setGoogleAdsModalIntegration(null);
          }}
          onSuccess={() => {
            fetchIntegrations();
          }}
        />
      )}

      {/* 9. Code Snippet & Plaintext Secret Modal */}
      {snippetModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[var(--text)] m-0">{snippetModalData.title}</h3>
              <button
                onClick={() => setSnippetModalData(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Plaintext Secret Alert (Shown Once) */}
            {snippetModalData.secret && (
              <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 mb-4">
                <div className="text-xs font-bold text-rose-700 mb-2 flex items-center gap-1.5">
                  <Shield size={14} /> COPY THIS KEY NOW (It will not be displayed again):
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={snippetModalData.secret}
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs font-mono font-bold text-[var(--text)]"
                  />
                  <button
                    onClick={() => copyToClipboard(snippetModalData.secret, 'secret_once')}
                    className="bg-rose-600 text-white rounded-lg px-4 py-2 text-xs font-semibold hover:bg-rose-700 transition-colors"
                  >
                    {copiedKey === 'secret_once' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-2">
                  This key is hashed using SHA-256 in our database. If lost, you can regenerate a new key at any time.
                </div>
              </div>
            )}

            {/* Code / Snippet Content */}
            {snippetModalData.code && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    Copy & Paste into your platform:
                  </span>
                  <button
                    onClick={() => copyToClipboard(snippetModalData.code, 'snippet_code')}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    {copiedKey === 'snippet_code' ? <Check size={13} /> : <Copy size={13} />}
                    {copiedKey === 'snippet_code' ? 'Copied' : 'Copy Code'}
                  </button>
                </div>

                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
                  {snippetModalData.code}
                </pre>
              </div>
            )}

            <div className="mt-5 text-right">
              <button
                onClick={() => setSnippetModalData(null)}
                className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text)] hover:bg-[var(--card)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
