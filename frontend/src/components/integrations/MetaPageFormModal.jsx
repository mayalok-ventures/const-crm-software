'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  FileText,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Layers,
  ArrowRight,
  ArrowLeft,
  Check,
  Search,
  Sliders,
  Plus,
  Trash2,
  Eye,
  Sparkles,
  HelpCircle,
  CheckCircle
} from 'lucide-react';

const STANDARD_CRM_FIELDS = [
  { value: 'name', label: '👤 Full Name (Lead Name)' },
  { value: 'phone', label: '📱 Phone / WhatsApp Number' },
  { value: 'email', label: '✉️ Email Address' },
  { value: 'course', label: '🎓 Target Course / Program' },
  { value: 'city', label: '📍 Target City / Location' },
  { value: 'custom', label: '📝 Custom Question & Answer' },
  { value: 'ignore', label: '🚫 Skip (Do Not Import)' },
];

function detectCrmField(key = '', label = '', type = '') {
  const combined = `${key} ${label} ${type}`.toLowerCase();
  if (
    combined.includes('full_name') ||
    combined.includes('full name') ||
    combined === 'name' ||
    combined.includes('applicant_name') ||
    combined.includes('student_name')
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
    combined.includes('stream') ||
    combined.includes('branch') ||
    combined.includes('qualification')
  ) {
    return 'course';
  }
  if (
    combined.includes('city') ||
    combined.includes('location') ||
    combined.includes('town') ||
    combined.includes('state') ||
    combined.includes('address')
  ) {
    return 'city';
  }
  return 'custom';
}

const DEFAULT_STANDARD_MAPPINGS = [
  { sourceField: 'full_name', displayLabel: 'Full Name', crmField: 'name', isCustom: false, showOnProfile: true },
  { sourceField: 'phone_number', displayLabel: 'Phone Number', crmField: 'phone', isCustom: false, showOnProfile: true },
  { sourceField: 'email', displayLabel: 'Email Address', crmField: 'email', isCustom: false, showOnProfile: true },
  { sourceField: 'target_course', displayLabel: 'Interested Course', crmField: 'course', isCustom: false, showOnProfile: true },
  { sourceField: 'city', displayLabel: 'City / Location', crmField: 'city', isCustom: false, showOnProfile: true },
];

