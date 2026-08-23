'use client';

import React, { useState, useMemo } from 'react';
import {
  Package, Plus, Edit2, Trash2, CheckCircle2, XCircle, Shield,
  DollarSign, Sparkles, Building, Layers, Check
} from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import Modal from '../ui/Modal';
import ErrorState from '../ui/ErrorState';
import toast from 'react-hot-toast';

export const CRM_INDUSTRIES = [
  { id: 'General', name: 'General SaaS & Enterprise', subIndustries: ['General', 'Solo Professionals', 'Team Workspace'] },
  { id: 'Education', name: 'Education & Admissions (K-12)', subIndustries: ['K-12 Schools', 'Coaching Institutes', 'Higher Ed & Universities'] },
  { id: 'RealEstate', name: 'Real Estate & Builders', subIndustries: ['Residential Projects', 'Commercial Space', 'Brokers & Channel Partners'] },
  { id: 'Events', name: 'Expos, Trade Shows & Events', subIndustries: ['Exhibitor Sales', 'Delegate Registrations', 'Sponsorship Deals'] },
  { id: 'Healthcare', name: 'Healthcare & Clinics', subIndustries: ['Speciality Clinics', 'Hospital Inquiries', 'Tele-consultation'] },
  { id: 'Fintech', name: 'Financial Services & Insurance', subIndustries: ['Wealth Advisory', 'Loan Ingestion', 'Insurance Reps'] },
];

