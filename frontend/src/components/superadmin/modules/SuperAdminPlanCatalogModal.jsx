'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Plus,
  Trash2,
  Copy,
  Archive,
  Send,
  Sliders,
  DollarSign,
  Shield,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';

export default function SuperAdminPlanCatalogModal({
  isOpen = false,
  onClose = () => {},
  planToEdit = null,
  onSuccess = () => {},
}) {
  const isEditing = Boolean(planToEdit?._id);

  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'pricing' | 'limits' | 'features' | 'bullets'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('ORGANIZATION');
  const [badge, setBadge] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [status, setStatus] = useState('ACTIVE');
  const [visibility, setVisibility] = useState('PUBLIC');

  // Pricing
  const [monthlyPrice, setMonthlyPrice] = useState(1499);
  const [monthlyEnabled, setMonthlyEnabled] = useState(true);
  const [yearlyPrice, setYearlyPrice] = useState(14999);
  const [yearlyEnabled, setYearlyEnabled] = useState(true);

  // Limits (-1 = Unlimited)
  const [seats, setSeats] = useState(3);
  const [seatsUnlimited, setSeatsUnlimited] = useState(false);
  const [leads, setLeads] = useState(15000);
  const [leadsUnlimited, setLeadsUnlimited] = useState(false);
  const [contactGroups, setContactGroups] = useState(25);
  const [contactGroupsUnlimited, setContactGroupsUnlimited] = useState(false);
  const [monthlyWhatsApp, setMonthlyWhatsApp] = useState(10000);
  const [monthlyWhatsAppUnlimited, setMonthlyWhatsAppUnlimited] = useState(false);
  const [monthlyBroadcasts, setMonthlyBroadcasts] = useState(25);
  const [monthlyBroadcastsUnlimited, setMonthlyBroadcastsUnlimited] = useState(false);
  const [storageGB, setStorageGB] = useState(10);
  const [pipelines, setPipelines] = useState(5);
  const [branches, setBranches] = useState(2);

  // Features Checkboxes
  const [features, setFeatures] = useState({
    leadManagement: true,
    leadExport: true,
    whatsapp: true,
    whatsappBroadcast: true,
    automation: true,
    commonLeadPool: true,
    autoLeadDistribution: true,
    performanceTracking: true,
    commissionTracking: true,
    hierarchy: false,
    smartExitRules: false,
    advancedAnalytics: true,
    revenueAnalytics: false,
    customWebhooks: false,
    apiAccess: false,
    customDomain: false,
    prioritySupport: false,
  });

  // What's Included Bullets
  const [whatsIncluded, setWhatsIncluded] = useState([
    'Includes 3 Team Agent Seats',
    'Up to 15,000 shared leads',
    'Agency common pool & lead assignment',
    'Agent performance & commission tracking',
  ]);
  const [newBullet, setNewBullet] = useState('');

  // Populate on edit
  useEffect(() => {
    if (planToEdit) {
      setName(planToEdit.name || '');
      setSlug(planToEdit.slug || '');
      setCategory(planToEdit.category || planToEdit.accountType || 'ORGANIZATION');
      setBadge(planToEdit.badge || '');
      setDescription(planToEdit.description || '');
      setDisplayOrder(planToEdit.displayOrder || 0);
      setStatus(planToEdit.status || 'ACTIVE');
      setVisibility(planToEdit.visibility || 'PUBLIC');

      const mPrice = planToEdit.pricing?.monthly?.amount !== undefined ? planToEdit.pricing.monthly.amount : (planToEdit.monthlyPrice || Math.round((planToEdit.priceInPaise || 0) / 100));
      const yPrice = planToEdit.pricing?.yearly?.amount !== undefined ? planToEdit.pricing.yearly.amount : (planToEdit.yearlyPrice || mPrice * 10);
      setMonthlyPrice(mPrice);
      setMonthlyEnabled(planToEdit.pricing?.monthly?.enabled !== false);
      setYearlyPrice(yPrice);
      setYearlyEnabled(planToEdit.pricing?.yearly?.enabled !== false);

      const pLimits = planToEdit.limits || {};
      const defaultEnt = planToEdit.defaultEntitlements || {};

      const sLimit = pLimits.seats !== undefined ? pLimits.seats : (defaultEnt.maxSeats || 1);
      setSeats(sLimit === -1 ? 1 : sLimit);
      setSeatsUnlimited(sLimit === -1);

      const lLimit = pLimits.leads !== undefined ? pLimits.leads : (defaultEnt.maxLeads || 1000);
      setLeads(lLimit === -1 ? 1000 : lLimit);
      setLeadsUnlimited(lLimit === -1);

      const gLimit = pLimits.contactGroups !== undefined ? pLimits.contactGroups : 10;
      setContactGroups(gLimit === -1 ? 10 : gLimit);
      setContactGroupsUnlimited(gLimit === -1);

      const waLimit = pLimits.monthlyWhatsAppMessages !== undefined ? pLimits.monthlyWhatsAppMessages : (defaultEnt.monthlyWAQuota || 1000);
      setMonthlyWhatsApp(waLimit === -1 ? 1000 : waLimit);
      setMonthlyWhatsAppUnlimited(waLimit === -1);

      const bcLimit = pLimits.monthlyBroadcasts !== undefined ? pLimits.monthlyBroadcasts : 5;
      setMonthlyBroadcasts(bcLimit === -1 ? 5 : bcLimit);
      setMonthlyBroadcastsUnlimited(bcLimit === -1);

      setStorageGB(pLimits.storageGB || 5);
      setPipelines(pLimits.pipelines || 3);
      setBranches(pLimits.branches || 1);

      setFeatures({
        leadManagement: planToEdit.features?.leadManagement !== false,
        leadExport: Boolean(planToEdit.features?.leadExport),
        whatsapp: planToEdit.features?.whatsapp !== false,
        whatsappBroadcast: Boolean(planToEdit.features?.whatsappBroadcast),
        automation: Boolean(planToEdit.features?.automation),
        commonLeadPool: Boolean(planToEdit.features?.commonLeadPool),
        autoLeadDistribution: Boolean(planToEdit.features?.autoLeadDistribution),
        performanceTracking: Boolean(planToEdit.features?.performanceTracking),
        commissionTracking: Boolean(planToEdit.features?.commissionTracking),
        hierarchy: Boolean(planToEdit.features?.hierarchy),
        smartExitRules: Boolean(planToEdit.features?.smartExitRules),
        advancedAnalytics: Boolean(planToEdit.features?.advancedAnalytics || defaultEnt.features?.advancedAnalytics),
        revenueAnalytics: Boolean(planToEdit.features?.revenueAnalytics),
        customWebhooks: Boolean(planToEdit.features?.customWebhooks || defaultEnt.features?.customWebhooks),
        apiAccess: Boolean(planToEdit.features?.apiAccess),
        customDomain: Boolean(planToEdit.features?.customDomain),
        prioritySupport: Boolean(planToEdit.features?.prioritySupport),
      });

      setWhatsIncluded(Array.isArray(planToEdit.whatsIncluded) ? [...planToEdit.whatsIncluded] : []);
    } else {
      // Reset Defaults for New Plan
      setName('');
      setSlug('');
      setCategory('ORGANIZATION');
      setBadge('');
      setDescription('');
      setDisplayOrder(0);
      setStatus('ACTIVE');
      setVisibility('PUBLIC');
      setMonthlyPrice(1499);
      setMonthlyEnabled(true);
      setYearlyPrice(14999);
      setYearlyEnabled(true);
      setSeats(3);
      setSeatsUnlimited(false);
      setLeads(15000);
      setLeadsUnlimited(false);
      setContactGroups(25);
      setContactGroupsUnlimited(false);
      setMonthlyWhatsApp(10000);
      setMonthlyWhatsAppUnlimited(false);
      setMonthlyBroadcasts(25);
      setMonthlyBroadcastsUnlimited(false);
      setStorageGB(10);
      setPipelines(5);
      setBranches(2);
      setWhatsIncluded([
        'Includes 3 Team Agent Seats',
        'Up to 15,000 shared leads',
        'Agency common pool & lead assignment',
        'Agent performance & commission tracking',
      ]);
    }
    setError(null);
    setSuccessMsg(null);
  }, [planToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddBullet = () => {
    if (newBullet.trim()) {
      setWhatsIncluded([...whatsIncluded, newBullet.trim()]);
      setNewBullet('');
    }
  };

  const handleRemoveBullet = (index) => {
    setWhatsIncluded(whatsIncluded.filter((_, i) => i !== index));
  };

  const handleToggleFeature = (key) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);

      if (!name.trim()) {
        setError('Plan name is required.');
        setLoading(false);
        return;
      }

      const payload = {
        name: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category,
        badge: badge.trim() || null,
        description: description.trim(),
        displayOrder: Number(displayOrder) || 0,
        status,
        visibility,
        pricing: {
          monthly: {
            enabled: monthlyEnabled,
            amount: Number(monthlyPrice) || 0,
            priceInPaise: (Number(monthlyPrice) || 0) * 100,
          },
          yearly: {
            enabled: yearlyEnabled,
            amount: Number(yearlyPrice) || 0,
            priceInPaise: (Number(yearlyPrice) || 0) * 100,
          },
          currency: 'INR',
        },
        limits: {
          seats: seatsUnlimited ? -1 : Math.max(1, Number(seats) || 1),
          leads: leadsUnlimited ? -1 : Math.max(0, Number(leads) || 0),
          contactGroups: contactGroupsUnlimited ? -1 : Math.max(0, Number(contactGroups) || 0),
          monthlyWhatsAppMessages: monthlyWhatsAppUnlimited ? -1 : Math.max(0, Number(monthlyWhatsApp) || 0),
          monthlyBroadcasts: monthlyBroadcastsUnlimited ? -1 : Math.max(0, Number(monthlyBroadcasts) || 0),
          storageGB: Number(storageGB) || 5,
          pipelines: Number(pipelines) || 3,
          branches: Number(branches) || 1,
        },
        features,
        whatsIncluded: whatsIncluded.filter(Boolean),
      };

      let res;
      if (isEditing) {
        res = await api.put(`/super-admin/plans/${planToEdit._id}`, payload);
      } else {
        res = await api.post('/super-admin/plans', payload);
      }

      if (res?.data?.success) {
        setSuccessMsg(res.data.message || 'Plan saved successfully.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setError(res?.data?.message || 'Failed to save plan.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Network error saving plan.');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!planToEdit?._id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.post(`/super-admin/plans/${planToEdit._id}/duplicate`);
      if (res?.data?.success) {
        setSuccessMsg('Plan duplicated successfully as a new Draft.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to duplicate plan.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!planToEdit?._id) return;
    if (!confirm(`Are you sure you want to archive "${planToEdit.name}"? Active subscriptions will not be broken.`)) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.post(`/super-admin/plans/${planToEdit._id}/archive`);
      if (res?.data?.success) {
        setSuccessMsg('Plan archived successfully.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to archive plan.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!planToEdit?._id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.post(`/super-admin/plans/${planToEdit._id}/publish`);
      if (res?.data?.success) {
        setSuccessMsg('Plan unarchived & published active.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to publish plan.');
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async (force = false) => {
    if (!planToEdit?._id) return;
    const confirmPrompt = force
      ? `⚠️ FORCE DELETE WARNING: "${planToEdit.name}" has active subscribers.\nDeleting it will permanently purge it from the database.\n\nAre you ABSOLUTELY sure?`
      : `Are you sure you want to PERMANENTLY DELETE "${planToEdit.name}" from the database?\n\nThis action CANNOT be undone.`;

    if (!confirm(confirmPrompt)) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.delete(`/super-admin/plans/${planToEdit._id}${force ? '?force=true' : ''}`);
      if (res?.data?.success) {
        setSuccessMsg(res.data.message || 'Plan permanently deleted.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setError(res?.data?.message || 'Failed to delete plan.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to delete plan.';
      if (err?.response?.data?.activeSubscribers && !force) {
        if (confirm(`${msg}\n\nDo you want to FORCE PERMANENT DELETE anyway?`)) {
          return handlePermanentDelete(true);
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-[#0d1424] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0a0f1d]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {isEditing ? `Edit Plan: ${name || planToEdit.name}` : 'Create Dynamic Plan'}
                {isEditing && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono font-normal">
                    v{planToEdit.version || 1}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Configure commercial pricing, resource limits, feature checkboxes, and customer bullets.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800/80 bg-[#0c1220] overflow-x-auto text-xs">
          {[
            { id: 'basic', label: '1. Basic Info', icon: Info },
            { id: 'pricing', label: '2. Pricing (₹)', icon: DollarSign },
            { id: 'limits', label: '3. Resource Limits', icon: Layers },
            { id: 'features', label: '4. Feature Checkboxes', icon: Shield },
            { id: 'bullets', label: "5. What's Included", icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-300">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: BASIC INFO */}
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold">Plan Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Business Agency"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold">Slug (Unique URL identifier)</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. business-agency"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="INDIVIDUAL">INDIVIDUAL (Solo Agent / Broker)</option>
                  <option value="ORGANIZATION">ORGANIZATION (Agency / Multi-Seat Team)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold">Badge / Tag (Optional)</label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="e.g. MOST POPULAR, SAVE ~16%"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-slate-400 font-bold">Subtitle / Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Designed for scaling organizations with up to 10 sales agents."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ACTIVE">ACTIVE (Purchasable)</option>
                  <option value="DRAFT">DRAFT (Admin Only)</option>
                  <option value="ARCHIVED">ARCHIVED (Discontinued)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-bold">Display Order</label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PRICING */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="monthlyEnabled"
                      checked={monthlyEnabled}
                      onChange={(e) => setMonthlyEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-800 border-slate-700"
                    />
                    <label htmlFor="monthlyEnabled" className="font-bold text-white text-sm cursor-pointer">
                      Monthly Billing Option
                    </label>
                  </div>
                  <span className="text-slate-400 font-mono text-xs">INR (₹) / month</span>
                </div>

                {monthlyEnabled && (
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      value={monthlyPrice}
                      onChange={(e) => setMonthlyPrice(e.target.value)}
                      placeholder="e.g. 2499"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm font-bold font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="yearlyEnabled"
                      checked={yearlyEnabled}
                      onChange={(e) => setYearlyEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-800 border-slate-700"
                    />
                    <label htmlFor="yearlyEnabled" className="font-bold text-white text-sm cursor-pointer">
                      Yearly Billing Option (Annual Discount)
                    </label>
                  </div>
                  <span className="text-slate-400 font-mono text-xs">INR (₹) / year</span>
                </div>

                {yearlyEnabled && (
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      value={yearlyPrice}
                      onChange={(e) => setYearlyPrice(e.target.value)}
                      placeholder="e.g. 24999"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm font-bold font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: RESOURCE LIMITS */}
          {activeTab === 'limits' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Team Seats */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold">Team Agent Seats</label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seatsUnlimited}
                      onChange={(e) => setSeatsUnlimited(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-800"
                    />
                    Unlimited
                  </label>
                </div>
                {!seatsUnlimited && (
                  <input
                    type="number"
                    value={seats}
                    onChange={(e) => setSeats(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                  />
                )}
              </div>

              {/* Leads */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold">Active Leads Cap</label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={leadsUnlimited}
                      onChange={(e) => setLeadsUnlimited(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-800"
                    />
                    Unlimited (-1)
                  </label>
                </div>
                {!leadsUnlimited && (
                  <input
                    type="number"
                    value={leads}
                    onChange={(e) => setLeads(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                  />
                )}
              </div>

              {/* Contact Groups */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold">Contact Groups</label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contactGroupsUnlimited}
                      onChange={(e) => setContactGroupsUnlimited(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-800"
                    />
                    Unlimited
                  </label>
                </div>
                {!contactGroupsUnlimited && (
                  <input
                    type="number"
                    value={contactGroups}
                    onChange={(e) => setContactGroups(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                  />
                )}
              </div>

              {/* Monthly WhatsApp Messages */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold">WhatsApp Messages / Mo</label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monthlyWhatsAppUnlimited}
                      onChange={(e) => setMonthlyWhatsAppUnlimited(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-800"
                    />
                    Unlimited
                  </label>
                </div>
                {!monthlyWhatsAppUnlimited && (
                  <input
                    type="number"
                    value={monthlyWhatsApp}
                    onChange={(e) => setMonthlyWhatsApp(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                  />
                )}
              </div>

              {/* Monthly Broadcasts */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold">Monthly Broadcast Jobs</label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monthlyBroadcastsUnlimited}
                      onChange={(e) => setMonthlyBroadcastsUnlimited(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-800"
                    />
                    Unlimited
                  </label>
                </div>
                {!monthlyBroadcastsUnlimited && (
                  <input
                    type="number"
                    value={monthlyBroadcasts}
                    onChange={(e) => setMonthlyBroadcasts(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                  />
                )}
              </div>

              {/* Storage (GB) */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <label className="text-slate-300 font-bold">Media & Recording Storage (GB)</label>
                <input
                  type="number"
                  value={storageGB}
                  onChange={(e) => setStorageGB(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* TAB 4: FEATURE CHECKBOXES */}
          {activeTab === 'features' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-xs">
                Tick the features enabled for tenants subscribing to this plan. Features unticked will return HTTP 403 Forbidden with upgrade prompt.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'leadManagement', label: 'Lead Management & Form Builder', desc: 'Core CRM pipeline stages and dynamic forms' },
                  { key: 'leadExport', label: 'Lead Export (Excel, CSV, PDF)', desc: 'Export leads to spreadsheet or PDF formats' },
                  { key: 'whatsapp', label: 'WhatsApp Outreach & Direct Messaging', desc: 'Send WhatsApp messages and voice notes' },
                  { key: 'whatsappBroadcast', label: 'WhatsApp Broadcast Campaigns', desc: 'Run multi-recipient outreach campaign jobs' },
                  { key: 'automation', label: 'Automated Follow-Up Scheduler', desc: 'Automatic reminder alarms and site visit notifications' },
                  { key: 'commonLeadPool', label: 'Agency Common Lead Pool', desc: 'Central unassigned leads pool for agents' },
                  { key: 'autoLeadDistribution', label: 'Auto Lead Distribution Routing', desc: 'Round-robin and rule-based lead assignment' },
                  { key: 'hierarchy', label: 'Multi-Level Team Hierarchy', desc: 'Manager-agent sub-hierarchies and delegation' },
                  { key: 'smartExitRules', label: 'Smart Exit Rules & Transfer Locks', desc: 'Data protection when team members depart' },
                  { key: 'performanceTracking', label: 'Agent Performance Analytics', desc: 'Conversion velocity, call metrics, and conversion rates' },
                  { key: 'commissionTracking', label: 'Commission & Incentive Ledger', desc: 'Automated conversion-based sales payout calculations' },
                  { key: 'advancedAnalytics', label: 'Advanced Master Revenue KPIs', desc: 'Win-loss ratios, revenue forecasts, and funnel metrics' },
                  { key: 'revenueAnalytics', label: 'Revenue Analytics & MRR Trends', desc: 'Detailed financial performance tracking' },
                  { key: 'customWebhooks', label: 'Custom Webhooks & Integrations', desc: 'Inbound & outbound third-party automation webhooks' },
                  { key: 'apiAccess', label: 'REST API Developer Access', desc: 'Programmatic CRM access with API keys' },
                  { key: 'customDomain', label: 'Custom Domain & White-Labeling', desc: 'Custom branding and vanity URLs' },
                  { key: 'prioritySupport', label: 'Priority VIP WhatsApp Support', desc: 'Dedicated SLA and account manager access' },
                ].map((item) => {
                  const isChecked = Boolean(features[item.key]);
                  return (
                    <div
                      key={item.key}
                      onClick={() => handleToggleFeature(item.key)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isChecked
                          ? 'bg-indigo-950/30 border-indigo-500/40 text-white'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className={`mt-0.5 p-1 rounded-md border ${isChecked ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-slate-800'}`}>
                        <Check className={`w-3.5 h-3.5 ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
                      </div>
                      <div>
                        <div className="font-bold text-xs">{item.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: WHAT'S INCLUDED BULLETS */}
          {activeTab === 'bullets' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-xs">
                These bullet points are rendered with green ticks on the customer-facing <span className="font-mono text-indigo-400">/plans</span> pricing page.
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newBullet}
                  onChange={(e) => setNewBullet(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddBullet(); }}
                  placeholder="e.g. Up to 15,000 shared leads"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddBullet}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>

              <div className="space-y-2">
                {whatsIncluded.map((bullet, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800"
                  >
                    <div className="flex items-center gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{bullet}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveBullet(idx)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-[#0a0f1d]">
          <div className="flex flex-wrap items-center gap-2">
            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={handleDuplicate}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                  title="Duplicate as new Draft"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicate</span>
                </button>

                {status !== 'ARCHIVED' ? (
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-bold text-xs transition-all"
                    title="Archive this plan (preserves existing subscriptions)"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold text-xs transition-all"
                    title="Restore / Publish this plan active"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Unarchive / Activate</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handlePermanentDelete(false)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold text-xs transition-all"
                  title="Permanently Delete Plan from Database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Permanently</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? 'Save Changes' : 'Create Plan'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
