'use client';

import { useState, useEffect } from 'react';
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
  Check
} from 'lucide-react';

export default function MetaPageFormModal({
  isOpen = false,
  integration,
  onClose,
  onSuccess,
  onReconnect,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [defaultCampaignId, setDefaultCampaignId] = useState('');
  const [formCampaignMap, setFormCampaignMap] = useState({});
  const [selectedPageId, setSelectedPageId] = useState('');
  const [selectedFormIds, setSelectedFormIds] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen || !integration?._id) return;

    setSelectedPageId(integration.pageId || '');
    setSelectedFormIds(Array.isArray(integration.formIds) ? integration.formIds : []);

    const fetchInitialData = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const [assetsRes, campaignsRes] = await Promise.all([
          api.get(`/integrations/meta/assets?integrationId=${integration._id}`),
          api.get('/campaigns', { params: { type: 'inbound_ad' } }).catch(() => ({ data: { campaigns: [] } })),
        ]);

        if (campaignsRes.data?.success) {
          const cmps = campaignsRes.data.campaigns || [];
          setCampaigns(cmps);
          if (cmps.length > 0) {
            setDefaultCampaignId(cmps[0]._id);
          }
        } else if (Array.isArray(campaignsRes.data)) {
          setCampaigns(campaignsRes.data);
          if (campaignsRes.data.length > 0) {
            setDefaultCampaignId(campaignsRes.data[0]._id);
          }
        }

        if (assetsRes.data?.success) {
          const pageAssets = assetsRes.data.data || [];
          setAssets(pageAssets);
          if (!selectedPageId && pageAssets.length > 0) {
            setSelectedPageId(pageAssets[0].pageId);
            const forms = pageAssets[0].forms || [];
            setSelectedFormIds(forms.map((f) => f.formId));
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
    };

    fetchInitialData();
  }, [isOpen, integration]);

  if (!isOpen) return null;

  const currentPage = assets.find((a) => String(a.pageId) === String(selectedPageId)) || assets[0];
  const forms = currentPage?.forms || [];

  const handleToggleForm = (formId) => {
    setSelectedFormIds((prev) =>
      prev.includes(formId) ? prev.filter((id) => id !== formId) : [...prev, formId]
    );
  };

  const handleSelectAllForms = () => {
    if (selectedFormIds.length === forms.length) {
      setSelectedFormIds([]);
    } else {
      setSelectedFormIds(forms.map((f) => f.formId));
    }
  };

  const handleSetFormCampaign = (formId, campaignId) => {
    setFormCampaignMap((prev) => ({ ...prev, [formId]: campaignId }));
  };

  const handleSave = async () => {
    if (!selectedPageId) {
      toast.error('Please select a Facebook Page');
      return;
    }

    setSaving(true);
    try {
      // Build formRouting map linking each selected form to its chosen Campaign Group
      const formRouting = {};
      for (const formId of selectedFormIds) {
        const matchedForm = forms.find((f) => String(f.formId) === String(formId));
        const targetCmpId = formCampaignMap[formId] || defaultCampaignId;
        if (targetCmpId) {
          formRouting[formId] = {
            campaignGroupId: targetCmpId,
            formName: matchedForm?.formName || `Meta Form ${formId}`,
          };
        }
      }

      const res = await api.post('/integrations/meta/configure', {
        integrationId: integration._id,
        pageId: selectedPageId,
        pageName: currentPage?.pageName || integration.pageName || 'Facebook Page',
        formIds: selectedFormIds,
        formRouting,
      });

      if (res.data?.success) {
        toast.success('Meta Page, Lead Forms & Campaign routing configured! 🔵');
        onSuccess?.();
        onClose?.();
      } else {
        toast.error(res.data?.message || 'Configuration failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save Meta configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-white flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-inner">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Select Meta Page & Lead Forms
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">Self-Service</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose the Facebook Page and Instant Forms you want Sahyak CRM to listen to
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

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-slate-400">Querying Meta Graph API for accessible pages & forms...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Unable to load Meta assets</p>
                <p className="text-xs text-rose-300/80 mt-1">{errorMsg}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={onReconnect}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reconnect with Meta OAuth
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
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex flex-col gap-3 text-center items-center">
            <AlertCircle className="w-8 h-8 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-200">No Facebook Pages Found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Your authenticated Meta profile does not currently manage any Facebook Pages or lacks the <code className="text-amber-300">pages_show_list</code> permission.
              </p>
            </div>
            <button
              onClick={onReconnect}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Re-authorize Permissions
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Facebook Page Picker */}
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
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
                        const pageForms = page.forms || [];
                        setSelectedFormIds(pageForms.map((f) => f.formId));
                      }}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500/40 text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {page.pageName ? page.pageName[0].toUpperCase() : 'P'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-snug">{page.pageName}</p>
                          <p className="text-[11px] text-slate-400">ID: {page.pageId}</p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-400" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Destination CRM Campaign Group */}
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                2. Default CRM Campaign Group
              </label>
              {campaigns.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700 text-xs text-slate-400">
                  No active Campaign Groups found. Incoming leads will be saved under the default Inbound Campaign.
                </div>
              ) : (
                <select
                  value={defaultCampaignId}
                  onChange={(e) => setDefaultCampaignId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                >
                  {campaigns.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.displayName || c.name || c.campaignName} ({c.platform || 'General'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Step 3: Instant Lead Forms */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  3. Active Lead Generation Forms ({forms.length})
                </label>
                {forms.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllForms}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium transition"
                  >
                    {selectedFormIds.length === forms.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {forms.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800 text-center text-xs text-slate-400">
                  No instant lead forms found on this page. Create a Lead Form in Meta Ads Manager to capture applicant inquiries.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {forms.map((form) => {
                    const isChecked = selectedFormIds.includes(form.formId);
                    const selectedCmp = formCampaignMap[form.formId] || defaultCampaignId;
                    return (
                      <div
                        key={form.formId}
                        className={`p-3 rounded-xl border flex flex-col gap-2.5 transition ${
                          isChecked
                            ? 'bg-blue-600/10 border-blue-500/30 text-white'
                            : 'bg-slate-800/20 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div
                          onClick={() => handleToggleForm(form.formId)}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                              isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-600 bg-slate-800'
                            }`}>
                              {isChecked && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-white">{form.formName || 'Untitled Form'}</p>
                              <p className="text-[10px] text-slate-400">Form ID: {form.formId}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {form.status === 'ACTIVE' ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                                Active
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-medium">
                                {form.status || 'Archived'}
                              </span>
                            )}
                            {form.leadsCount !== undefined && (
                              <span className="text-[10px] text-slate-400">{form.leadsCount} leads</span>
                            )}
                          </div>
                        </div>

                        {/* Per-Form Campaign Destination Selector */}
                        {isChecked && campaigns.length > 0 && (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60 pl-8">
                            <span className="text-[11px] text-slate-400 whitespace-nowrap">Route to Group:</span>
                            <select
                              value={selectedCmp}
                              onChange={(e) => handleSetFormCampaign(form.formId, e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-blue-300 focus:outline-none focus:border-blue-500 transition w-full"
                            >
                              {campaigns.map((c) => (
                                <option key={c._id} value={c._id}>
                                  {c.displayName || c.name || c.campaignName}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Information Box */}
            <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-xs text-slate-400 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <span>
                Saving subscribes your CRM to real-time <code className="text-blue-300 font-mono">leadgen</code> webhooks for this page. When leads are submitted on Instagram or Facebook, they will immediately stream into your pipeline.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !selectedPageId}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Subscribing Webhooks...
                  </>
                ) : (
                  <>
                    Save & Subscribe Webhook
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
