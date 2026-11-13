'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  X, Building2, Users, Layers, Workflow, FileText,
  Radio, CreditCard, History, ShieldAlert, CheckCircle2,
  ExternalLink, Mail, Phone, MapPin, Globe, Sparkles,
  Ban, UserX, Trash2, AlertTriangle, Loader2
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

  // User Actions State (Ban, Unban, Remove from Org, Permanently Delete)
  const [actionLoading, setActionLoading] = useState(false);
  const [modalAction, setModalAction] = useState({
    type: null, // 'ban' | 'unban' | 'remove' | 'delete'
    user: null,
    reason: '',
    confirmText: '',
  });

  const handleConfirmUserAction = async (e) => {
    if (e) e.preventDefault();
    if (!modalAction.user || !modalAction.type) return;

    const orgId = tenantData?.organisation?._id;
    const userId = modalAction.user._id;

    if (modalAction.type === 'delete' && modalAction.confirmText.trim().toUpperCase() !== 'DELETE') {
      return toast.error('Please type DELETE to confirm permanent deletion');
    }

    setActionLoading(true);
    try {
      if (modalAction.type === 'ban') {
        const res = await api.post(`/super-admin/users/${userId}/ban`, {
          reason: modalAction.reason || 'SuperAdmin administrative action',
        });
        if (res.data?.success) {
          toast.success(res.data.message || 'User banned successfully');
          if (tenantData?.users?.all) {
            tenantData.users.all = tenantData.users.all.map((u) =>
              u._id === userId ? { ...u, isActive: false, userStatus: 'banned', suspension: { isSuspended: true } } : u
            );
          }
          setModalAction({ type: null, user: null, reason: '', confirmText: '' });
        }
      } else if (modalAction.type === 'unban') {
        const res = await api.post(`/super-admin/users/${userId}/unban`);
        if (res.data?.success) {
          toast.success(res.data.message || 'User unbanned successfully');
          if (tenantData?.users?.all) {
            tenantData.users.all = tenantData.users.all.map((u) =>
              u._id === userId ? { ...u, isActive: true, userStatus: 'active', suspension: { isSuspended: false } } : u
            );
          }
          setModalAction({ type: null, user: null, reason: '', confirmText: '' });
        }
      } else if (modalAction.type === 'remove') {
        const res = await api.delete(`/super-admin/organisations/${orgId}/users/${userId}`);
        if (res.data?.success) {
          toast.success(res.data.message || 'User removed from organisation');
          if (tenantData?.users?.all) {
            tenantData.users.all = tenantData.users.all.filter((u) => u._id !== userId);
            if (tenantData.users.total) tenantData.users.total -= 1;
          }
          setModalAction({ type: null, user: null, reason: '', confirmText: '' });
        }
      } else if (modalAction.type === 'delete') {
        const res = await api.delete(`/super-admin/users/${userId}`);
        if (res.data?.success) {
          toast.success(res.data.message || 'User permanently deleted');
          if (tenantData?.users?.all) {
            tenantData.users.all = tenantData.users.all.filter((u) => u._id !== userId);
            if (tenantData.users.total) tenantData.users.total -= 1;
          }
          setModalAction({ type: null, user: null, reason: '', confirmText: '' });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${modalAction.type} user`);
    } finally {
      setActionLoading(false);
    }
  };

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
            { id: 'users', label: `Team Members (${users.total || 0})`, icon: Users },
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
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {(users.all || []).map((u) => {
                      const isBanned = u.userStatus === 'banned' || u.suspension?.isSuspended;
                      return (
                        <tr key={u._id} className="hover:bg-slate-900/40">
                          <td className="px-3 py-2 font-medium text-white">{u.name}</td>
                          <td className="px-3 py-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              {u.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]">{u.email || u.phone}</td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              isBanned
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : u.isActive
                                ? 'text-emerald-400'
                                : 'text-slate-400'
                            }`}>
                              {isBanned ? 'Banned' : u.isActive ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Ban / Unban */}
                              <button
                                onClick={() => setModalAction({ type: isBanned ? 'unban' : 'ban', user: u, reason: '', confirmText: '' })}
                                title={isBanned ? 'Unban User' : 'Ban User'}
                                className={`p-1.5 rounded text-xs transition-colors ${
                                  isBanned
                                    ? 'text-rose-400 hover:bg-rose-500/10'
                                    : 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
                                }`}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>

                              {/* Remove from Org */}
                              <button
                                onClick={() => setModalAction({ type: 'remove', user: u, reason: '', confirmText: '' })}
                                title="Remove User from Organisation"
                                className="p-1.5 rounded text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>

                              {/* Permanently Delete User */}
                              <button
                                onClick={() => setModalAction({ type: 'delete', user: u, reason: '', confirmText: '' })}
                                title="Permanently Delete User"
                                className="p-1.5 rounded text-xs text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

        {/* User Action Confirmation Modal */}
        {modalAction.type && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div
              className="bg-[#0b1329] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    modalAction.type === 'delete'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : modalAction.type === 'remove'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : modalAction.type === 'ban'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {modalAction.type === 'delete' && <Trash2 className="w-5 h-5" />}
                  {modalAction.type === 'remove' && <UserX className="w-5 h-5" />}
                  {modalAction.type === 'ban' && <Ban className="w-5 h-5" />}
                  {modalAction.type === 'unban' && <CheckCircle2 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white capitalize">
                    {modalAction.type === 'ban' && 'Ban User Account'}
                    {modalAction.type === 'unban' && 'Unban User Account'}
                    {modalAction.type === 'remove' && 'Remove User From Organisation'}
                    {modalAction.type === 'delete' && 'Permanently Delete User'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {modalAction.user?.name} ({modalAction.user?.email || modalAction.user?.phone})
                  </p>
                </div>
              </div>

              {modalAction.type === 'ban' && (
                <div className="space-y-3 mb-5">
                  <p className="text-xs text-slate-300">
                    Banning this user will immediately revoke all their active JWT sessions and prevent them from logging in.
                  </p>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Reason for Ban</label>
                    <input
                      type="text"
                      value={modalAction.reason}
                      onChange={(e) => setModalAction((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="e.g. Terms violation, compromised credentials..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

              {modalAction.type === 'unban' && (
                <p className="text-xs text-slate-300 mb-5">
                  Are you sure you want to unban this user? They will be allowed to log into their account again.
                </p>
              )}

              {modalAction.type === 'remove' && (
                <p className="text-xs text-slate-300 mb-5">
                  This user will be removed from <span className="font-semibold text-white">{org.name}</span>. Their leads in this workspace will be safely unassigned to prevent data loss.
                </p>
              )}

              {modalAction.type === 'delete' && (
                <div className="space-y-3 mb-5">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
                    <p className="font-semibold flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Warning: Irreversible Action
                    </p>
                    <p>
                      Permanently deleting this user erases their account and credentials. Any assigned leads will be marked Unassigned to preserve customer data.
                    </p>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Type <span className="text-rose-400 font-mono font-bold">DELETE</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={modalAction.confirmText}
                      onChange={(e) => setModalAction((prev) => ({ ...prev, confirmText: e.target.value }))}
                      placeholder="DELETE"
                      className="w-full px-3 py-2 bg-slate-900 border border-rose-500/30 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalAction({ type: null, user: null, reason: '', confirmText: '' })}
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUserAction}
                  disabled={actionLoading || (modalAction.type === 'delete' && modalAction.confirmText.trim().toUpperCase() !== 'DELETE')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-xs text-white transition-colors ${
                    modalAction.type === 'delete' || modalAction.type === 'ban'
                      ? 'bg-rose-600 hover:bg-rose-500 disabled:opacity-50'
                      : modalAction.type === 'remove'
                      ? 'bg-amber-600 hover:bg-amber-500 disabled:opacity-50'
                      : 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50'
                  }`}
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Confirm</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