export default function PlansModule({
  plans = [],
  hierarchy = [],
  loading = false,
  error = null,
  onRetry,
  onCreatePlan,
  onUpdatePlan,
  onDeletePlan,
}) {
  const [selectedIndustry, setSelectedIndustry] = useState('General');
  const [selectedSubIndustry, setSelectedSubIndustry] = useState('General');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    industry: 'General',
    subIndustry: 'General',
    accountType: 'INDIVIDUAL',
    tier: 1,
    interval: 'monthly',
    priceInPaise: 99900,
    features: {
      advancedAnalytics: true,
      customWebhooks: true,
      bulkCampaigns: false,
      pipelineCustomization: true,
    },
    defaultEntitlements: {
      maxSeats: 1,
      maxLeads: 1000,
      monthlyWAQuota: 500,
    },
  });

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  // Active industry sub-industries
  const currentIndustryObj = CRM_INDUSTRIES.find((i) => i.id === selectedIndustry) || CRM_INDUSTRIES[0];

  // Filter plans by selected industry & sub-industry
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const ind = p.industry || 'General';
      const sub = p.subIndustry || 'General';
      if (selectedIndustry === 'General' && (!p.industry || p.industry === 'General')) return true;
      return ind === selectedIndustry || ind === currentIndustryObj.name;
    });
  }, [plans, selectedIndustry, currentIndustryObj]);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      industry: selectedIndustry,
      subIndustry: selectedSubIndustry,
      accountType: 'INDIVIDUAL',
      tier: 1,
      interval: 'monthly',
      priceInPaise: 99900,
      features: { advancedAnalytics: true, customWebhooks: true, bulkCampaigns: false, pipelineCustomization: true },
      defaultEntitlements: { maxSeats: 1, maxLeads: 1000, monthlyWAQuota: 500 },
    });
    setShowCreateModal(true);
  };

  const handleOpenEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      code: plan.code,
      name: plan.name,
      description: plan.description || '',
      industry: plan.industry || 'General',
      subIndustry: plan.subIndustry || 'General',
      accountType: plan.accountType || 'INDIVIDUAL',
      tier: plan.tier || 1,
      interval: plan.interval || 'monthly',
      priceInPaise: plan.priceInPaise || (plan.price ? plan.price * 100 : 0),
      features: plan.features || { advancedAnalytics: true },
      defaultEntitlements: plan.defaultEntitlements || { maxSeats: 1, maxLeads: 1000, monthlyWAQuota: 500 },
    });
    setShowCreateModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPlan) {
        await onUpdatePlan(editingPlan._id, formData);
        toast.success('Subscription plan updated!');
      } else {
        await onCreatePlan(formData);
        toast.success('New plan created in hierarchy!');
      }
      setShowCreateModal(false);
    } catch (err) {
      toast.error(err.message || 'Failed saving plan');
    }
  };

  return (
    <div className="space-y-4">
      {/* ─────────────────────────────────────────────────────────────
          1. INDUSTRY & COMMERCIAL HIERARCHY SELECTOR
      ────────────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-amber-400" />
              Industry-Specific Commercial Plans Hierarchy
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Configure specialized pricing packages and feature entitlements across targeted verticals
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-amber-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Plan</span>
          </button>
        </div>

        {/* Industry Pill Selector */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pt-1">
          {CRM_INDUSTRIES.map((ind) => {
            const isActive = selectedIndustry === ind.id;
            return (
              <button
                key={ind.id}
                onClick={() => {
                  setSelectedIndustry(ind.id);
                  setSelectedSubIndustry(ind.subIndustries[0] || 'General');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {ind.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. PLANS GRID CARDS
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredPlans.map((plan) => {
          const price = plan.priceInPaise ? plan.priceInPaise / 100 : (plan.price || 0);
          return (
            <div
              key={plan._id || plan.code}
              className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                      {plan.code}
                    </span>
                    <h4 className="font-bold text-sm text-white">{plan.name}</h4>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                    plan.accountType === 'ORGANIZATION'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}>
                    {plan.accountType || 'SOLO'}
                  </span>
                </div>

                <div className="text-xl font-bold font-mono text-emerald-400 flex items-baseline gap-1">
                  ₹{price.toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-slate-400 font-sans">
                    / {plan.interval || 'month'}
                  </span>
                </div>

                {plan.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{plan.description}</p>
                )}

                {/* Quotas & Entitlements */}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-1 text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Lead Storage Cap:</span>
                    <span className="font-mono text-white font-semibold">
                      {(plan.defaultEntitlements?.maxLeads || 1000).toLocaleString('en-IN')} Leads
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">WhatsApp Messages:</span>
                    <span className="font-mono text-white font-semibold">
                      {(plan.defaultEntitlements?.monthlyWAQuota || 500).toLocaleString('en-IN')} / mo
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Team Seats:</span>
                    <span className="font-mono text-white font-semibold">
                      {plan.defaultEntitlements?.maxSeats || 1} Seats
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400">
                  Tier {plan.tier || 1} • {plan.industry || 'General'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(plan)}
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                    title="Edit Plan"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePlan && onDeletePlan(plan._id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition-colors"
                    title="Deactivate Plan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPlans.length === 0 && !loading && (
        <div className="p-8 rounded-xl bg-[#0d1424] border border-dashed border-slate-800 text-center text-xs text-slate-400">
          No commercial plans configured for <strong className="text-white">{currentIndustryObj.name}</strong> yet. Click "Create Plan" above to add the first package.
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. CREATE / EDIT PLAN MODAL
      ────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create Commercial Subscription Plan'}
        subtitle="Configure vertical-tailored pricing, quotas, and feature entitlements"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Plan Code (Unique)</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                disabled={Boolean(editingPlan)}
                placeholder="e.g. EDU_SCHOOL_PRO_V1"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Plan Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. K-12 Admissions Growth"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Target Industry</label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {CRM_INDUSTRIES.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Account Entity Type</label>
              <select
                value={formData.accountType}
                onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="INDIVIDUAL">Solo User (Agent)</option>
                <option value="ORGANIZATION">Organization (Company)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Price (₹ INR)</label>
              <input
                type="number"
                value={formData.priceInPaise / 100}
                onChange={(e) => setFormData({ ...formData, priceInPaise: Number(e.target.value) * 100 })}
                required
                min={0}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-300 block mb-1">Plan Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Highlight the target persona, features included, and commercial limits..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm"
            >
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
