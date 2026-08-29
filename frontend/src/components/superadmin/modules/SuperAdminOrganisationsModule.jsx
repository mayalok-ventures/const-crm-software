'use client';

import React, { useState } from 'react';
import {
  Building2, Search, Filter, ShieldAlert, Eye,
  Shield, CheckCircle2, XCircle, ArrowRight, Loader2,
  Sparkles, CreditCard, X
} from 'lucide-react';

export default function SuperAdminOrganisationsModule({
  organisations = [],
  pagination = {},
  loading = false,
  search = '',
  onSearchChange = null,
  statusFilter = 'all',
  onStatusFilterChange = null,
  onInspectTenant = null,
  onImpersonate = null,
  onStatusUpdate = null,
  onPlanUpdate = null,
  onPageChange = null,
}) {
  // Quick Plan Change Modal State
  const [selectedOrgForPlan, setSelectedOrgForPlan] = useState(null);
  const [quickPlan, setQuickPlan] = useState('team_starter');
  const [quickBillingCycle, setQuickBillingCycle] = useState('monthly');
  const [quickDuration, setQuickDuration] = useState('30');
  const [quickReason, setQuickReason] = useState('');
  const [updatingPlan, setUpdatingPlan] = useState(false);

  const handleOpenPlanModal = (org) => {
    setSelectedOrgForPlan(org);
    setQuickPlan(org.plan || 'free');
    setQuickBillingCycle('monthly');
    setQuickDuration('30');
    setQuickReason(`SuperAdmin manual override for ${org.organisationName}`);
  };

  const handleApplyQuickPlan = async (e) => {
    e.preventDefault();
    if (!selectedOrgForPlan || !onPlanUpdate) return;
    setUpdatingPlan(true);
    try {
      await onPlanUpdate(selectedOrgForPlan._id, {
        planCode: quickPlan,
        billingCycle: quickBillingCycle,
        durationDays: quickDuration === 'lifetime' ? null : Number(quickDuration),
        reason: quickReason,
      });
      setSelectedOrgForPlan(null);
    } finally {
      setUpdatingPlan(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar: Search & Status Filters */}
      <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="Search by organization name, owner, phone..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange && onStatusFilterChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing {organisations.length} of {pagination.total || 0} organisations
        </div>
      </div>

      {/* Organisations Table */}
      <div className="rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0a0f1d] text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Organisation & Owner</th>
                <th className="px-4 py-3">License Plan</th>
                <th className="px-4 py-3">Team Size</th>
                <th className="px-4 py-3">CRM Leads</th>
                <th className="px-4 py-3">Est. MRR</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && organisations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin mx-auto mb-2" />
                    Loading multi-tenant roster...
                  </td>
                </tr>
              )}

              {!loading && organisations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No organisations match your search criteria.
                  </td>
                </tr>
              )}

              {organisations.map((org) => {
                const isBlocked = org.status === 'BLOCKED';
                return (
                  <tr key={org._id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{org.organisationName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {org.ownerName} • <span className="font-mono">{org.ownerEmail || org.ownerPhone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 capitalize">
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {org.usersCount} users ({org.agentsCount} agents)
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {org.leadsCount} leads
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                      ₹{(org.mrr || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono border ${
                          org.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : org.status === 'TRIAL'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {org.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Change Plan Button */}
                        <button
                          onClick={() => handleOpenPlanModal(org)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Manually override subscription plan"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>Set Plan</span>
                        </button>

                        {/* Deep Inspect */}
                        <button
                          onClick={() => onInspectTenant && onInspectTenant(org._id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3 h-3 text-blue-400" />
                          <span>Inspect</span>
                        </button>

                        {/* Impersonate / Support Mode */}
                        <button
                          onClick={() => onImpersonate && onImpersonate(org._id)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Enter Support Mode for this tenant"
                        >
                          <ShieldAlert className="w-3 h-3 text-amber-400" />
                          <span className="hidden sm:inline">Support</span>
                        </button>

                        {/* Status Toggle (Block/Unblock) */}
                        <button
                          onClick={() => onStatusUpdate && onStatusUpdate(org._id, isBlocked ? 'ACTIVE' : 'BLOCKED')}
                          className={`p-1.5 rounded-lg border text-[11px] transition-colors ${
                            isBlocked
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                          }`}
                          title={isBlocked ? 'Unblock Organisation' : 'Block Organisation'}
                        >
                          {isBlocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.pages > 1 && (
          <div className="p-3 border-t border-slate-800 bg-[#0a0f1d] flex items-center justify-between text-xs text-slate-400">
            <span>Page {pagination.page} of {pagination.pages}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => onPageChange && onPageChange(pagination.page - 1)}
                className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => onPageChange && onPageChange(pagination.page + 1)}
                className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Plan Override Modal */}
      {selectedOrgForPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div
            className="w-full max-w-md bg-[#0a0f1d] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <Sparkles className="w-4 h-4" />
                <h3 className="font-bold text-sm text-white">Override Plan: {selectedOrgForPlan.organisationName}</h3>
              </div>
              <button
                onClick={() => setSelectedOrgForPlan(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyQuickPlan} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Target Subscription Plan</label>
                <select
                  value={quickPlan}
                  onChange={(e) => setQuickPlan(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <optgroup label="🏢 Organization / Team Plans">
                    <option value="free">Free Trial (10 Seats • 1k Leads)</option>
                    <option value="team_starter">Team Starter (3 Seats • ₹1,499/mo)</option>
                    <option value="business">Business Agency (10 Seats • ₹2,499/mo)</option>
                    <option value="enterprise">Enterprise Command (25 Seats • ₹4,999/mo)</option>
                    <option value="custom_enterprise">Custom Enterprise (100+ Seats • Custom)</option>
                  </optgroup>
                  <optgroup label="👤 Solo Plans">
                    <option value="basic_solo">Basic Solo (1 Seat • ₹399/mo)</option>
                    <option value="smart_solo">Smart Solo (1 Seat • ₹799/mo)</option>
                    <option value="power_solo">Power Solo (1 Seat • ₹1,299/mo)</option>
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Billing Cycle</label>
                  <select
                    value={quickBillingCycle}
                    onChange={(e) => setQuickBillingCycle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Duration</label>
                  <select
                    value={quickDuration}
                    onChange={(e) => setQuickDuration(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="180">180 Days</option>
                    <option value="365">1 Year</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Audit Reason</label>
                <input
                  type="text"
                  value={quickReason}
                  onChange={(e) => setQuickReason(e.target.value)}
                  placeholder="e.g. Plan upgrade requested by customer"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrgForPlan(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingPlan}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {updatingPlan ? 'Saving...' : 'Apply Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
