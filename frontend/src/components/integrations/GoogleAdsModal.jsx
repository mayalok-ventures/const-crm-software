'use client';

import { useState, useEffect, useRef } from 'react';
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
  Sliders,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  FolderOpen
} from 'lucide-react';

const STANDARD_CRM_FIELDS = [
  { value: 'name', label: '👤 Full Name (Lead Name)' },
  { value: 'phone', label: '📱 Phone Number' },
  { value: 'email', label: '✉️ Email Address' },
  { value: 'course', label: '🎓 Target Course / Program' },
  { value: 'city', label: '📍 City / Location' },
  { value: 'custom', label: '📝 Custom Question / Notes' },
  { value: 'ignore', label: '🚫 Skip (Do Not Import)' },
];

function detectCrmField(key = '', label = '') {
  const combined = `${key} ${label}`.toLowerCase();
  if (
    combined.includes('full_name') ||
    combined.includes('full name') ||
    combined === 'name' ||
    combined.includes('applicant_name') ||
    combined.includes('student_name') ||
    combined.includes('first_name')
  ) {
    return 'name';
  }
  if (
    combined.includes('phone') ||
    combined.includes('mobile') ||
    combined.includes('contact') ||
    combined.includes('whatsapp')
  ) {
    return 'phone';
  }
  if (combined.includes('email') || combined.includes('e-mail')) {
    return 'email';
  }
  if (
    combined.includes('course') ||
    combined.includes('degree') ||
    combined.includes('program') ||
    combined.includes('specialization')
  ) {
    return 'course';
  }
  if (
    combined.includes('city') ||
    combined.includes('location') ||
    combined.includes('postal_code') ||
    combined.includes('zip')
  ) {
    return 'city';
  }
  return 'custom';
}

