'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api, { API_URL } from '@/lib/api';
import {
  Globe,
  Key,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Play,
  Users,
  Sliders,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Clock
} from 'lucide-react';

export default function GoogleAdsModal({
  isOpen = false,
  integration,
  members = [],
  onClose,
  onSuccess,
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [createdIntegration, setCreatedIntegration] = useState(null);
  const [webhookKey, setWebhookKey] = useState('');

  // Form states
  const [accountName, setAccountName] = useState('Google Ads Inbound');
  const [defaultCampaign, setDefaultCampaign] = useState('Google Search Leads');
  const [assignmentType, setAssignmentType] = useState('round_robin');
  const [specificCounselorId, setSpecificCounselorId] = useState('');
  const [fallbackUserId, setFallbackUserId] = useState('');

  // Compute public webhook URL
  const publicWebhookUrl = `${API_URL}/integrations/google/webhook`;

  useEffect(() => {
    if (!isOpen) return;

    if (integration) {
      setCreatedIntegration(integration);
      setAccountName(integration.accountName || 'Google Ads Inbound');
      setDefaultCampaign(integration.metadata?.defaultCampaignLabel || 'Google Search Leads');
      setAssignmentType(integration.assignmentRule?.type || 'round_robin');
      setSpecificCounselorId(integration.assignmentRule?.specificCounselorId || '');
      setFallbackUserId(integration.assignmentRule?.fallbackUserId || '');

      // Fetch snippet to retrieve decrypted key if available
      api.get(`/integrations/${integration._id}/snippet`)
        .then((res) => {
          if (res.data?.key && res.data.key !== '<REGENERATE_KEY_TO_VIEW>') {
            setWebhookKey(res.data.key);
          } else {
            setWebhookKey(integration.googleKeyPrefix || 'Key Active');
          }
        })
        .catch(() => {
          setWebhookKey(integration.googleKeyPrefix || 'Key Active');
        });
    } else {
      // Initialize new Google Ads integration
      setCreatedIntegration(null);
      setWebhookKey('');
      setStep(1);
    }
  }, [isOpen, integration]);

  if (!isOpen) return null;

  const handleCopy = async (text, fieldName) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedField(fieldName);
      toast.success('Copied to clipboard! 📋');
      setTimeout(() => setCopiedField(''), 2500);
    } catch {
      toast.error('Unable to copy to clipboard');
    }
  };

  // Step 1 -> Step 2: Initialize Integration if not already created
  const handleProceedToCredentials = async () => {
    if (createdIntegration) {
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/integrations', {
        provider: 'google',
        accountName: accountName.trim() || 'Google Ads Inbound',
        defaultCampaignLabel: defaultCampaign.trim(),
        assignmentRule: {
          type: assignmentType,
          specificCounselorId: specificCounselorId || null,
          fallbackUserId: fallbackUserId || null,
          skipInactive: true,
        },
      });

      if (res.data?.success) {
        setCreatedIntegration(res.data.integration);
        setWebhookKey(res.data.plaintextSecretOnce || 'Key Active');
        toast.success('Google Ads Webhook generated successfully!');
        setStep(2);
        onSuccess?.();
      } else {
        toast.error(res.data?.message || 'Failed to initialize integration');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Initialization failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Save Field Mapping & Assignment Settings
  const handleSaveSettings = async () => {
    if (!createdIntegration) return;
    setLoading(true);
    try {
      await api.patch(`/integrations/${createdIntegration._id}`, {
        accountName,
        metadata: {
          ...(createdIntegration.metadata || {}),
          defaultCampaignLabel: defaultCampaign,
        },
        assignmentRule: {
          type: assignmentType,
          specificCounselorId: specificCounselorId || null,
          fallbackUserId: fallbackUserId || null,
          skipInactive: true,
        },
      });
      toast.success('Campaign and team assignment saved!');
      setStep(4);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Send CRM Diagnostic Test Lead
  const handleSendTestLead = async () => {
    if (!createdIntegration) return;
    setTesting(true);
    try {
      const res = await api.post('/integrations/google/test', {
        integrationId: createdIntegration._id,
        name: 'Alex Mercer (Google Test Lead)',
        phone: '919812345678',
        email: 'alex.mercer@google-ads-test.com',
        campaignName: defaultCampaign,
        adGroupName: 'Enterprise Software Keywords',
        formName: 'Lead Form Extension Asset',
      });

      if (res.data?.success) {
        toast.success('Diagnostic Google test lead received and processed! 🔴');
        setCreatedIntegration((prev) => ({
          ...prev,
          metadata: {
            ...(prev?.metadata || {}),
            lastTestReceivedAt: new Date(),
          },
        }));
        onSuccess?.();
      } else {
        toast.error(res.data?.message || 'Test lead failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Test lead simulation failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-white flex flex-col">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-inner">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Google Ads Lead Forms Setup
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-medium">5-Step Wizard</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Deliver leads submitted from Google Search, Discovery & YouTube ads directly into Sahyak CRM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="grid grid-cols-5 gap-2 mb-6 border-b border-slate-800/60 pb-4">
          {[
            { num: 1, title: 'Overview' },
            { num: 2, title: 'Webhook' },
            { num: 3, title: 'Routing' },
            { num: 4, title: 'Test Delivery' },
            { num: 5, title: 'Status' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => {
                if (createdIntegration || s.num === 1) setStep(s.num);
              }}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl text-center transition ${
                step === s.num
                  ? 'bg-rose-500/15 text-rose-400 font-semibold border border-rose-500/30'
                  : step > s.num
                  ? 'text-slate-300 hover:bg-slate-800/40'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.num
                  ? 'bg-rose-500 text-white'
                  : step > s.num
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-500'
              }`}>
                {step > s.num ? '✓' : s.num}
              </div>
              <span className="text-[11px] truncate w-full">{s.title}</span>
            </button>
          ))}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            STEP 1: OVERVIEW & EXPLANATION
           ───────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-400" />
                How Google Ads Lead Delivery Works
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                When prospective applicants click your Google Search or YouTube ad, Google displays an instant Lead Form. By configuring a webhook in your Google Ads campaign, Google delivers these inquiries directly to your Sahyak CRM backend in real-time.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-xs font-medium text-rose-300">✅ Instant Response</p>
                  <p className="text-[11px] text-slate-400 mt-1">Leads arrive within seconds of submission, triggering immediate counselor assignment.</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="text-xs font-medium text-rose-300">🔒 SHA-256 Secret Protection</p>
                  <p className="text-[11px] text-slate-400 mt-1">Every webhook payload is verified with a per-tenant secret key before ingestion.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Integration / Account Display Name
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Google Ads - B.Tech Campaigns 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Default Campaign Tag
                </label>
                <input
                  type="text"
                  value={defaultCampaign}
                  onChange={(e) => setDefaultCampaign(e.target.value)}
                  placeholder="e.g. Google Search High Intent"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  If Google does not provide a campaign name in the payload, leads will be tagged with this label.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleProceedToCredentials}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Generate Webhook & Key
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 2: WEBHOOK URL & SECRET KEY
           ───────────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <span>
                Copy these two credentials into your Google Ads account under: <strong>Campaigns &gt; Assets &gt; Lead form &gt; Lead delivery options &gt; Manage your leads with a webhook</strong>.
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  1. WEBHOOK URL (Paste into Google Ads)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicWebhookUrl}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-rose-300 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(publicWebhookUrl, 'url')}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                  >
                    {copiedField === 'url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  2. KEY / SECRET (Paste into Google Ads)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookKey}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-emerald-300 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookKey, 'key')}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                  >
                    {copiedField === 'key' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    Copy
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Stored securely using SHA-256 and AES-256-GCM. Verified via constant-time comparison on every inbound webhook.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition"
              >
                Next: Configure Routing
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 3: ROUTING & ASSIGNMENT RULES
           ───────────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Counselor Assignment Policy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setAssignmentType('round_robin')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                    assignmentType === 'round_robin'
                      ? 'bg-rose-500/15 border-rose-500/40 text-white'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-rose-400" />
                    Round Robin Pool
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Equally distributes leads across all active counselors sequentially.
                  </p>
                </div>

                <div
                  onClick={() => setAssignmentType('specific_counselor')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                    assignmentType === 'specific_counselor'
                      ? 'bg-rose-500/15 border-rose-500/40 text-white'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-rose-400" />
                    Specific Counselor
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Directs all Google Ads leads to a designated team member.
                  </p>
                </div>
              </div>
            </div>

            {assignmentType === 'specific_counselor' && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Select Primary Counselor
                </label>
                <select
                  value={specificCounselorId}
                  onChange={(e) => setSpecificCounselorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                >
                  <option value="">-- Choose Counselor --</option>
                  {members.map((m) => (
                    <option key={m.user?._id} value={m.user?._id}>
                      {m.user?.name || m.user?.email} ({m.role || 'Counselor'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Fallback Owner (if primary counselor is inactive or offline)
              </label>
              <select
                value={fallbackUserId}
                onChange={(e) => setFallbackUserId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 transition"
              >
                <option value="">-- Workspace Owner / Admin --</option>
                {members.map((m) => (
                  <option key={m.user?._id} value={m.user?._id}>
                    {m.user?.name || m.user?.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Save & Proceed to Test
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 4: TEST DELIVERY & VERIFICATION
           ───────────────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                Two Ways to Verify Delivery
              </h3>
              
              <div className="space-y-3 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <p className="font-bold text-white mb-1">Option A: Official Google Ads Test Ping (Recommended)</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Inside the Google Ads Lead form asset editor, click the <strong>"Send test data"</strong> button. Google will immediately dispatch a test payload to your webhook. Sahyak CRM verifies the payload without creating duplicate customer leads, and records the test timestamp below.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white mb-0.5">Option B: Sahyak CRM Pipeline Simulation</p>
                    <p className="text-slate-400 text-[11px]">Injects a sample candidate into your pipeline to verify field mapping and counselor assignment.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendTestLead}
                    disabled={testing}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition flex-shrink-0 shadow-md disabled:opacity-50"
                  >
                    {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Send Test Lead
                  </button>
                </div>
              </div>
            </div>

            {/* Verification Status Banner */}
            <div className="p-4 rounded-2xl border flex items-center justify-between bg-slate-800/30 border-slate-700">
              <div className="flex items-center gap-3">
                {createdIntegration?.metadata?.lastTestReceivedAt ? (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-white">
                    {createdIntegration?.metadata?.lastTestReceivedAt
                      ? 'Test Delivery Confirmed!'
                      : 'Awaiting Webhook Test Ping from Google'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {createdIntegration?.metadata?.lastTestReceivedAt
                      ? `Last test recorded on ${new Date(createdIntegration.metadata.lastTestReceivedAt).toLocaleString()}`
                      : 'Click "Send test data" in Google Ads or use the simulation button above'}
                  </p>
                </div>
              </div>

              {createdIntegration?.metadata?.lastTestReceivedAt && (
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Verified
                </span>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
              >
                Finish & View Status
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 5: FINAL VERIFIED STATUS & ACTIONS
           ───────────────────────────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-5 text-center py-2">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Google Ads Integration Ready</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Your webhook is configured and active. Any applicant submitting a Google Lead Form will be automatically ingested and assigned to your team.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800 max-w-md mx-auto text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Account Name:</span>
                <strong className="text-white">{accountName}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Default Campaign:</span>
                <strong className="text-white">{defaultCampaign}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Assignment Rule:</span>
                <strong className="text-white capitalize">{assignmentType.replace('_', ' ')}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Inbound Ingestion:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active (Lossless JSON)
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
              >
                Close & Return to Channels
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