export default function MetaPageFormModal({
  isOpen = false,
  integration,
  onClose,
  onSuccess,
  onReconnect,
}) {
  // Step indicator: 1 = Select Page & Form, 2 = Map Questions, 3 = Routing & Save
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingQuestions, setFetchingQuestions] = useState(false);

  // Data states
  const [assets, setAssets] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [existingSubscriptions, setExistingSubscriptions] = useState([]);

  // Selections
  const [selectedPageId, setSelectedPageId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Field mappings for the currently selected form
  const [mappings, setMappings] = useState([]);

  // Fetch initial Meta Assets & CRM Campaigns
  const fetchInitialData = useCallback(async () => {
    if (!integration?._id) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const [assetsRes, campaignsRes, subsRes] = await Promise.all([
        api.get(`/integrations/meta/assets?integrationId=${integration._id}`),
        api.get('/campaigns', { params: { type: 'inbound' } }).catch(() => ({ data: { campaigns: [] } })),
        api.get('/integrations/subscriptions', { params: { provider: 'meta' } }).catch(() => ({ data: { subscriptions: [] } })),
      ]);

      let cmps = [];
      if (campaignsRes.data?.success) {
        cmps = campaignsRes.data.campaigns || [];
      } else if (Array.isArray(campaignsRes.data)) {
        cmps = campaignsRes.data;
      }
      setCampaigns(cmps);
      if (cmps.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(cmps[0]._id);
      }

      if (subsRes.data?.subscriptions) {
        setExistingSubscriptions(subsRes.data.subscriptions);
      }

      if (assetsRes.data?.success) {
        const pageAssets = assetsRes.data.data || [];
        setAssets(pageAssets);

        // Pre-select page
        const initialPageId = integration.pageId || (pageAssets.length > 0 ? pageAssets[0].pageId : '');
        setSelectedPageId(initialPageId);

        // Find active page
        const currentPage = pageAssets.find((a) => String(a.pageId) === String(initialPageId)) || pageAssets[0];
        const pageForms = currentPage?.forms || [];

        // Pre-select form
        const initialFormId = (Array.isArray(integration.formIds) && integration.formIds.length > 0)
          ? integration.formIds[0]
          : (pageForms.length > 0 ? pageForms[0].formId : '');
        setSelectedFormId(initialFormId);

        // Pre-fill campaign for pre-selected form if previously mapped
        const prevSub = subsRes.data?.subscriptions?.find((s) => String(s.externalFormId) === String(initialFormId));
        if (prevSub?.campaignGroupId?._id) {
          setSelectedCampaignId(prevSub.campaignGroupId._id);
        }
      } else {
        setErrorMsg(assetsRes.data?.message || 'Failed to retrieve Facebook Pages');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Could not fetch Meta assets';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [integration?._id, integration?.pageId, integration?.formIds, selectedCampaignId]);

  useEffect(() => {
    if (!isOpen || !integration?._id) return;
    setStep(1);
    fetchInitialData();
  }, [isOpen, integration?._id, fetchInitialData]);

  // Resolve current active page and its forms
  const currentPage = useMemo(() => {
    return assets.find((a) => String(a.pageId) === String(selectedPageId)) || assets[0] || null;
  }, [assets, selectedPageId]);

  const forms = useMemo(() => {
    return currentPage?.forms || [];
  }, [currentPage]);

  const selectedForm = useMemo(() => {
    return forms.find((f) => String(f.formId) === String(selectedFormId)) || null;
  }, [forms, selectedFormId]);

  // Load questions for selected form into mapping state
  const loadFormQuestions = useCallback(async (targetForm) => {
    if (!targetForm) {
      setMappings(DEFAULT_STANDARD_MAPPINGS);
      return;
    }

    // Check if we have pre-existing subscription mappings
    const prevSub = existingSubscriptions.find((s) => String(s.externalFormId) === String(targetForm.formId));
    if (prevSub?.fieldMapping && Array.isArray(prevSub.fieldMapping) && prevSub.fieldMapping.length > 0) {
      setMappings(prevSub.fieldMapping);
      return;
    }

    // Check if form questions are already embedded from Graph API
    if (Array.isArray(targetForm.questions) && targetForm.questions.length > 0) {
      const generated = targetForm.questions.map((q) => {
        const key = String(q.key || q.name || '').trim();
        const label = String(q.label || q.text || key).trim();
        const detected = detectCrmField(key, label, q.type);
        return {
          sourceField: key,
          displayLabel: label,
          crmField: detected,
          isCustom: detected === 'custom',
          showOnProfile: true,
          questionType: q.type || 'TEXT',
        };
      });
      setMappings(generated);
      return;
    }

    // Otherwise, fetch on-demand from dedicated endpoint
    setFetchingQuestions(true);
    try {
      const res = await api.get(`/integrations/meta/forms/${targetForm.formId}/questions?integrationId=${integration._id}`);
      const qs = res.data?.data?.questions || [];
      if (qs.length > 0) {
        const generated = qs.map((q) => {
          const key = String(q.key || q.name || '').trim();
          const label = String(q.label || q.text || key).trim();
          const detected = detectCrmField(key, label, q.type);
          return {
            sourceField: key,
            displayLabel: label,
            crmField: detected,
            isCustom: detected === 'custom',
            showOnProfile: true,
            questionType: q.type || 'TEXT',
          };
        });
        setMappings(generated);
      } else {
        // Fallback to standard mappings
        setMappings(DEFAULT_STANDARD_MAPPINGS);
      }
    } catch (e) {
      // Graceful fallback to standard mapping template
      setMappings(DEFAULT_STANDARD_MAPPINGS);
    } finally {
      setFetchingQuestions(false);
    }
  }, [existingSubscriptions, integration?._id]);

  // Handle Form Selection and advance
  const handleSelectForm = (formId) => {
    setSelectedFormId(formId);
    const chosenForm = forms.find((f) => String(f.formId) === String(formId));
    loadFormQuestions(chosenForm);

    const prevSub = existingSubscriptions.find((s) => String(s.externalFormId) === String(formId));
    if (prevSub?.campaignGroupId?._id) {
      setSelectedCampaignId(prevSub.campaignGroupId._id);
    }
  };

  const handleProceedToMapping = () => {
    if (!selectedFormId) {
      toast.error('Please select a Lead Generation Form to map');
      return;
    }
    loadFormQuestions(selectedForm);
    setStep(2);
  };

  const handleProceedToRouting = () => {
    // Validate mappings
    const invalid = mappings.some((m) => !m.sourceField.trim());
    if (invalid) {
      toast.error('All form question mappings must specify a Meta field key');
      return;
    }
    setStep(3);
  };

  // Field mapping manipulations
  const handleAddMappingRule = () => {
    setMappings((prev) => [
      ...prev,
      {
        sourceField: '',
        displayLabel: '',
        crmField: 'custom',
        isCustom: true,
        showOnProfile: true,
      },
    ]);
  };

  const handleRemoveMappingRule = (idx) => {
    setMappings((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMappingChange = (idx, field, value) => {
    setMappings((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      if (field === 'crmField') {
        copy[idx].isCustom = value === 'custom';
      }
      return copy;
    });
  };

  // Final Save & Configure
  const handleSaveConfiguration = async () => {
    if (!selectedPageId) {
      toast.error('Please select a Facebook Page');
      return;
    }
    if (!selectedFormId) {
      toast.error('Please select a Meta Lead Form');
      return;
    }
    if (!selectedCampaignId) {
      toast.error('Please select a destination CRM Campaign');
      return;
    }

    setSaving(true);
    try {
      const formRouting = {
        [selectedFormId]: {
          campaignGroupId: selectedCampaignId,
          formName: selectedForm?.formName || `Meta Form ${selectedFormId}`,
          fieldMapping: mappings.filter((m) => m.crmField !== 'ignore'),
        },
      };

      const res = await api.post('/integrations/meta/configure', {
        integrationId: integration._id,
        pageId: selectedPageId,
        pageName: currentPage?.pageName || integration.pageName || 'Facebook Page',
        formIds: [selectedFormId],
        formRouting,
        fieldMapping: mappings.filter((m) => m.crmField !== 'ignore'),
      });

      if (res.data?.success) {
        toast.success('Meta Lead Form & CRM Field Mappings Connected Successfully! 🔵');
        onSuccess?.();
        onClose?.();
      } else {
        toast.error(res.data?.message || 'Configuration failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReconnect = async () => {
    if (onReconnect) {
      const res = await onReconnect();
      if (res?.success) {
        fetchInitialData();
      }
    }
  };

  if (!isOpen) return null;

  const filteredForms = forms.filter((f) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (f.formName || '').toLowerCase().includes(term) || String(f.formId).includes(term);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-white flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Connect Meta Lead Form & Field Mapping
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">
                  Step {step} of 3
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {step === 1 && 'Select the Facebook Page and Lead Generation Form to connect'}
                {step === 2 && 'Map each question in your Meta Form directly to CRM fields'}
                {step === 3 && 'Choose your destination Campaign and verify connection'}
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

        {/* Wizard Stepper Progress Bar */}
        <div className="flex items-center justify-between mb-6 px-2">
          <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 1 ? 'text-blue-400' : 'text-slate-500'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              1
            </div>
            <span>1. Select Form</span>
          </div>
          <div className={`h-0.5 flex-1 mx-3 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-800'}`} />
          <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 2 ? 'text-blue-400' : 'text-slate-500'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              2
            </div>
            <span>2. Map Questions</span>
          </div>
          <div className={`h-0.5 flex-1 mx-3 ${step >= 3 ? 'bg-blue-600' : 'bg-slate-800'}`} />
          <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 3 ? 'text-blue-400' : 'text-slate-500'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              3
            </div>
            <span>3. Connect & Save</span>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-slate-400">Loading Facebook Pages and Lead Forms from Meta Graph API...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Unable to load Meta assets</p>
                <p className="text-xs text-rose-300/80 mt-1">{errorMsg}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleReconnect}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-authorize with Meta OAuth
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : assets.length === 0 ? (
          <div className="p-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex flex-col gap-3 text-center items-center">
            <AlertCircle className="w-10 h-10 text-amber-400" />
            <div>
              <p className="text-base font-semibold text-amber-200">No Facebook Pages Found</p>
              <p className="text-xs text-slate-400 mt-1.5 max-w-md leading-relaxed">
                Your authenticated Meta profile currently does not manage any Facebook Pages or lacks permission to view them. Click below to grant full Page permissions.
              </p>
            </div>
            <button
              onClick={handleReconnect}
              className="mt-3 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-blue-600/20"
            >
              <ExternalLink className="w-4 h-4" /> Re-authorize Meta Permissions
            </button>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ══════════════════════════════════════════════════════════
                STEP 1: SELECT PAGE & FORM
               ══════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <div className="space-y-5">
                {/* 1. Page Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    1. Select Facebook Page
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {assets.map((page) => {
                      const isSelected = String(page.pageId) === String(selectedPageId);
                      return (
                        <div
                          key={page.pageId}
                          onClick={() => {
                            setSelectedPageId(page.pageId);
                            const pForms = page.forms || [];
                            if (pForms.length > 0) {
                              handleSelectForm(pForms[0].formId);
                            } else {
                              setSelectedFormId('');
                            }
                          }}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-600/15 border-blue-500/50 text-white ring-1 ring-blue-500/30'
                              : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                            }`}>
                              FB
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white leading-tight">{page.pageName}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">ID: {page.pageId}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Permission Warning Notice (e.g. pages_manage_ads missing) */}
                {currentPage?.formFetchError && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-200">Lead Form Permissions Notice</p>
                        <p className="text-amber-300/80 text-[11px] mt-0.5">
                          Meta requires <code className="text-amber-200">pages_manage_ads</code> to read Instant Forms. Click to grant this permission.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleReconnect}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold whitespace-nowrap transition"
                    >
                      Grant Permission
                    </button>
                  </div>
                )}

                {/* 2. Lead Forms Picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      2. Choose Meta Lead Generation Form ({forms.length})
                    </label>
                  </div>

                  {forms.length > 4 && (
                    <div className="relative mb-3">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search forms by name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  )}

                  {forms.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 text-center space-y-2">
                      <FileText className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-xs font-medium text-slate-300">No Instant Lead Forms found on this Page</p>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        If you have active ads, ensure your form is published in Meta Ads Manager, or reconnect with updated permissions.
                      </p>
                      <button
                        type="button"
                        onClick={handleReconnect}
                        className="mt-2 px-3.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-lg text-xs font-medium transition inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3 h-3" /> Reconnect & Refresh Forms
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {filteredForms.map((form) => {
                        const isSelected = String(form.formId) === String(selectedFormId);
                        const prevSub = existingSubscriptions.find((s) => String(s.externalFormId) === String(form.formId));

                        return (
                          <div
                            key={form.formId}
                            onClick={() => handleSelectForm(form.formId)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                              isSelected
                                ? 'bg-blue-600/15 border-blue-500/50 text-white ring-1 ring-blue-500/30'
                                : 'bg-slate-800/30 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                                isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-600 bg-slate-800'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-white">{form.formName || 'Untitled Lead Form'}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-500 font-mono">ID: {form.formId}</span>
                                  {prevSub?.campaignGroupId && (
                                    <span className="text-[10px] text-blue-400 bg-blue-500/15 px-1.5 py-0.2 rounded">
                                      Routed to: {prevSub.campaignGroupId.displayName || prevSub.campaignGroupId.name}
                                    </span>
                                  )}
                                  {form.questions?.length > 0 && (
                                    <span className="text-[10px] text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded font-medium">
                                      {form.questions.length} questions
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {form.status === 'ACTIVE' ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
                                  Active
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-medium">
                                  {form.status || 'Archived'}
                                </span>
                              )}
                              {form.leadsCount !== undefined && (
                                <span className="text-[10px] text-slate-400 font-medium">{form.leadsCount} leads</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Step 1 Footer Actions */}
                <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedFormId}
                    onClick={handleProceedToMapping}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-blue-600/20"
                  >
                    Continue to Question Mapping <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                STEP 2: MAP FORM QUESTIONS TO CRM FIELDS
               ══════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Mapping Active Form</span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{selectedForm?.formName || `Meta Form ${selectedFormId}`}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMappingRule}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-semibold flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Field
                  </button>
                </div>

                {fetchingQuestions ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                    <p className="text-xs text-slate-400">Loading form questions from Meta...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                      <span>Meta Form Question</span>
                      <span>Target CRM Field</span>
                    </div>

                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {mappings.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center gap-3 text-xs"
                        >
                          <div className="flex-1 space-y-1">
                            <input
                              type="text"
                              value={m.displayLabel || m.sourceField}
                              onChange={(e) => handleMappingChange(idx, 'displayLabel', e.target.value)}
                              placeholder="Question Label (e.g. Full Name)"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-medium focus:outline-none focus:border-blue-500"
                            />
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 font-mono">key:</span>
                              <input
                                type="text"
                                value={m.sourceField}
                                onChange={(e) => handleMappingChange(idx, 'sourceField', e.target.value)}
                                placeholder="meta_key"
                                className="bg-transparent text-[10px] text-slate-400 font-mono focus:outline-none border-b border-transparent focus:border-slate-500 px-0.5"
                              />
                            </div>
                          </div>

                          <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />

                          <div className="flex-1">
                            <select
                              value={m.crmField}
                              onChange={(e) => handleMappingChange(idx, 'crmField', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs font-medium focus:outline-none focus:border-blue-500"
                            >
                              {STANDARD_CRM_FIELDS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveMappingRule(idx)}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Zero Data Loss Guarantee Card */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Zero Data Loss Guarantee:</strong> Any questions mapped to <em>Custom Question & Answer</em> are automatically stored on the applicant profile under <strong>Custom Questions & Answers</strong>. They are never dropped!
                  </span>
                </div>

                {/* Step 2 Footer Actions */}
                <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Forms
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToRouting}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-blue-600/20"
                  >
                    Continue to Destination Campaign <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                STEP 3: ROUTING & CONFIRMATION
               ══════════════════════════════════════════════════════════ */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Select Target CRM Campaign Group
                  </label>
                  {campaigns.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400">
                      No inbound campaigns found. A default inbound campaign will be automatically provisioned for your leads.
                    </div>
                  ) : (
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                    >
                      {campaigns.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.displayName || c.name || c.campaignName} ({c.type || 'inbound'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Connection Summary Card */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" /> Connection Overview
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Facebook Page</span>
                      <p className="text-white font-medium">{currentPage?.pageName || 'Facebook Page'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Selected Form</span>
                      <p className="text-white font-medium">{selectedForm?.formName || `Meta Form ${selectedFormId}`}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Mapped Questions</span>
                      <p className="text-emerald-400 font-medium">{mappings.filter((m) => m.crmField !== 'ignore').length} CRM Fields Mapped</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Sync Mode</span>
                      <p className="text-blue-400 font-medium">Real-Time Instant Webhook</p>
                    </div>
                  </div>
                </div>

                {/* Step 3 Footer Actions */}
                <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Mapping
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveConfiguration}
                    className="px-7 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-blue-600/30"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving Configuration...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" /> Save & Activate Connection 🔵
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
