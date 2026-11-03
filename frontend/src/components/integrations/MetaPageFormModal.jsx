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
  Sparkles,
  HelpCircle,
  CheckCircle,
  FolderOpen,
  ArrowUpRight,
  Tag
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
  // Navigation view: 'list' (manage integrated forms) | 'wizard' (add/edit a form)
  const [view, setView] = useState('list');
  // Wizard steps: 1 = Select Form & Destination Campaign, 2 = Map Questions
  const [step, setStep] = useState(1);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingQuestions, setFetchingQuestions] = useState(false);
  const [deletingFormId, setDeletingFormId] = useState(null);

  // Data states
  const [assets, setAssets] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [integratedForms, setIntegratedForms] = useState([]);

  // Editing / Configuring a specific form
  const [selectedPageId, setSelectedPageId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState('');
  const [selectedFormName, setSelectedFormName] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [mappings, setMappings] = useState([]);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch initial Meta Assets, Campaigns & Existing Integrated Forms
  const fetchInitialData = useCallback(async () => {
    if (!integration?._id) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const [assetsRes, campaignsRes, formsRes] = await Promise.all([
        api.get(`/integrations/meta/assets?integrationId=${integration._id}`),
        api.get('/campaigns', { params: { type: 'inbound' } }).catch(() => ({ data: { campaigns: [] } })),
        api.get(`/integrations/meta/forms?integrationId=${integration._id}`).catch(() => ({ data: { forms: [] } })),
      ]);

      // 1. Process Campaigns
      let cmps = [];
      if (campaignsRes.data?.success) {
        cmps = campaignsRes.data.campaigns || [];
      } else if (Array.isArray(campaignsRes.data)) {
        cmps = campaignsRes.data;
      }
      setCampaigns(cmps);

      // 2. Process Integrated Forms
      const formsList = formsRes.data?.forms || [];
      setIntegratedForms(formsList);

      // 3. Process Assets
      if (assetsRes.data?.success) {
        const pageAssets = assetsRes.data.data || [];
        setAssets(pageAssets);

        const initialPageId = integration.pageId || (pageAssets.length > 0 ? pageAssets[0].pageId : '');
        setSelectedPageId(initialPageId);

        // If user already has integrated forms, open in 'list' view; otherwise open in 'wizard'
        if (formsList.length > 0) {
          setView('list');
        } else {
          setView('wizard');
          setStep(1);
          // Auto pre-select first form if available
          const currentPage = pageAssets.find((a) => String(a.pageId) === String(initialPageId)) || pageAssets[0];
          const pageForms = currentPage?.forms || [];
          if (pageForms.length > 0) {
            setSelectedFormId(pageForms[0].formId);
            setSelectedFormName(pageForms[0].formName);
          }
        }
      } else {
        setErrorMsg(assetsRes.data?.message || 'Failed to retrieve Facebook Pages');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Could not fetch Meta integration details';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [integration?._id, integration?.pageId]);

  useEffect(() => {
    if (!isOpen || !integration?._id) return;
    fetchInitialData();
  }, [isOpen, integration?._id, fetchInitialData]);

  // Active page & its available forms from Graph API
  const currentPage = useMemo(() => {
    return assets.find((a) => String(a.pageId) === String(selectedPageId)) || assets[0] || null;
  }, [assets, selectedPageId]);

  const availableForms = useMemo(() => {
    return currentPage?.forms || [];
  }, [currentPage]);

  const selectedForm = useMemo(() => {
    return availableForms.find((f) => String(f.formId) === String(selectedFormId)) || null;
  }, [availableForms, selectedFormId]);

  // Load questions for selected form into mapping state
  const loadFormQuestions = useCallback(async (targetForm, existingMapping = null) => {
    if (existingMapping && Array.isArray(existingMapping) && existingMapping.length > 0) {
      setMappings(existingMapping);
      return;
    }

    if (!targetForm) {
      setMappings(DEFAULT_STANDARD_MAPPINGS);
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

    // Fetch on-demand from dedicated endpoint
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
        setMappings(DEFAULT_STANDARD_MAPPINGS);
      }
    } catch (e) {
      setMappings(DEFAULT_STANDARD_MAPPINGS);
    } finally {
      setFetchingQuestions(false);
    }
  }, [integration?._id]);

  // Start integrating a new form
  const handleStartAddForm = () => {
    setIsEditingExisting(false);
    setSelectedFormId('');
    setSelectedFormName('');
    setSelectedCampaignId('__auto_create__');
    setMappings(DEFAULT_STANDARD_MAPPINGS);
    setStep(1);
    setView('wizard');
  };

  // Start editing an already-integrated form
  const handleStartEditForm = (formItem) => {
    setIsEditingExisting(true);
    setSelectedPageId(formItem.pageId || integration.pageId || '');
    setSelectedFormId(formItem.formId);
    setSelectedFormName(formItem.formName);
    setSelectedCampaignId(formItem.campaign?._id || '__auto_create__');

    const targetFormObj = availableForms.find((f) => String(f.formId) === String(formItem.formId));
    loadFormQuestions(targetFormObj, formItem.fieldMapping);

    setStep(2); // Go directly to field mapping & campaign view
    setView('wizard');
  };

  // Remove / Disconnect a single form
  const handleDeleteForm = async (formItem) => {
    if (!window.confirm(`Are you sure you want to disconnect form "${formItem.formName}"? Inbound leads from this form will no longer be captured into Campaign "${formItem.campaign?.name || 'CRM'}".`)) {
      return;
    }

    setDeletingFormId(formItem.formId);
    try {
      const res = await api.delete(`/integrations/meta/forms/${formItem.formId}`, {
        params: { integrationId: integration._id },
      });
      if (res.data?.success) {
        toast.success(`Form "${formItem.formName}" disconnected successfully`);
        setIntegratedForms((prev) => prev.filter((f) => f.formId !== formItem.formId));
        onSuccess?.();
      } else {
        toast.error(res.data?.message || 'Failed to remove form');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove form');
    } finally {
      setDeletingFormId(null);
    }
  };

  // Select form in wizard step 1
  const handleSelectFormInWizard = (formObj) => {
    setSelectedFormId(formObj.formId);
    setSelectedFormName(formObj.formName);

    // If this form already has an integrated record, pre-select its campaign
    const existing = integratedForms.find((f) => String(f.formId) === String(formObj.formId));
    if (existing?.campaign?._id) {
      setSelectedCampaignId(existing.campaign._id);
    } else {
      setSelectedCampaignId('__auto_create__');
    }
  };

  // Proceed to Step 2 (Question Mapping)
  const handleProceedToStep2 = () => {
    if (!selectedFormId) {
      toast.error('Please select a Meta Lead Form to integrate');
      return;
    }
    loadFormQuestions(selectedForm);
    setStep(2);
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

  // Final Save & Activate
  const handleSaveForm = async () => {
    if (!selectedFormId) {
      toast.error('Please select a Meta Lead Form');
      return;
    }

    // Validate mappings
    if (!mappings || mappings.length === 0) {
      toast.error('Please configure at least one form question mapping.');
      return;
    }
    const invalid = mappings.some((m) => !m.sourceField.trim());
    if (invalid) {
      toast.error('All form question mappings must specify a Meta field key');
      return;
    }
    const hasPhoneOrEmail = mappings.some(
      (m) => (m.crmField === 'phone' || m.crmField === 'email') && !m.isCustom
    );
    if (!hasPhoneOrEmail) {
      toast.error('You must map at least Phone Number OR Email Address so inbound leads can be contacted in CRM.');
      return;
    }

    const effectiveCampaignId = selectedCampaignId || '__auto_create__';
    const formDisplayName = selectedFormName || selectedForm?.formName || `Meta Form ${selectedFormId}`;

    setSaving(true);
    try {
      const formRouting = {
        [selectedFormId]: {
          campaignGroupId: effectiveCampaignId,
          formName: formDisplayName,
          newCampaignName: `${formDisplayName} Leads`,
          fieldMapping: mappings.filter((m) => m.crmField !== 'ignore'),
        },
      };

      const res = await api.post('/integrations/meta/configure', {
        integrationId: integration._id,
        pageId: selectedPageId || integration.pageId,
        pageName: currentPage?.pageName || integration.pageName || 'Facebook Page',
        formIds: [selectedFormId],
        formRouting,
        fieldMapping: mappings.filter((m) => m.crmField !== 'ignore'),
        replaceOtherForms: false, // CRITICAL: Never pause other active forms!
      });

      if (res.data?.success) {
        toast.success(
          isEditingExisting
            ? `Form "${formDisplayName}" updated successfully! 🔵`
            : `Form "${formDisplayName}" connected successfully! 🔵`
        );
        onSuccess?.();
        // Refresh integrated forms list and switch back to list view
        const refreshRes = await api.get(`/integrations/meta/forms?integrationId=${integration._id}`).catch(() => null);
        if (refreshRes?.data?.forms) {
          setIntegratedForms(refreshRes.data.forms);
        }
        setView('list');
      } else {
        toast.error(res.data?.message || 'Configuration failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save form configuration');
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

  const filteredAvailableForms = availableForms.filter((f) => {
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
                Meta Forms & Field Mapping
                <span className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">
                  {view === 'list'
                    ? `${integratedForms.length} Form${integratedForms.length === 1 ? '' : 's'} Integrated`
                    : isEditingExisting
                    ? 'Editing Form'
                    : `Step ${step} of 2`}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {view === 'list' && 'Manage your integrated Meta Instant Forms and their campaign routing.'}
                {view === 'wizard' && step === 1 && 'Select a Meta Form and destination Campaign.'}
                {view === 'wizard' && step === 2 && 'Map questions from this Meta Form directly to CRM fields.'}
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

        {/* Section Boundary Guidance Callout */}
        <div className="bg-blue-950/40 border border-blue-800/40 rounded-2xl px-4 py-2.5 mb-5 flex items-center justify-between text-xs text-blue-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Clear Separation:</strong> Meta forms route leads to your selected Campaign. Agent and counselor assignments are managed within each Campaign.
            </span>
          </div>
        </div>

        {/* Body Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-slate-400">Loading Meta assets and integrated forms...</p>
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
        ) : (
          <div>
            {/* ══════════════════════════════════════════════════════════
                VIEW 1: INTEGRATED FORMS LIST (Overview of all forms)
               ══════════════════════════════════════════════════════════ */}
            {view === 'list' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Active Integrated Forms ({integratedForms.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Each form captures leads and routes them independently into its designated Campaign.
                    </p>
                  </div>
                  <button
                    onClick={handleStartAddForm}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-blue-600/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Integrate New Form
                  </button>
                </div>

                {integratedForms.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-800/40 border border-slate-800 text-center space-y-3">
                    <FileText className="w-10 h-10 text-slate-500 mx-auto" />
                    <div>
                      <h4 className="text-sm font-semibold text-white">No Meta Forms Integrated Yet</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        Connect your first Meta Instant Form to start capturing leads directly into your CRM campaigns with automated field mapping.
                      </p>
                    </div>
                    <button
                      onClick={handleStartAddForm}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition"
                    >
                      <Plus className="w-4 h-4" /> Connect Your First Lead Form
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {integratedForms.map((form) => (
                      <div
                        key={form.formId}
                        className="p-4 rounded-2xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{form.formName}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              ID: {form.formId}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-[11px] text-slate-400">Page:</span>
                            <span className="text-white font-medium">{form.pageName || 'Facebook Page'}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-[11px] text-slate-400">Campaign:</span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/30 flex items-center gap-1">
                              <Tag className="w-3 h-3 text-blue-400" />
                              {form.campaign?.name || 'CRM Campaign'}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-emerald-400 font-medium">
                              {form.fieldMapping?.length || 0} fields mapped
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-0.5">
                            <span>Leads captured: <strong className="text-white">{form.totalLeadsCount}</strong></span>
                            {form.lastLeadAt && (
                              <span>Last lead: {new Date(form.lastLeadAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => handleStartEditForm(form)}
                            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                          >
                            <Sliders className="w-3 h-3 text-blue-400" /> Edit Fields & Campaign
                          </button>
                          <button
                            onClick={() => handleDeleteForm(form)}
                            disabled={deletingFormId === form.formId}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                            title="Disconnect Form"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    Showing {integratedForms.length} active Meta Lead form integrations.
                  </div>
                  <button
                    onClick={onClose}
                    className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                VIEW 2: FORM INTEGRATION & FIELD MAPPING WIZARD
               ══════════════════════════════════════════════════════════ */}
            {view === 'wizard' && (
              <div className="space-y-5">
                {/* Wizard Navigation Header */}
                <div className="flex items-center justify-between pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (integratedForms.length > 0) {
                        setView('list');
                      } else {
                        onClose();
                      }
                    }}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Integrated Forms
                  </button>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={step === 1 ? 'text-blue-400 font-bold' : 'text-slate-500'}>
                      1. Select Form & Campaign
                    </span>
                    <span className="text-slate-600">/</span>
                    <span className={step === 2 ? 'text-blue-400 font-bold' : 'text-slate-500'}>
                      2. Map Fields
                    </span>
                  </div>
                </div>

                {/* ══════════════════════════════════════════════════════
                    STEP 1: SELECT PAGE, FORM & DESTINATION CAMPAIGN
                   ══════════════════════════════════════════════════════ */}
                {step === 1 && (
                  <div className="space-y-5">
                    {/* 1. Page Selection (if multiple pages) */}
                    {assets.length > 1 && (
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          1. Select Facebook Page
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {assets.map((page) => {
                            const isSelected = String(page.pageId) === String(selectedPageId);
                            return (
                              <div
                                key={page.pageId}
                                onClick={() => {
                                  setSelectedPageId(page.pageId);
                                  const pForms = page.forms || [];
                                  if (pForms.length > 0) {
                                    handleSelectFormInWizard(pForms[0]);
                                  } else {
                                    setSelectedFormId('');
                                    setSelectedFormName('');
                                  }
                                }}
                                className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-blue-600/15 border-blue-500/50 text-white ring-1 ring-blue-500/30'
                                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
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
                    )}

                    {/* 2. Choose Lead Form from Meta */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Choose Meta Lead Form ({availableForms.length})
                        </label>
                      </div>

                      {availableForms.length > 4 && (
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

                      {availableForms.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 text-center space-y-2">
                          <FileText className="w-8 h-8 text-slate-500 mx-auto" />
                          <p className="text-xs font-medium text-slate-300">No Instant Lead Forms found on this Page</p>
                          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                            Ensure your lead form is published in Meta Ads Manager.
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
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {filteredAvailableForms.map((form) => {
                            const isSelected = String(form.formId) === String(selectedFormId);
                            const alreadyIntegrated = integratedForms.find((f) => String(f.formId) === String(form.formId));

                            return (
                              <div
                                key={form.formId}
                                onClick={() => handleSelectFormInWizard(form)}
                                className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
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
                                      {alreadyIntegrated && (
                                        <span className="text-[10px] text-blue-300 bg-blue-500/15 px-1.5 py-0.2 rounded font-medium border border-blue-500/30">
                                          Integrated in: {alreadyIntegrated.campaign?.name || 'Campaign'}
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
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 3. Destination Campaign Selection */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Target CRM Campaign Destination
                      </label>
                      <select
                        value={selectedCampaignId || '__auto_create__'}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                      >
                        <option value="__auto_create__">
                          ✨ Auto-Create Dedicated Campaign ("{selectedFormName || selectedForm?.formName || 'Meta Leads'}")
                        </option>
                        {campaigns.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.displayName || c.name || c.campaignName} ({c.type || 'inbound'})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        Leads from this form will be deposited into this campaign. Agent assignment rules are configured directly within the Campaign section.
                      </p>
                    </div>

                    {/* Step 1 Actions */}
                    <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          if (integratedForms.length > 0) {
                            setView('list');
                          } else {
                            onClose();
                          }
                        }}
                        className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-medium transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!selectedFormId}
                        onClick={handleProceedToStep2}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-blue-600/20"
                      >
                        Continue to Question Mapping <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════════
                    STEP 2: MAP FORM QUESTIONS TO CRM FIELDS
                   ══════════════════════════════════════════════════════ */}
                {step === 2 && (
                  <div className="space-y-5">
                    {/* Header info bar */}
                    <div className="p-4 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Mapping Questions For Form</span>
                        <h3 className="text-sm font-bold text-white mt-0.5">
                          {selectedFormName || selectedForm?.formName || `Meta Form ${selectedFormId}`}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Inline Campaign Selector to easily adjust destination while mapping */}
                        <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-700 rounded-xl px-2.5 py-1">
                          <Tag className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <select
                            value={selectedCampaignId || '__auto_create__'}
                            onChange={(e) => setSelectedCampaignId(e.target.value)}
                            className="bg-transparent text-xs text-white focus:outline-none"
                          >
                            <option value="__auto_create__">Auto-Create Campaign</option>
                            {campaigns.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.displayName || c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddMappingRule}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-xl font-semibold flex items-center gap-1.5 transition shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Field
                        </button>
                      </div>
                    </div>

                    {fetchingQuestions ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                        <p className="text-xs text-slate-400">Loading form questions from Meta Graph API...</p>
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

                    {/* Zero Data Loss Guarantee */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Zero Data Loss Guarantee:</strong> Any questions mapped to <em>Custom Question & Answer</em> are automatically stored on the applicant profile under <strong>Custom Questions & Answers</strong>. They are never lost.
                      </span>
                    </div>

                    {/* Step 2 Actions */}
                    <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingExisting) {
                            setView('list');
                          } else {
                            setStep(1);
                          }
                        }}
                        className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-medium flex items-center gap-1.5 transition"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {isEditingExisting ? 'Cancel' : 'Back to Selection'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveForm}
                        className="px-7 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-blue-600/30"
                      >
                        {saving ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving Configuration...
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            {isEditingExisting ? 'Save Changes' : 'Save & Activate Form 🔵'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
