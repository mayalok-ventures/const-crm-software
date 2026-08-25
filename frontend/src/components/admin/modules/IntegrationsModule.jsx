'use client';

import React, { useState } from 'react';
import { Radio, CheckCircle2, XCircle, Key, RefreshCw, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import ErrorState from '../ui/ErrorState';

export default function IntegrationsModule({
  integrationStatus = {},
  loading = false,
  error = null,
  onRetry,
  onSaveCredentials,
  onTestWebhook,
}) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // 'meta' | 'google' | 'generic'
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [saving, setSaving] = useState(false);

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveMeta = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (onSaveCredentials) {
        await onSaveCredentials('META', {
          appId: metaAppId,
          appSecret: metaAppSecret,
          accessToken: metaAccessToken,
        });
        setActiveModal(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGoogle = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (onSaveCredentials) {
        await onSaveCredentials('GOOGLE', {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        });
        setActiveModal(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const metaData = integrationStatus?.meta || {};
  const googleData = integrationStatus?.google || {};
  const waData = integrationStatus?.whatsapp || {};
  const genericData = integrationStatus?.webhook || {};

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            External Ingestion & API Integration Hub
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Connect Meta Ads, Google Ads Webhooks, and WhatsApp for live lead synchronization
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-semibold">AES-256 Encrypted</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Meta Lead Ads */}
        <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📘</span>
                <h4 className="font-bold text-white text-xs uppercase">Meta / Facebook Lead Ads</h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  metaData.status === 'CONNECTED'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                }`}
              >
                {metaData.status || 'DISCONNECTED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Auto-ingest leads from Instagram and Facebook Instant Forms into Sahyak pipeline with real-time attribution.
            </p>

            <div className="mt-3 space-y-2 text-[11px] bg-slate-900/60 p-3 rounded-lg border border-slate-800 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Webhook URL:</span>
                <button
                  onClick={() => handleCopy(metaData.webhookUrl || 'https://api.sahyak.com/api/integrations/meta/webhook', 'metaUrl')}
                  className="text-amber-400 hover:text-white flex items-center gap-1"
                >
                  {copiedKey === 'metaUrl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy</span>
                </button>
              </div>
              <div className="text-slate-300 truncate">{metaData.webhookUrl || 'https://api.sahyak.com/api/integrations/meta/webhook'}</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
            <button
              onClick={() => setActiveModal('meta')}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors"
            >
              Configure Credentials
            </button>
            {onTestWebhook && (
              <button
                onClick={() => onTestWebhook('META')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                Send Test Lead
              </button>
            )}
          </div>
        </div>

        {/* 2. Google Ads Lead Forms */}
        <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔴</span>
                <h4 className="font-bold text-white text-xs uppercase">Google Ads Lead Webhook</h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  googleData.status === 'CONNECTED'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                }`}
              >
                {googleData.status || 'DISCONNECTED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Capture leads submitted on Google Search, YouTube, and Discovery lead extension forms.
            </p>

            <div className="mt-3 space-y-2 text-[11px] bg-slate-900/60 p-3 rounded-lg border border-slate-800 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Webhook Endpoint:</span>
                <button
                  onClick={() => handleCopy(googleData.webhookUrl || 'https://api.sahyak.com/api/integrations/google/webhook', 'googleUrl')}
                  className="text-amber-400 hover:text-white flex items-center gap-1"
                >
                  {copiedKey === 'googleUrl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy</span>
                </button>
              </div>
              <div className="text-slate-300 truncate">{googleData.webhookUrl || 'https://api.sahyak.com/api/integrations/google/webhook'}</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
            <button
              onClick={() => setActiveModal('google')}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors"
            >
              Configure API Key
            </button>
            {onTestWebhook && (
              <button
                onClick={() => onTestWebhook('GOOGLE')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                Send Test Lead
              </button>
            )}
          </div>
        </div>

        {/* 3. WhatsApp Business */}
        <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <h4 className="font-bold text-white text-xs uppercase">WhatsApp Business Bridge</h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  waData.status === 'CONNECTED'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                }`}
              >
                {waData.status || 'DISCONNECTED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Real-time messaging session for multi-agent template broadcasts and 1-on-1 customer conversations.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Session Status: <strong className="text-white">{waData.status || 'DISCONNECTED'}</strong>
            </span>
            <button
              onClick={onRetry}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-colors"
            >
              Check Socket
            </button>
          </div>
        </div>

        {/* 4. Generic Webhook API */}
        <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <h4 className="font-bold text-white text-xs uppercase">Generic Inbound Webhook</h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Send JSON payloads from WordPress, Zapier, Webflow, or Make directly to ingest leads into Sahyak CRM.
            </p>

            <div className="mt-3 space-y-2 text-[11px] bg-slate-900/60 p-3 rounded-lg border border-slate-800 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">POST Endpoint:</span>
                <button
                  onClick={() => handleCopy(genericData.webhookUrl || 'https://api.sahyak.com/api/integrations/generic/webhook', 'genericUrl')}
                  className="text-amber-400 hover:text-white flex items-center gap-1"
                >
                  {copiedKey === 'genericUrl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy</span>
                </button>
              </div>
              <div className="text-slate-300 truncate">{genericData.webhookUrl || 'https://api.sahyak.com/api/integrations/generic/webhook'}</div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-end">
            {onTestWebhook && (
              <button
                onClick={() => onTestWebhook('GENERIC')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                Send Test JSON
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Meta Modal */}
      {activeModal === 'meta' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0b101d] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Configure Meta App Credentials</h3>
            <form onSubmit={handleSaveMeta} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Meta App ID</label>
                <input
                  type="text"
                  value={metaAppId}
                  onChange={(e) => setMetaAppId(e.target.value)}
                  placeholder="e.g. 123456789012345"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Meta App Secret</label>
                <input
                  type="password"
                  value={metaAppSecret}
                  onChange={(e) => setMetaAppSecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Page Access Token</label>
                <input
                  type="password"
                  value={metaAccessToken}
                  onChange={(e) => setMetaAccessToken(e.target.value)}
                  placeholder="EAAG..."
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs"
                >
                  {saving ? 'Encrypting...' : 'Save Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Modal */}
      {activeModal === 'google' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0b101d] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Configure Google Ads Webhook Key</h3>
            <form onSubmit={handleSaveGoogle} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Google Client Key / ID</label>
                <input
                  type="text"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="e.g. google_lead_key_2026"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Secret Key Token</label>
                <input
                  type="password"
                  value={googleClientSecret}
                  onChange={(e) => setGoogleClientSecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs"
                >
                  {saving ? 'Encrypting...' : 'Save Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
