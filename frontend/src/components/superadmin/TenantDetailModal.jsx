'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  X, Building2, Users, Layers, Workflow, FileText,
  Radio, CreditCard, History, ShieldAlert, CheckCircle2,
  ExternalLink, Mail, Phone, MapPin, Globe, Sparkles
} from 'lucide-react';

export default function TenantDetailModal({
  isOpen,
  onClose,
  tenantData = null,
  onImpersonate = null,
  onPlanUpdated = null,
}) {
  const [activeSubTab, setActiveSubTab] = useState('overview'); // overview, users, leads, subscription, integrations, audit
  const [targetPlan, setTargetPlan] = useState('free');
  const [targetBillingCycle, setTargetBillingCycle] = useState('monthly');
  const [targetDuration, setTargetDuration] = useState('30');
  const [planReason, setPlanReason] = useState('');
  const [submittingPlan, setSubmittingPlan] = useState(false);

  useEffect(() => {
    if (tenantData?.organisation?.owner?.plan) {
      setTargetPlan(tenantData.organisation.owner.plan);
    }
    if (tenantData?.organisation?.owner?.billingCycle) {
      setTargetBillingCycle(tenantData.organisation.owner.billingCycle);
    }
  }, [tenantData]);

  const handlePlanOverrideSubmit = async (e) => {
    e.preventDefault();
    const tenantId = tenantData?.organisation?._id;
    if (!tenantId) return;

    setSubmittingPlan(true);
    try {
      const res = await api.patch(`/super-admin/organisations/${tenantId}/plan`, {
        planCode: targetPlan,
        billingCycle: targetBillingCycle,
        durationDays: targetDuration === 'lifetime' ? null : Number(targetDuration),
        reason: planReason || `SuperAdmin manual override to ${targetPlan}`,
      });

      if (res.data.success) {
        toast.success(`Plan updated to ${targetPlan.toUpperCase()} successfully! 🚀`);
        if (tenantData.organisation?.owner) {
          tenantData.organisation.owner.plan = targetPlan;
          tenantData.organisation.owner.billingCycle = targetBillingCycle;
        }
        if (onPlanUpdated) {
          onPlanUpdated(tenantId, targetPlan);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update plan');
    } finally {
      setSubmittingPlan(false);
    }
  };

  if (!isOpen || !tenantData) return null;

  const org = tenantData.organisation || {};
  const users = tenantData.users || {};
  const leads = tenantData.leads || {};
  const sub = tenantData.subscription;
  const integrations = tenantData.integrations || [];
  const auditTrail = tenantData.auditTrail || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-4xl bg-[#0a0f1d] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-black/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#070b14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-lg font-bold">
              🏢
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">{org.name}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {org.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Owner: {org.owner?.name} • {org.owner?.email || org.owner?.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onImpersonate && (
              <button
                onClick={() => onImpersonate(org.owner?._id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Support Mode</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="px-4 border-b border-slate-800 bg-[#070b14]/50 flex items-center gap-4 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview & Info', icon: Building2 },
            { id: 'users', label: `Users & Staff (${users.total || 0})`, icon: Users },
            { id: 'leads', label: `CRM Leads (${leads.total || 0})`, icon: Layers },
            { id: 'subscription', label: 'Subscription & Plan', icon: CreditCard },
            { id: 'integrations', label: `Integrations (${integrations.length})`, icon: Radio },
            { id: 'audit', label: `Audit Trail (${auditTrail.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {activeSubTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Company Profile</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Legal Name:</span>
                    <span className="text-white font-medium">{org.companyInfo?.companyName || org.name}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Support Phone:</span>
                    <span className="text-white font-mono">{org.companyInfo?.companyPhone || org.owner?.phone}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Official Email:</span>
                    <span className="text-white font-mono">{org.companyInfo?.companyEmail || org.owner?.email}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Address:</span>
                    <span className="text-white">{org.companyInfo?.companyAddress || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>GST Number:</span>
                    <span className="text-white font-mono">{org.companyInfo?.companyGst || 'Unregistered'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">CRM Telemetry Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Total Leads</span>
                    <span className="text-base font-bold text-white font-mono">{leads.total || 0}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Payment Done</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">{leads.stageCounts?.payment_done || 0}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Active Reps</span>
                    <span className="text-base font-bold text-purple-400 font-mono">{users.agents?.length || 0}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Managers</span>
                    <span className="text-base font-bold text-blue-400 font-mono">{users.managers?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'users' && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Staff and sales representatives in this organization:</div>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Contact</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {(users.all || []).map((u) => (
                      <tr key={u._id} className="hover:bg-slate-900/40">
                        <td className="px-3 py-2 font-medium text-white">{u.name}</td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">{u.email || u.phone}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${u.isActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {u.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === 'leads' && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Recent leads inbound to this organization:</div>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2">Prospect</th>
                      <th className="px-3 py-2">Stage</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {(leads.recent || []).slice(0, 15).map((l) => (
                      <tr key={l._id} className="hover:bg-slate-900/40">
                        <td className="px-3 py-2">
                          <div className="font-medium text-white">{l.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{l.phone}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {l.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">{l.source}</td>
                        <td className="px-3 py-2 text-[11px] text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === 'subscription' && (
            <div className="space-y-4">
              {/* Current Active Plan Overview */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Current Subscription & License Tier</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase">
                    {sub?.planId?.name || org.owner?.plan || 'Free Trial'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Active Plan Code</span>
                    <span className="text-xs font-bold text-amber-400 font-mono mt-0.5 block">{org.owner?.plan || 'free'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Billing Cycle</span>
                    <span className="text-xs font-bold text-white font-mono mt-0.5 block capitalize">{org.owner?.billingCycle || 'monthly'}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">License Status</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono mt-0.5 block">{sub?.status || 'ACTIVE'}</span>
                  </div>
                </div>
              </div>

              {/* Super Admin Manual Subscription Plan Override Form */}
              <div className="p-4 rounded-xl bg-[#0d1424] border border-amber-500/30 space-y-4 text-xs shadow-lg shadow-amber-950/20">
                <div className="flex items-center gap-2 text-amber-400">
                  <Sparkles className="w-4 h-4" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-white">⚡ SuperAdmin Manual Plan Override</h4>
                </div>
                <p className="text-[11px] text-slate-400">
                  Directly assign or modify the subscription plan, team seat limits, and billing cycle for this organization account.
                </p>

                <form onSubmit={handlePlanOverrideSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">Select Target Plan</label>
                      <select
                        value={targetPlan}
                        onChange={(e) => setTargetPlan(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <optgroup label="🏢 Organization / Team Plans">
                          <option value="free">Free Trial (10 Staff Seats • 1,000 Leads)</option>
                          <option value="team_starter">Team Starter (3 Seats • ₹1,499/mo)</option>
                          <option value="business">Business Agency (10 Seats • ₹2,499/mo)</option>
                          <option value="enterprise">Enterprise Command (25 Seats • ₹4,999/mo)</option>
                          <option value="custom_enterprise">Custom Enterprise (100+ Seats • Custom)</option>
                        </optgroup>
                        <optgroup label="👤 Individual / Solo Plans">
                          <option value="basic_solo">Basic Solo (1 Seat • 2k Leads • ₹399/mo)</option>
                          <option value="smart_solo">Smart Solo (1 Seat • 10k Leads • ₹799/mo)</option>
                          <option value="power_solo">Power Solo (1 Seat • 25k Leads • ₹1,299/mo)</option>
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">Billing Cycle</label>
                      <select
                        value={targetBillingCycle}
                        onChange={(e) => setTargetBillingCycle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="monthly">Monthly Cycle</option>
                        <option value="yearly">Yearly Cycle</option>
                        <option value="lifetime">Lifetime / Permanent</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">Plan Validity Duration</label>
                      <select
                        value={targetDuration}
                        onChange={(e) => setTargetDuration(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="30">30 Days (1 Month)</option>
                        <option value="90">90 Days (3 Months)</option>
                        <option value="180">180 Days (6 Months)</option>
                        <option value="365">365 Days (1 Full Year)</option>
                        <option value="lifetime">Never Expire / Lifetime</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">Audit Reason / Note</label>
                      <input
                        type="text"
                        value={planReason}
                        onChange={(e) => setPlanReason(e.target.value)}
                        placeholder="e.g. Granted by SuperAdmin via Phone Support"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={submittingPlan}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{submittingPlan ? 'Updating Subscription...' : 'Apply & Save Subscription Plan'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeSubTab === 'integrations' && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Connected external integrations for this tenant:</div>
              {integrations.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-slate-800 rounded-xl">
                  No active external webhooks or integrations connected yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {integrations.map((int) => (
                    <div key={int._id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white capitalize">{int.type} Integration</div>
                        <div className="text-[11px] text-slate-400">Status: {int.status}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'audit' && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Tenant immutable audit feed:</div>
              <div className="space-y-1.5">
                {auditTrail.slice(0, 15).map((log) => (
                  <div key={log._id} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-amber-400 font-bold text-[11px] mr-2">[{log.action}]</span>
                      <span className="text-slate-300">{log.resourceName || log.resourceType}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
