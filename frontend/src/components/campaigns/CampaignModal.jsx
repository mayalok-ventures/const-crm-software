'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  X,
  Target,
  Sparkles,
  Layers,
  Users,
  Settings2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
  Radio,
  FileSpreadsheet,
  Globe,
  DollarSign,
  ChevronRight,
  Info,
} from 'lucide-react';

export default function CampaignModal({ isOpen, onClose, campaign = null, onSaved }) {
  const isEditing = Boolean(campaign && campaign._id);

  const [loadingSources, setLoadingSources] = useState(false);
  const [sources, setSources] = useState({
    metaForms: [],
    googleAccounts: [],
    websiteForms: [],
    googleSheets: [],
    counselors: [],
  });

  // Form State
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('meta');
  const [budget, setBudget] = useState(0);
  const [status, setStatus] = useState('active');

  // Routing Rules
  const [metaFormIds, setMetaFormIds] = useState([]);
  const [metaFormNames, setMetaFormNames] = useState([]);
  const [customFormName, setCustomFormName] = useState('');
  const [googleAccountIds, setGoogleAccountIds] = useState([]);
  const [googleCampaignIds, setGoogleCampaignIds] = useState([]);
  const [customGoogleCampaign, setCustomGoogleCampaign] = useState('');
  const [websiteFormKeys, setWebsiteFormKeys] = useState([]);
  const [sheetIds, setSheetIds] = useState([]);
  const [utmCampaigns, setUtmCampaigns] = useState([]);
  const [customUtm, setCustomUtm] = useState('');

  // Assignment Rules
  const [assignmentType, setAssignmentType] = useState('round_robin');
  const [specificCounselorId, setSpecificCounselorId] = useState('');
  const [counselorPool, setCounselorPool] = useState([]);
  const [fallbackUserId, setFallbackUserId] = useState('');
  const [skipInactive, setSkipInactive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // general | routing | assignment

  // Load available integration sources & counselors
  useEffect(() => {
    if (!isOpen) return;
    setLoadingSources(true);
    api.get('/campaigns/integrations/available-sources')
      .then((res) => {
        if (res.data?.success) {
          setSources(res.data.sources || {});
        }
      })
      .catch((err) => {
        console.error('Failed to load integration sources:', err);
      })
      .finally(() => {
        setLoadingSources(false);
      });
  }, [isOpen]);

  // Populate fields if editing
  useEffect(() => {
    if (!isOpen) return;

    if (campaign) {
      setName(campaign.name || campaign.displayName || '');
      setDisplayName(campaign.displayName || campaign.name || '');
      setDescription(campaign.description || '');
      setPlatform(campaign.platform || 'meta');
      setBudget(campaign.budget || 0);
      setStatus(campaign.status || 'active');

      const rules = campaign.routingRules || {};
      setMetaFormIds(rules.metaFormIds || []);
      setMetaFormNames(rules.metaFormNames || []);
      setGoogleAccountIds(rules.googleAccountIds || []);
      setGoogleCampaignIds(rules.googleCampaignIds || []);
      setWebsiteFormKeys(rules.websiteFormKeys || []);
      setSheetIds(rules.sheetIds || []);
      setUtmCampaigns(rules.utmCampaigns || []);

      const assign = campaign.assignmentRule || {};
      setAssignmentType(assign.type || 'round_robin');
      setSpecificCounselorId(
        typeof assign.specificCounselorId === 'object'
          ? assign.specificCounselorId?._id || ''
          : assign.specificCounselorId || ''
      );
      setFallbackUserId(
        typeof assign.fallbackUserId === 'object'
          ? assign.fallbackUserId?._id || ''
          : assign.fallbackUserId || ''
      );
      setSkipInactive(assign.skipInactive !== false);

      if (Array.isArray(assign.counselorPool)) {
        setCounselorPool(
          assign.counselorPool.map((p) => ({
            userId: typeof p.userId === 'object' ? p.userId?._id : p.userId,
            name: typeof p.userId === 'object' ? p.userId?.name : '',
            weight: p.weight || 1,
          }))
        );
      } else {
        setCounselorPool([]);
      }
    } else {
      // Default new campaign
      setName('');
      setDisplayName('');
      setDescription('');
      setPlatform('meta');
      setBudget(0);
      setStatus('active');
      setMetaFormIds([]);
      setMetaFormNames([]);
      setGoogleAccountIds([]);
      setGoogleCampaignIds([]);
      setWebsiteFormKeys([]);
      setSheetIds([]);
      setUtmCampaigns([]);
      setAssignmentType('round_robin');
      setSpecificCounselorId('');
      setCounselorPool([]);
      setFallbackUserId('');
      setSkipInactive(true);
      setActiveTab('general');
    }
  }, [campaign, isOpen]);

  // Helpers for Counselors Pool
  const toggleCounselorInPool = (counselor) => {
    const exists = counselorPool.some((p) => String(p.userId) === String(counselor._id));
    if (exists) {
      setCounselorPool(counselorPool.filter((p) => String(p.userId) !== String(counselor._id)));
    } else {
      setCounselorPool([
        ...counselorPool,
        { userId: counselor._id, name: counselor.name, weight: 1 },
      ]);
    }
  };

  const handleAddMetaFormName = () => {
    if (!customFormName.trim()) return;
    if (!metaFormNames.includes(customFormName.trim())) {
      setMetaFormNames([...metaFormNames, customFormName.trim()]);
    }
    setCustomFormName('');
  };

  const handleRemoveMetaFormName = (nameToRemove) => {
    setMetaFormNames(metaFormNames.filter((n) => n !== nameToRemove));
  };

  const handleAddGoogleCampaign = () => {
    if (!customGoogleCampaign.trim()) return;
    if (!googleCampaignIds.includes(customGoogleCampaign.trim())) {
      setGoogleCampaignIds([...googleCampaignIds, customGoogleCampaign.trim()]);
    }
    setCustomGoogleCampaign('');
  };

  const handleRemoveGoogleCampaign = (idToRemove) => {
    setGoogleCampaignIds(googleCampaignIds.filter((id) => id !== idToRemove));
  };

  const handleAddUtm = () => {
    if (!customUtm.trim()) return;
    const lower = customUtm.trim().toLowerCase();
    if (!utmCampaigns.includes(lower)) {
      setUtmCampaigns([...utmCampaigns, lower]);
    }
    setCustomUtm('');
  };

  const handleRemoveUtm = (tagToRemove) => {
    setUtmCampaigns(utmCampaigns.filter((u) => u !== tagToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Campaign name is required');
      setActiveTab('general');
      return;
    }

    if (assignmentType === 'specific_counselor' && !specificCounselorId) {
      toast.error('Please select a specific counselor for this campaign');
      setActiveTab('assignment');
      return;
    }

    if (assignmentType === 'round_robin' && counselorPool.length === 0) {
      toast.error('Please select at least one counselor for the round-robin pool');
      setActiveTab('assignment');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        displayName: displayName.trim() || name.trim(),
        description: description.trim(),
        platform,
        budget: Number(budget) || 0,
        status,
        routingRules: {
          metaFormIds,
          metaFormNames,
          googleAccountIds,
          googleCampaignIds,
          websiteFormKeys,
          sheetIds,
          utmCampaigns,
        },
        assignmentRule: {
          type: assignmentType,
          specificCounselorId: assignmentType === 'specific_counselor' ? specificCounselorId : null,
          counselorPool: assignmentType === 'round_robin'
            ? counselorPool.map((p) => ({ userId: p.userId, weight: p.weight || 1 }))
            : [],
          fallbackUserId: fallbackUserId || null,
          skipInactive,
        },
      };

      if (isEditing) {
        await api.put(`/campaigns/${campaign._id}`, payload);
        toast.success('Campaign updated successfully');
      } else {
        await api.post('/campaigns', payload);
        toast.success('Campaign created successfully');
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Error saving campaign:', err);
      toast.error(err?.response?.data?.message || 'Failed to save campaign');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
              <Target size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing ? `Edit Campaign: ${campaign.name}` : 'Create Inbound Marketing Campaign'}
              </h2>
              <p className="text-xs text-slate-500">
                Direct origin matching & authoritative lead assignment rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 px-6 bg-slate-50/30 gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'general'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings2 size={16} />
            1. Campaign Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('routing')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'routing'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={16} />
            2. Inbound Routing
            {(metaFormIds.length > 0 || metaFormNames.length > 0 || googleAccountIds.length > 0 || utmCampaigns.length > 0) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assignment')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'assignment'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={16} />
            3. Authoritative Assignment
            {(counselorPool.length > 0 || specificCounselorId) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[68vh] overflow-y-auto space-y-5">
            {/* TAB 1: General Info */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder='e.g., "X - B.Tech AI Admission Meta Ad"'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Internal campaign identifier used across analytics, pipeline, and counselor reporting.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Primary Platform
                    </label>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    >
                      <option value="meta">Meta Ads (Facebook & Instagram)</option>
                      <option value="google">Google Ads (Search & PMax)</option>
                      <option value="website">Website Webhook / Landing Page</option>
                      <option value="sheets">Google Sheets Sync</option>
                      <option value="multi">Multi-Channel Omnichannel</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Allocated Budget (₹ INR)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm font-medium">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="50000"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Description & Target Audience
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter campaign strategy, target audience, course focus, or marketing notes..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Campaign Routing Status</div>
                    <div className="text-xs text-slate-500">
                      When active, incoming leads from matching sources will be immediately captured and assigned.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatus(status === 'active' ? 'paused' : 'active')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      status === 'active'
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    {status === 'active' ? 'Active (Routing Leads)' : 'Paused'}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Inbound Routing Rules */}
            {activeTab === 'routing' && (
              <div className="space-y-5">
                <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-blue-800 flex items-start gap-2.5">
                  <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Authoritative Routing Matcher:</strong> Any inbound lead arriving from the selected Meta Forms, Google Accounts, or UTM tags will be automatically captured in this Campaign before any assignment decisions are made.
                  </div>
                </div>

                {/* Meta Forms Section */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      <h3 className="text-sm font-bold text-slate-800">Meta Lead Gen Forms</h3>
                    </div>
                    <span className="text-xs text-slate-400">Facebook & Instagram</span>
                  </div>

                  {/* Connected Meta forms dropdown */}
                  {sources.metaForms?.length > 0 && (
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">
                        Select from Connected Meta Forms in Integration:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sources.metaForms.map((f, idx) => {
                          const isSelected = metaFormIds.includes(f.formId) || metaFormNames.includes(f.formName);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setMetaFormIds(metaFormIds.filter((id) => id !== f.formId));
                                  setMetaFormNames(metaFormNames.filter((name) => name !== f.formName));
                                } else {
                                  if (f.formId && !metaFormIds.includes(f.formId)) setMetaFormIds([...metaFormIds, f.formId]);
                                  if (f.formName && !metaFormNames.includes(f.formName)) setMetaFormNames([...metaFormNames, f.formName]);
                                }
                              }}
                              className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-start justify-between ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-medium'
                                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
                              }`}
                            >
                              <div>
                                <div className="font-semibold">{f.formName || 'Form without name'}</div>
                                <div className="text-[10px] text-slate-400">
                                  Page: {f.pageName || f.pageId || 'Meta Page'} • ID: {f.formId}
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Manual Form Name entry (e.g. "X form") */}
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      Or match by Form Name (e.g. &quot;X form&quot;):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder='Type form name, e.g. "X form"'
                        value={customFormName}
                        onChange={(e) => setCustomFormName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMetaFormName();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddMetaFormName}
                        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700"
                      >
                        Add Form
                      </button>
                    </div>
                    {metaFormNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {metaFormNames.map((fn, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs border border-blue-200/80 font-medium"
                          >
                            Form: &quot;{fn}&quot;
                            <button
                              type="button"
                              onClick={() => handleRemoveMetaFormName(fn)}
                              className="text-blue-500 hover:text-blue-800"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Google Ads Section */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <h3 className="text-sm font-bold text-slate-800">Google Ads Accounts & Campaigns</h3>
                    </div>
                    <span className="text-xs text-slate-400">Search, Display & PMax</span>
                  </div>

                  {sources.googleAccounts?.length > 0 && (
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">
                        Select Connected Google Ads Accounts:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sources.googleAccounts.map((g, idx) => {
                          const isSelected = googleAccountIds.includes(g.customerId);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setGoogleAccountIds(googleAccountIds.filter((id) => id !== g.customerId));
                                } else {
                                  setGoogleAccountIds([...googleAccountIds, g.customerId]);
                                }
                              }}
                              className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-start justify-between ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-medium'
                                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
                              }`}
                            >
                              <div>
                                <div className="font-semibold">{g.accountName || 'Google Ads Account'}</div>
                                <div className="text-[10px] text-slate-400">Customer ID: {g.customerId}</div>
                              </div>
                              {isSelected && <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Manual Google Campaign ID entry */}
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      Match by Google Campaign ID or Name:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g., 2189472910"
                        value={customGoogleCampaign}
                        onChange={(e) => setCustomGoogleCampaign(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddGoogleCampaign();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddGoogleCampaign}
                        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700"
                      >
                        Add ID
                      </button>
                    </div>
                    {googleCampaignIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {googleCampaignIds.map((cid, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 text-xs border border-amber-200 font-medium"
                          >
                            Google CID: {cid}
                            <button
                              type="button"
                              onClick={() => handleRemoveGoogleCampaign(cid)}
                              className="text-amber-600 hover:text-amber-900"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* UTM Tracking Tags */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                      <h3 className="text-sm font-bold text-slate-800">UTM Campaign Parameters</h3>
                    </div>
                    <span className="text-xs text-slate-400">Landing Pages & Tracking URLs</span>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">
                      Match by utm_campaign parameter:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g., ai_summer_ad_2026"
                        value={customUtm}
                        onChange={(e) => setCustomUtm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddUtm();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddUtm}
                        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700"
                      >
                        Add Tag
                      </button>
                    </div>
                    {utmCampaigns.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {utmCampaigns.map((utm, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-xs border border-purple-200 font-medium"
                          >
                            utm: {utm}
                            <button
                              type="button"
                              onClick={() => handleRemoveUtm(utm)}
                              className="text-purple-500 hover:text-purple-800"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Authoritative Lead Assignment */}
            {activeTab === 'assignment' && (
              <div className="space-y-5">
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5">
                  <Sparkles size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Authoritative Campaign Routing:</strong> This campaign determines where leads are assigned. Neither the integration default nor legacy auto-assignment will override this rule.
                  </div>
                </div>

                {/* Assignment Strategy */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Lead Assignment Model
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      onClick={() => setAssignmentType('round_robin')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        assignmentType === 'round_robin'
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="assignModel"
                        checked={assignmentType === 'round_robin'}
                        onChange={() => setAssignmentType('round_robin')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-sm font-bold text-slate-900">Counselor Pool (Round-Robin)</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Rotates incoming leads evenly among selected counselors.
                        </div>
                      </div>
                    </label>

                    <label
                      onClick={() => setAssignmentType('specific_counselor')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        assignmentType === 'specific_counselor'
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="assignModel"
                        checked={assignmentType === 'specific_counselor'}
                        onChange={() => setAssignmentType('specific_counselor')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-sm font-bold text-slate-900">Dedicated Counselor</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Routes 100% of leads from this campaign to a single expert.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Dedicated Counselor Picker */}
                {assignmentType === 'specific_counselor' && (
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Select Dedicated Counselor <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={specificCounselorId}
                      onChange={(e) => setSpecificCounselorId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    >
                      <option value="">-- Choose Counselor --</option>
                      {sources.counselors?.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.email}) - {c.role}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Round Robin Counselor Pool Picker */}
                {assignmentType === 'round_robin' && (
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Select Counselors in Pool ({counselorPool.length} Selected)
                      </label>
                      <span className="text-xs text-slate-400">Atomic Round-Robin Counter</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {sources.counselors?.map((c) => {
                        const inPool = counselorPool.some((p) => String(p.userId) === String(c._id));
                        return (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => toggleCounselorInPool(c)}
                            className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                              inPool
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-medium'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <div>
                              <div className="font-semibold">{c.name}</div>
                              <div className="text-[10px] text-slate-400">{c.email}</div>
                            </div>
                            {inPool ? (
                              <CheckCircle2 size={16} className="text-indigo-600" />
                            ) : (
                              <Plus size={16} className="text-slate-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Fallback Option */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Fallback Counselor / Admin
                  </label>
                  <select
                    value={fallbackUserId}
                    onChange={(e) => setFallbackUserId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                  >
                    <option value="">Default Workspace Owner / Admin</option>
                    {sources.counselors?.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Used if selected pool counselors are unavailable, inactive, or max lead capacity is reached.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70">
            <div>
              {activeTab !== 'general' && (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'assignment' ? 'routing' : 'general')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>

              {activeTab !== 'assignment' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'general' ? 'routing' : 'assignment')}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  Next Step
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <div className="spinner w-3.5 h-3.5 border-2 border-white/30 border-t-white" />}
                  {isEditing ? 'Save Changes' : 'Launch Campaign'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
