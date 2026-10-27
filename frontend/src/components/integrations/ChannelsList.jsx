'use client';

import React from 'react';
import {
  ExternalLink,
  RefreshCw,
  Play,
  Users,
  Sliders,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Key,
  Plus,
  Trash2,
  Code2,
  Activity,
  FileSpreadsheet,
  Globe,
  Zap,
  Terminal
} from 'lucide-react';
import { API_URL } from '@/lib/api';

export default function ChannelsList({
  integrations = [],
  loading = false,
  copiedKey = '',
  copyToClipboard,
  onConnectMeta,
  onReconcileMeta,
  onTestMetaLead,
  onTestGoogleLead,
  onRegenerateKey,
  onDisconnect,
  syncingMetaId,
  testingMetaId,
  testingGoogleId,
  // Modal triggers
  onOpenAssignment,
  onOpenFieldMapping,
  onOpenMetaPageForm,
  onOpenGoogleAdsModal,
  onOpenSheetWizard,
  onOpenSheetStatus,
  onOpenSheetSnippet,
  onOpenWebsiteFormModal,
  onOpenWebsiteSnippet,
  onOpenCustomWebhookModal,
  onOpenCustomSnippet,
}) {
  // Group integrations by provider
  const metaList = integrations.filter((i) => i.provider === 'meta');
  const googleList = integrations.filter((i) => i.provider === 'google');
  const sheetsList = integrations.filter((i) => i.provider === 'sheets');
  const websiteList = integrations.filter((i) => i.provider === 'website');
  const customList = integrations.filter((i) => i.provider === 'custom');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
      {/* ─────────────────────────────────────────────────────────────
          CARD 1: META ADS (FACEBOOK & INSTAGRAM)
         ───────────────────────────────────────────────────────────── */}
      <div
        data-context-type="integration"
        data-context-id={metaList[0]?._id}
        data-context-record={metaList[0] ? JSON.stringify({
          id: metaList[0]._id,
          provider: 'meta',
          accountName: metaList[0].accountName || 'Meta Ads',
          status: metaList[0].status,
        }) : undefined}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderTop: '4px solid #2563eb',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(37,99,235,0.1)',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                🔵
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  Meta Ads (FB & Instagram)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lead Generation & Instant Forms</span>
              </div>
            </div>

            {metaList.length > 0 && metaList[0].status === 'connected' ? (
              <span
                style={{
                  background: 'rgba(16,185,129,0.12)',
                  color: '#10b981',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 9999,
                }}
              >
                Connected
              </span>
            ) : metaList.length > 0 && metaList[0].status === 'needs_reconnect' ? (
              <span
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  color: '#ef4444',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <AlertTriangle size={12} /> Needs Reconnect
              </span>
            ) : (
              <span
                style={{
                  background: 'rgba(100,116,139,0.1)',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 9999,
                }}
              >
                Not Connected
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
            Subscribes directly to Facebook Pages & Instant Forms via Webhooks (Graph API v26.0). Ingests newly submitted leads immediately, with hourly backfill reconciliation.
          </p>

          <div
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <AlertCircle size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              <strong>Development Mode Advisory:</strong> In development mode, only app admins, testers, and developers can submit test leads. Standard Business Verification & App Review are required for public advertiser production.
            </div>
          </div>

          {metaList.length > 0 && (
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Connected Page: {metaList[0].pageName || metaList[0].pageId || 'Default Page'}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Leads captured: {metaList[0].totalLeadsCaptured || 0}</span>
                <span>
                  Last sync: {metaList[0].lastSyncAt ? new Date(metaList[0].lastSyncAt).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          {metaList.length === 0 || metaList[0].status === 'needs_reconnect' ? (
            <button
              onClick={onConnectMeta}
              style={{
                width: '100%',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
              }}
            >
              <ExternalLink size={15} />
              {metaList.length > 0 && metaList[0].status === 'needs_reconnect'
                ? 'Reconnect Meta Ads Account'
                : 'Connect with Meta Ads OAuth'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => onReconcileMeta(metaList[0]._id)}
                  disabled={syncingMetaId === metaList[0]._id}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <RefreshCw size={13} className={syncingMetaId === metaList[0]._id ? 'animate-spin' : ''} />
                  Sync Now
                </button>
                <button
                  onClick={() => onTestMetaLead(metaList[0]._id)}
                  disabled={testingMetaId === metaList[0]._id}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Play size={13} />
                  Test Lead
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => onOpenAssignment(metaList[0])}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Users size={13} />
                  Assignment
                </button>
                <button
                  onClick={() => onOpenFieldMapping(metaList[0])}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Sliders size={13} />
                  Field Map
                </button>
              </div>

              <button
                onClick={() => onOpenMetaPageForm?.(metaList[0])}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  color: '#2563eb',
                }}
              >
                <Sliders size={13} />
                Configure Page & Lead Forms
              </button>

              <button
                onClick={() => onDisconnect(metaList[0]._id, 'Meta Ads')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--rose)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 4,
                  textAlign: 'center',
                }}
              >
                Disconnect Page
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CARD 2: GOOGLE ADS (LEAD FORM ASSETS)
         ───────────────────────────────────────────────────────────── */}
      <div
        data-context-type="integration"
        data-context-id={googleList[0]?._id}
        data-context-record={googleList[0] ? JSON.stringify({
          id: googleList[0]._id,
          provider: 'google',
          accountName: googleList[0].accountName || 'Google Ads',
          status: googleList[0].status,
        }) : undefined}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderTop: '4px solid #ea4335',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(234,67,53,0.1)',
                  color: '#ea4335',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                🔴
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  Google Ads Lead Forms
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lead Form Asset Webhooks</span>
              </div>
            </div>
            {googleList.length > 0 && (
              <span
                style={{
                  background: 'rgba(16,185,129,0.12)',
                  color: '#10b981',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 9999,
                }}
              >
                Active
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Receive inbound submissions from Google Search, Discovery & YouTube lead form extensions in real-time.
          </p>

          <div
            style={{
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <AlertCircle size={15} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              <strong>Google Ads Configuration:</strong> Webhooks are configured per lead form asset at campaign level. Copy the Webhook URL and Webhook Key below into each Google Ads lead form extension asset settings.
            </div>
          </div>

          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                WEBHOOK URL (Paste into Google Ads):
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  readOnly
                  value={`${API_URL}/integrations/google/webhook`}
                  style={{
                    width: '100%',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '5px 8px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: 'var(--text)',
                  }}
                />
                <button
                  onClick={() => copyToClipboard(`${API_URL}/integrations/google/webhook`, 'google_url')}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '0 8px',
                    cursor: 'pointer',
                  }}
                  title="Copy Webhook URL"
                >
                  {copiedKey === 'google_url' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            {googleList.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>WEBHOOK KEY (Stored Hashed):</span>
                  <span style={{ color: '#10b981' }}>{googleList[0].googleKeyPrefix || 'Key active'}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onRegenerateKey(googleList[0]._id, 'Google Ads')}
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Key size={12} /> Regenerate Key
                  </button>
                </div>
              </div>
            )}
          </div>

          {googleList.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {googleList[0].metadata?.lastTestReceivedAt ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: 12, fontWeight: 600 }}>
                  <CheckCircle2 size={14} />
                  Test data verified ({new Date(googleList[0].metadata.lastTestReceivedAt).toLocaleDateString()})
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontSize: 12 }}>
                  <Clock size={14} />
                  Click "Send test data" in Google Ads asset editor to verify
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          {googleList.length === 0 ? (
            <button
              onClick={() => onOpenGoogleAdsModal?.(null)}
              style={{
                width: '100%',
                background: '#ea4335',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 2px 8px rgba(234,67,53,0.25)',
              }}
            >
              <Sliders size={15} /> Setup Google Ads Lead Forms
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => onTestGoogleLead(googleList[0]._id)}
                  disabled={testingGoogleId === googleList[0]._id}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Play size={13} /> Test Lead
                </button>
                <button
                  onClick={() => onOpenAssignment(googleList[0])}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Users size={13} /> Assignment
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => onOpenGoogleAdsModal?.(googleList[0])}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    color: '#ea4335',
                  }}
                >
                  <Code2 size={13} /> Webhook Guide
                </button>
                <button
                  onClick={() => onOpenFieldMapping(googleList[0])}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Sliders size={13} /> Field Map
                </button>
              </div>

              <button
                onClick={() => onDisconnect(googleList[0]._id, 'Google Ads')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--rose)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 4,
                  textAlign: 'center',
                }}
              >
                Disconnect Channel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CARD 3: GOOGLE SHEETS AUTO-SYNC
         ───────────────────────────────────────────────────────────── */}
      <div
        data-context-type="integration"
        data-context-id={sheetsList[0]?._id}
        data-context-record={sheetsList[0] ? JSON.stringify({
          id: sheetsList[0]._id,
          provider: 'sheets',
          accountName: sheetsList[0].accountName || 'Google Sheets',
          status: sheetsList[0].status,
        }) : undefined}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderTop: '4px solid #10b981',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(16,185,129,0.1)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                📊
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  Google Sheets Auto-Sync
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Apps Script Inbound Sweeper</span>
              </div>
            </div>
            <span
              style={{
                background: 'rgba(16,185,129,0.12)',
                color: '#10b981',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 9999,
              }}
            >
              {sheetsList.length} Connected
            </span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Seamlessly sync leads from Google Sheets into your pipeline. Includes Apps Script generator with pre-embedded secret key, synonym column matching, and row status stamps.
          </p>

          {sheetsList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {sheetsList.map((sheet) => (
                <div
                  key={sheet._id}
                  style={{
                    background: 'var(--bg)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {sheet.accountName || 'Google Sheet'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Captured: <strong className="text-emerald-600">{sheet.totalLeadsCaptured || 0}</strong> leads
                      {sheet.lastSyncAt && (
                        <span> • {new Date(sheet.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => onOpenSheetStatus(sheet)}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#10b981',
                        fontWeight: 600,
                      }}
                      title="View Real-Time Sync Status"
                    >
                      <Activity size={12} /> Status
                    </button>
                    <button
                      onClick={() => onOpenSheetSnippet(sheet)}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="View Apps Script"
                    >
                      <Code2 size={12} /> Script
                    </button>
                    <button
                      onClick={() => onOpenAssignment(sheet)}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                      title="Assignment Rules"
                    >
                      <Users size={12} />
                    </button>
                    <button
                      onClick={() => onDisconnect(sheet._id, 'Google Sheet')}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        color: 'var(--rose)',
                        cursor: 'pointer',
                      }}
                      title="Disconnect Sheet"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                background: 'var(--bg)',
                borderRadius: 10,
                padding: 16,
                textAlign: 'center',
                marginBottom: 16,
                color: 'var(--text-muted)',
                fontSize: 12,
              }}
            >
              No Google Sheets connected yet. Launch the step-by-step setup wizard below.
            </div>
          )}
        </div>

        <div>
          <button
            onClick={onOpenSheetWizard}
            style={{
              width: '100%',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
            }}
          >
            <Plus size={15} /> Launch Google Sheets Setup Wizard
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CARD 4: WEBSITE FORMS & LANDING PAGES
         ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderTop: '4px solid #6366f1',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(99,102,241,0.1)',
                  color: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                🌐
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  Website Inbound Forms
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>CORS & Honeypot Secured Embed</span>
              </div>
            </div>
            <span
              style={{
                background: 'rgba(99,102,241,0.12)',
                color: '#6366f1',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 9999,
              }}
            >
              {websiteList.length} Endpoints
            </span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Embed clean HTML lead capture forms on WordPress, Webflow, React, or landing pages. Protected by spam honeypots and IP rate limiting (30 requests/10 min).
          </p>

          {websiteList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {websiteList.map((form) => (
                <div
                  key={form._id}
                  style={{
                    background: 'var(--bg)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {form.accountName || 'Website Form'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Captured: <strong className="text-indigo-600">{form.totalLeadsCaptured || 0}</strong> leads
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => onOpenWebsiteSnippet(form)}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="View Embed Code"
                    >
                      <Code2 size={12} /> Embed Code
                    </button>
                    <button
                      onClick={() => onOpenAssignment(form)}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                      title="Assignment Rules"
                    >
                      <Users size={12} />
                    </button>
                    <button
                      onClick={() => onDisconnect(form._id, 'Website Form')}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        color: 'var(--rose)',
                        cursor: 'pointer',
                      }}
                      title="Disconnect Form"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                background: 'var(--bg)',
                borderRadius: 10,
                padding: 16,
                textAlign: 'center',
                marginBottom: 16,
                color: 'var(--text-muted)',
                fontSize: 12,
              }}
            >
              No website endpoints created yet. Click below to generate an embeddable snippet.
            </div>
          )}
        </div>

        <div>
          <button
            onClick={onOpenWebsiteFormModal}
            style={{
              width: '100%',
              background: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
            }}
          >
            <Plus size={15} /> Create Website Form Endpoint
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CARD 5: CUSTOM WEBHOOK (ZAPIER, MAKE, CUSTOM APIS)
         ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderTop: '4px solid #a855f7',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(168,85,247,0.1)',
                  color: '#a855f7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                ⚡
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  Custom Webhooks & Zapier
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Arbitrary JSON Ingestion Pipeline</span>
              </div>
            </div>
            <span
              style={{
                background: 'rgba(168,85,247,0.12)',
                color: '#a855f7',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 9999,
              }}
            >
              {customList.length} Connected
            </span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Ingest leads from Zapier, Make, n8n, Typeform, or custom backend services with Bearer token authentication, losslessly preserving all custom answers.
          </p>

          {customList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {customList.map((endpoint) => (
                <div
                  key={endpoint._id}
                  style={{
                    background: 'var(--bg)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {endpoint.accountName || 'Custom Webhook'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Captured: <strong className="text-purple-600">{endpoint.totalLeadsCaptured || 0}</strong> leads
                      <span className="font-mono ml-2 text-[10px] bg-[var(--card)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                        {endpoint.googleKeyPrefix || 'Bearer token active'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => onOpenCustomSnippet(endpoint)}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="View cURL and JSON payload format"
                    >
                      <Terminal size={12} /> cURL / Test
                    </button>
                    <button
                      onClick={() => onOpenAssignment(endpoint)}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                      title="Assignment Rules"
                    >
                      <Users size={12} />
                    </button>
                    <button
                      onClick={() => onDisconnect(endpoint._id, 'Custom Webhook')}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 11,
                        color: 'var(--rose)',
                        cursor: 'pointer',
                      }}
                      title="Disconnect Webhook"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                background: 'var(--bg)',
                borderRadius: 10,
                padding: 16,
                textAlign: 'center',
                marginBottom: 16,
                color: 'var(--text-muted)',
                fontSize: 12,
              }}
            >
              No custom webhooks configured. Click below to generate an ingestion endpoint for Zapier, Make, or custom APIs.
            </div>
          )}
        </div>

        <div>
          <button
            onClick={onOpenCustomWebhookModal}
            style={{
              width: '100%',
              background: '#a855f7',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(168,85,247,0.25)',
            }}
          >
            <Plus size={15} /> Create Custom Webhook Endpoint
          </button>
        </div>
      </div>
    </div>
  );
}