export default function GoogleAdsModal({
  isOpen = false,
  integration,
  onClose,
  onSuccess,
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [currentIntegration, setCurrentIntegration] = useState(null);
  const [webhookKey, setWebhookKey] = useState('');
  const [accountName, setAccountName] = useState('Google Ads Lead Forms');

  // Campaign states
  const [campaigns, setCampaigns] = useState([]);
  const [campaignMode, setCampaignMode] = useState('existing'); // 'existing' | 'new'
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('Google Search Leads 2026');

  // Field mapping states
  const [incomingFields, setIncomingFields] = useState([]);
  const [fieldMappings, setFieldMappings] = useState([]);

  // Poller timer ref
  const pollTimerRef = useRef(null);

  const publicWebhookUrl = `${API_URL}/integrations/google/webhook`;

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/campaigns');
      const list = res.data?.campaigns || res.data?.data || res.data || [];
      if (Array.isArray(list)) {
        setCampaigns(list.filter((c) => c.status !== 'cancelled' && c.status !== 'archived'));
        if (list.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(list[0]._id);
        }
      }
    } catch (e) {
      console.warn('Failed to load campaigns:', e.message);
    }
  };

  // Initialize or fetch integration
  const initializeCredentials = async (forceRegenerate = false) => {
    setLoading(true);
    try {
      const res = await api.post('/integrations/google/generate-webhook', {
        accountName,
        regenerate: forceRegenerate,
      });

      if (res.data?.success) {
        const intDoc = res.data.integration;
        setCurrentIntegration(intDoc);
        if (res.data.webhookKey) {
          setWebhookKey(res.data.webhookKey);
        } else if (intDoc.googleKeyPrefix) {
          setWebhookKey(intDoc.googleKeyPrefix);
        }

        // Set initial step based on status
        if (intDoc.status === 'connected') {
          setStep(4);
        } else if (intDoc.status === 'needs_mapping') {
          setStep(4);
        } else if (intDoc.metadata?.targetCampaignId) {
          setStep(3);
        }
      }
    } catch (err) {
      console.error('Failed to initialize Google webhook:', err);
      toast.error('Could not initialize Google Ads credentials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchCampaigns();

    if (integration) {
      setCurrentIntegration(integration);
      setAccountName(integration.accountName || 'Google Ads Lead Forms');
      if (integration.metadata?.targetCampaignId) {
        setSelectedCampaignId(integration.metadata.targetCampaignId);
      }

      // Fetch snippet for full secret if available
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

      // Populate sample fields if available
      const samples = integration.metadata?.sampleFields || [];
      if (samples.length > 0) {
        setIncomingFields(samples);
        initFieldMappings(samples, integration.fieldMapping);
      }

      if (integration.status === 'connected') {
        setStep(4);
      } else if (integration.status === 'needs_mapping') {
        setStep(4);
      } else {
        setStep(1);
      }
    } else {
      initializeCredentials();
      setStep(1);
    }
  }, [isOpen, integration]);

  // Poller on Step 3: Listen for incoming test lead
  useEffect(() => {
    if (step !== 3 || !isOpen) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    const pollStatus = async () => {
      try {
        const res = await api.get('/integrations/google');
        const list = res.data?.data || res.data || [];
        const found = list.find((i) => i._id === currentIntegration?._id) || list[0];
        if (found) {
          setCurrentIntegration(found);
          const samples = found.metadata?.sampleFields || [];
          if (found.status === 'needs_mapping' || samples.length > 0) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setIncomingFields(samples);
            initFieldMappings(samples, found.fieldMapping);
            toast.success('Test lead received from Google Ads! 🎯 Proceeding to field mapping...');
            setStep(4);
          }
        }
      } catch (_) {}
    };

    pollTimerRef.current = setInterval(pollStatus, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [step, isOpen, currentIntegration]);

  const initFieldMappings = (samples, existing = []) => {
    const existingMap = new Map();
    if (Array.isArray(existing)) {
      existing.forEach((e) => existingMap.set(e.sourceField, e.crmField));
    }

    const initial = samples.map((field) => {
      const sourceField = field.key || field.column_id || field.label;
      const displayLabel = field.label || field.column_name || sourceField;
      const matchedCrm = existingMap.get(sourceField) || detectCrmField(sourceField, displayLabel);
      return {
        sourceField,
        displayLabel,
        crmField: matchedCrm,
        sampleValue: field.sampleValue || field.string_value || '',
      };
    });

    setFieldMappings(initial);
  };

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

  // Step 2 -> Step 3: Handle campaign selection or creation
  const handleProceedToTest = async () => {
    let targetCampaignId = selectedCampaignId;
    let targetCampaignName = '';

    if (campaignMode === 'new') {
      if (!newCampaignName.trim()) {
        toast.error('Please enter a campaign name');
        return;
      }
      setLoading(true);
      try {
        const createRes = await api.post('/campaigns', {
          name: newCampaignName.trim(),
          platform: 'google',
        });
        const createdCamp = createRes.data?.campaign || createRes.data?.data;
        if (!createdCamp?._id) {
          throw new Error('Failed to create campaign');
        }
        targetCampaignId = createdCamp._id;
        targetCampaignName = createdCamp.name || newCampaignName.trim();
        setSelectedCampaignId(targetCampaignId);
        toast.success(`Created campaign "${targetCampaignName}"!`);
      } catch (err) {
        setLoading(false);
        toast.error(err.response?.data?.message || 'Failed to create campaign');
        return;
      }
    } else {
      if (!targetCampaignId) {
        toast.error('Please select an existing campaign');
        return;
      }
      const found = campaigns.find((c) => c._id === targetCampaignId);
      targetCampaignName = found?.name || found?.displayName || 'Google Ads Campaign';
    }

    // Persist target campaign onto integration metadata
    if (currentIntegration?._id) {
      try {
        await api.patch(`/integrations/${currentIntegration._id}`, {
          accountName,
          metadata: {
            ...(currentIntegration.metadata || {}),
            targetCampaignId,
            defaultCampaignLabel: targetCampaignName,
          },
        });
      } catch (_) {}
    }

    setLoading(false);
    setStep(3);
  };

  // Step 3: Simulate Test Lead
  const handleSimulateTestLead = async () => {
    if (!currentIntegration?._id) return;
    setTesting(true);
    try {
      const activeCampaign = campaigns.find((c) => c._id === selectedCampaignId);
      const campName = activeCampaign?.name || newCampaignName || 'Google Search Leads';

      const res = await api.post('/integrations/google/test', {
        simulate: true,
        integrationId: currentIntegration._id,
        name: 'Alex Mercer (Google Test)',
        phone: '919812345678',
        email: 'alex.mercer@google-ads-test.com',
        campaignName: campName,
      });

      if (res.data?.success) {
        toast.success('Test Google lead received! Detecting incoming columns...');
        const samples = res.data.sampleFields || [];
        setIncomingFields(samples);
        initFieldMappings(samples, currentIntegration.fieldMapping);

        setCurrentIntegration((prev) => ({
          ...prev,
          status: 'needs_mapping',
          metadata: {
            ...(prev?.metadata || {}),
            sampleFields: samples,
            lastTestReceivedAt: new Date(),
          },
        }));

        setStep(4);
      } else {
        toast.error(res.data?.message || 'Simulation failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to simulate test lead');
    } finally {
      setTesting(false);
    }
  };

  // Step 4: Save Field Mapping & Connect
  const handleSaveFieldMapping = async () => {
    if (!currentIntegration?._id) return;
    setLoading(true);

    const activeCampaign = campaigns.find((c) => c._id === selectedCampaignId);
    const campaignName = activeCampaign?.name || newCampaignName || 'Google Ads Leads';

    // Format field mappings
    const formatted = fieldMappings
      .filter((m) => m.crmField !== 'ignore')
      .map((m) => ({
        sourceField: m.sourceField,
        crmField: m.crmField === 'custom' ? 'customData' : m.crmField,
        displayLabel: m.displayLabel || m.sourceField,
        isCustom: m.crmField === 'custom',
        showOnProfile: true,
      }));

    try {
      const res = await api.post('/integrations/google/complete-mapping', {
        integrationId: currentIntegration._id,
        campaignId: selectedCampaignId,
        campaignName,
        fieldMapping: formatted,
      });

      if (res.data?.success) {
        toast.success('Google Ads Integration connected successfully! 🎉');
        setCurrentIntegration(res.data.data);
        setStep(5);
        onSuccess?.();
      } else {
        toast.error(res.data?.message || 'Failed to save mapping');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMappingItem = (index, field, value) => {
    setFieldMappings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddCustomField = () => {
    const newKey = `CUSTOM_FIELD_${fieldMappings.length + 1}`;
    setFieldMappings((prev) => [
      ...prev,
      {
        sourceField: newKey,
        displayLabel: 'Additional Question',
        crmField: 'custom',
        sampleValue: 'Sample response',
      },
    ]);
  };

  const handleRemoveField = (index) => {
    setFieldMappings((prev) => prev.filter((_, idx) => idx !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-white flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-inner">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Google Ads Lead Forms Integration
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  currentIntegration?.status === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : currentIntegration?.status === 'needs_mapping'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {currentIntegration?.status === 'connected'
                    ? 'Connected'
                    : currentIntegration?.status === 'needs_mapping'
                    ? 'Needs Mapping'
                    : '4-Step Setup'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically capture and route leads submitted from Google Search, Discovery & YouTube ads
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

        {/* Wizard Progress Tabs */}
        <div className="grid grid-cols-4 gap-2 mb-6 border-b border-slate-800/60 pb-4">
          {[
            { num: 1, title: '1. Webhook & Key' },
            { num: 2, title: '2. Select Campaign' },
            { num: 3, title: '3. Send Test Lead' },
            { num: 4, title: '4. Map Fields' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => {
                if (s.num <= step || currentIntegration?.status === 'connected') {
                  setStep(s.num);
                }
              }}
              disabled={s.num > step && currentIntegration?.status !== 'connected'}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl text-center transition ${
                step === s.num
                  ? 'bg-rose-500/15 text-rose-400 font-semibold border border-rose-500/30'
                  : step > s.num
                  ? 'text-slate-300 hover:bg-slate-800/40'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s.num
                    ? 'bg-rose-500 text-white'
                    : step > s.num
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </div>
              <span className="text-[11px] truncate w-full">{s.title}</span>
            </button>
          ))}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            STEP 1: WEBHOOK & KEY CONFIGURATION
           ───────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <span>
                Copy these two values into your Google Ads Lead Form extension asset under: <strong>Lead delivery options &gt; Manage your leads with a webhook</strong>.
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
                  Verified with constant-time SHA-256 hash comparison on every inbound webhook payload.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Integration Label / Account Name
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Google Ads - B.Tech Campaigns 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition"
              >
                Next: Select Campaign
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 2: CAMPAIGN SELECTION OR CREATION
           ───────────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Where should incoming Google Ads leads be routed?
              </h3>
              <p className="text-xs text-slate-400">
                Choose an existing CRM campaign or quickly create a new one. Agent assignment rules are managed within the Campaign section.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCampaignMode('existing')}
                className={`p-3.5 rounded-2xl border text-left transition ${
                  campaignMode === 'existing'
                    ? 'bg-rose-500/15 border-rose-500/40 text-white'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-rose-400" />
                  Existing Campaign
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Route leads into an active campaign you already created.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCampaignMode('new')}
                className={`p-3.5 rounded-2xl border text-left transition ${
                  campaignMode === 'new'
                    ? 'bg-rose-500/15 border-rose-500/40 text-white'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-rose-400" />
                  Add New Campaign
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Create a new destination campaign specifically for this lead form.
                </p>
              </button>
            </div>

            {campaignMode === 'existing' ? (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Select Destination Campaign
                </label>
                {campaigns.length > 0 ? (
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                  >
                    {campaigns.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name || c.displayName || c.campaignName} ({c.leadCount || 0} leads)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700 text-xs text-slate-400">
                    No active campaigns found. Please switch to "Add New Campaign" above.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  New Campaign Name
                </label>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="e.g. Google Search Admissions 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                />
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-slate-800/30 border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>
                Counselor assignments, round-robin rules, and intake pipelines are controlled under Campaigns.
              </span>
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
                onClick={handleProceedToTest}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Next: Send Test Lead
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 3: SEND TEST LEAD & ACTIVATE WEBHOOK
           ───────────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                Send a Test Lead to Activate Your Webhook
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                As soon as your first test lead arrives, your Google integration activates and immediately displays the incoming data fields for mapping.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <p className="font-bold text-white text-xs mb-1">Option A: In Google Ads Platform</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      In the Google Ads Lead Form asset editor, click the <strong>"Send test data"</strong> button. Google will immediately dispatch test fields.
                    </p>
                  </div>
                  <span className="text-[10px] text-rose-400 font-medium mt-3 block">
                    ⚡ Webhook is actively listening...
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <p className="font-bold text-white text-xs mb-1">Option B: Instant CRM Simulation</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Simulate a candidate submission right now to instantly inspect field columns and proceed to mapping.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateTestLead}
                    disabled={testing}
                    className="mt-3 w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-md disabled:opacity-50"
                  >
                    {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Simulate Test Lead
                  </button>
                </div>
              </div>
            </div>

            {/* Live Listener Banner */}
            <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center animate-pulse">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    Listening for Incoming Google Test Lead
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Click "Send test data" in Google Ads or use the simulation button above.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                Awaiting Lead
              </span>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              {incomingFields.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/20 transition"
                >
                  Proceed to Field Mapping
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 4: FIELD MAPPING & CONNECT
           ───────────────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-rose-400" />
                  Map Incoming Google Form Fields
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Match each field received from Google Ads to the appropriate CRM lead attribute. Only after saving will the status transition to "Connected".
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCustomField}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium flex items-center gap-1 border border-slate-700 transition"
              >
                <Plus className="w-3.5 h-3.5 text-rose-400" />
                Add Field
              </button>
            </div>

            {/* Mapping Table */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/40">
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-800/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <div className="col-span-4">Google Form Field</div>
                <div className="col-span-3">Sample Value</div>
                <div className="col-span-4">Maps To CRM Lead Field</div>
                <div className="col-span-1 text-center">Action</div>
              </div>

              <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
                {fieldMappings.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No fields detected yet. Please send a test lead or click "Add Field".
                  </div>
                ) : (
                  fieldMappings.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-xs">
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={item.displayLabel}
                          onChange={(e) => handleUpdateMappingItem(idx, 'displayLabel', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
                        />
                        <span className="text-[10px] text-slate-500 font-mono block mt-0.5 truncate">
                          {item.sourceField}
                        </span>
                      </div>

                      <div className="col-span-3 text-slate-400 text-xs truncate">
                        <span className="px-2 py-1 rounded bg-slate-800/80 font-mono text-[11px] text-slate-300 block truncate">
                          {item.sampleValue || '—'}
                        </span>
                      </div>

                      <div className="col-span-4">
                        <select
                          value={item.crmField}
                          onChange={(e) => handleUpdateMappingItem(idx, 'crmField', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
                        >
                          {STANDARD_CRM_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveField(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                          title="Remove mapping"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
                onClick={handleSaveFieldMapping}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save Field Mapping & Connect
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 5: CONNECTED CONFIRMATION SCREEN
           ───────────────────────────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Google Ads Integration Connected!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Your webhook is active and verified. Any prospective candidate who submits your Google Ads Lead Form will be automatically captured, mapped, and routed to your campaign.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800 max-w-md mx-auto text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Account Label:</span>
                <strong className="text-white">{accountName}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Mapped Fields:</span>
                <strong className="text-emerald-400">{fieldMappings.length} Active Fields</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Connection Status:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
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
