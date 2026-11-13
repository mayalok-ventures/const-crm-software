'use client';

import React, { useState } from 'react';
import {
  Building2, Users, Search, Filter, ShieldAlert, Eye,
  Shield, CheckCircle2, XCircle, ArrowRight, Loader2,
  Sparkles, CreditCard, X, ChevronDown, ChevronUp, UserCheck,
  UserX, Trash2, Edit2, ShieldCheck, Mail, Phone, AlertTriangle,
  Ban
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function SuperAdminOrganisationsModule({
  organisations = [],
  pagination = {},
  loading = false,
  search = '',
  onSearchChange = null,
  statusFilter = 'all',
  onStatusFilterChange = null,
  users = [],
  usersPagination = {},
  userSearch = '',
  onUserSearchChange = null,
  userRoleFilter = 'all',
  onUserRoleFilterChange = null,
  onInspectTenant = null,
  onImpersonate = null,
  onStatusUpdate = null,
  onPlanUpdate = null,
  onPageChange = null,
  onUserPageChange = null,
  onRefresh = null,
}) {
  // View Toggle: 'ORGANISATIONS' or 'USERS'
  const [activeView, setActiveView] = useState('ORGANISATIONS');

  // Inline expanded organisation team state: { [orgId]: boolean }
  const [expandedOrgs, setExpandedOrgs] = useState({});
  const [orgUsersMap, setOrgUsersMap] = useState({});
  const [loadingOrgUsers, setLoadingOrgUsers] = useState({});

  // Quick Plan Change Modal State
  const [selectedOrgForPlan, setSelectedOrgForPlan] = useState(null);
  const [quickPlan, setQuickPlan] = useState('team_starter');
  const [quickBillingCycle, setQuickBillingCycle] = useState('monthly');
  const [quickDuration, setQuickDuration] = useState('30');
  const [quickReason, setQuickReason] = useState('');
  const [updatingPlan, setUpdatingPlan] = useState(false);

  // Modals for Ban, Delete, Remove User & Suspend/Delete Org
  const [banModal, setBanModal] = useState({ open: false, user: null, isBanning: true, reason: '' });
  const [deleteUserModal, setDeleteUserModal] = useState({ open: false, user: null, confirmText: '' });
  const [removeUserModal, setRemoveUserModal] = useState({ open: false, user: null, orgId: null, orgName: '' });
  const [suspendOrgModal, setSuspendOrgModal] = useState({ open: false, org: null, isSuspending: true, reason: '' });
  const [deleteOrgModal, setDeleteOrgModal] = useState({ open: false, org: null, confirmText: '' });
  const [actionLoading, setActionLoading] = useState(false);

  // Toggle inline team view for a specific organisation
  const toggleOrgTeam = async (orgId) => {
    const isExpanded = Boolean(expandedOrgs[orgId]);
    if (isExpanded) {
      setExpandedOrgs(prev => ({ ...prev, [orgId]: false }));
      return;
    }

    setExpandedOrgs(prev => ({ ...prev, [orgId]: true }));

    // Fetch team members if not already cached
    if (!orgUsersMap[orgId]) {
      setLoadingOrgUsers(prev => ({ ...prev, [orgId]: true }));
      try {
        const res = await api.get(`/super-admin/users?organisationId=${orgId}&limit=100`);
        if (res.data?.success) {
          setOrgUsersMap(prev => ({ ...prev, [orgId]: res.data.users || [] }));
        }
      } catch (err) {
        console.error('Failed to fetch org team:', err);
      } finally {
        setLoadingOrgUsers(prev => ({ ...prev, [orgId]: false }));
      }
    }
  };

  // Quick User Role Update
  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      const res = await api.patch(`/super-admin/users/${userId}/role`, { role: newRole });
      if (res.data?.success) {
        toast.success(`Role updated to ${newRole} successfully`);
        if (onRefresh) onRefresh();
      } else {
        toast.error(res.data?.message || 'Failed to update role');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user role');
    }
  };

  // 1. Ban / Unban User Handler
  const handleConfirmBanUser = async (e) => {
    e.preventDefault();
    if (!banModal.user) return;
    setActionLoading(true);
    try {
      const endpoint = banModal.isBanning
        ? `/super-admin/users/${banModal.user._id}/ban`
        : `/super-admin/users/${banModal.user._id}/unban`;

      const res = await api.post(endpoint, {
        reason: banModal.reason || 'SuperAdmin administrative action',
      });

      if (res.data?.success) {
        toast.success(res.data.message || `User ${banModal.isBanning ? 'banned' : 'unbanned'} successfully`);
        setBanModal({ open: false, user: null, isBanning: true, reason: '' });
        // Update local user state in orgUsersMap
        setOrgUsersMap(prev => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            updated[key] = updated[key].map(m =>
              m._id === banModal.user._id
                ? {
                    ...m,
                    isActive: !banModal.isBanning,
                    userStatus: banModal.isBanning ? 'banned' : 'active',
                    suspension: { isSuspended: banModal.isBanning },
                  }
                : m
            );
          }
          return updated;
        });
        if (onRefresh) onRefresh();
      } else {
        toast.error(res.data?.message || 'Failed to update user status');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user status');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Permanently Delete User Handler
  const handleConfirmDeleteUser = async (e) => {
    e.preventDefault();
    if (!deleteUserModal.user) return;
    if (deleteUserModal.confirmText.trim().toUpperCase() !== 'DELETE') {
      return toast.error('Please type DELETE to confirm permanent deletion');
    }
    setActionLoading(true);
    try {
      const res = await api.delete(`/super-admin/users/${deleteUserModal.user._id}`);
      if (res.data?.success) {
        toast.success(res.data.message || 'User account permanently deleted');
        setDeleteUserModal({ open: false, user: null, confirmText: '' });
        // Remove from local orgUsersMap
        setOrgUsersMap(prev => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            updated[key] = updated[key].filter(m => m._id !== deleteUserModal.user._id);
          }
          return updated;
        });
        if (onRefresh) onRefresh();
      } else {
        toast.error(res.data?.message || 'Failed to delete user');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Remove User from Organisation Handler
  const handleConfirmRemoveUser = async () => {
    if (!removeUserModal.user || !removeUserModal.orgId) return;
    setActionLoading(true);
    try {
      const res = await api.delete(
        `/super-admin/organisations/${removeUserModal.orgId}/users/${removeUserModal.user._id}`
      );
      if (res.data?.success) {
        toast.success(res.data.message || 'User removed from organisation');
        setOrgUsersMap(prev => ({
          ...prev,
          [removeUserModal.orgId]: (prev[removeUserModal.orgId] || []).filter(
            m => m._id !== removeUserModal.user._id
          ),
        }));
        setRemoveUserModal({ open: false, user: null, orgId: null, orgName: '' });
        if (onRefresh) onRefresh();
      } else {
        toast.error(res.data?.message || 'Failed to remove user');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove user');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Suspend / Activate Organisation Handler
  const handleConfirmSuspendOrg = async (e) => {
    e.preventDefault();
    if (!suspendOrgModal.org) return;
    setActionLoading(true);
    try {
      const targetStatus = suspendOrgModal.isSuspending ? 'SUSPENDED' : 'ACTIVE';
      if (onStatusUpdate) {
        await onStatusUpdate(suspendOrgModal.org._id, targetStatus, suspendOrgModal.reason);
      } else {
        const res = await api.patch(`/super-admin/organisations/${suspendOrgModal.org._id}/status`, {
          status: targetStatus,
          reason: suspendOrgModal.reason || 'Administrative action',
        });
        if (res.data?.success) {
          toast.success(res.data.message || `Organisation ${targetStatus.toLowerCase()} successfully`);
          if (onRefresh) onRefresh();
        }
      }
      setSuspendOrgModal({ open: false, org: null, isSuspending: true, reason: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update organisation status');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Permanently Delete Organisation Handler
  const handleConfirmDeleteOrg = async (e) => {
    e.preventDefault();
    if (!deleteOrgModal.org) return;
    if (deleteOrgModal.confirmText.trim().toUpperCase() !== 'DELETE') {
      return toast.error('Please type DELETE to confirm permanent deletion');
    }
    setActionLoading(true);
    try {
      const res = await api.delete(`/super-admin/organisations/${deleteOrgModal.org._id}`);
      if (res.data?.success) {
        toast.success(res.data.message || 'Organisation permanently deleted');
        setDeleteOrgModal({ open: false, org: null, confirmText: '' });
        if (onRefresh) onRefresh();
      } else {
        toast.error(res.data?.message || 'Failed to delete organisation');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete organisation');
    } finally {
      setActionLoading(false);
    }
  };

  // Plan Override Handler
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
      {/* 1. TOP HEADER & UNIFIED VIEW SWITCHER */}
      <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>Organisations & Users Command Center</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Unified multi-tenant administration: manage client accounts, staff access, ban policies, and terminations.
          </p>
        </div>

        {/* View Switcher Toggle */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs shrink-0">
          <button
            onClick={() => setActiveView('ORGANISATIONS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeView === 'ORGANISATIONS'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Organisations ({organisations.length})</span>
          </button>
          <button
            onClick={() => setActiveView('USERS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeView === 'USERS'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Users & Roles ({usersPagination.total || users.length})</span>
          </button>
        </div>
      </div>

      {/* 2. VIEW A: ORGANISATIONS VIEW */}
      {activeView === 'ORGANISATIONS' && (
        <div className="space-y-4">
          {/* Search & Status Filter */}
          <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                  placeholder="Search organisations by name or owner..."
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
              </select>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Total Managed Tenants: {pagination.total || organisations.length}
            </div>
          </div>

          {/* Organisations Table */}
          <div className="rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0a0f1d] text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Client Account / Organisation</th>
                    <th className="px-4 py-3">Plan Tier</th>
                    <th className="px-4 py-3">Team Roster</th>
                    <th className="px-4 py-3">MRR</th>
                    <th className="px-4 py-3">Tenant Status</th>
                    <th className="px-4 py-3 text-right">Account Governance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {organisations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No organisations registered yet. New signups will appear here automatically.
                      </td>
                    </tr>
                  ) : (
                    organisations.map((org) => {
                      const isExpanded = Boolean(expandedOrgs[org._id]);
                      const orgTeam = orgUsersMap[org._id] || [];
                      const isLoadingTeam = Boolean(loadingOrgUsers[org._id]);
                      const isSuspended = org.status === 'SUSPENDED';

                      return (
                        <React.Fragment key={org._id}>
                          <tr className="hover:bg-slate-900/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{org.organisationName}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {org.owner?.name} ({org.owner?.email || org.owner?.phone})
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase">
                                {org.plan || 'Free'}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <button
                                onClick={() => toggleOrgTeam(org._id)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[11px] font-bold transition-all"
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>{org.userCount || 1} Member{org.userCount === 1 ? '' : 's'}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </td>

                            <td className="px-4 py-3 text-emerald-400 font-mono font-bold">
                              ₹{(org.mrr || 0).toLocaleString('en-IN')}
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold ${
                                  org.status === 'ACTIVE'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : org.status === 'TRIAL'
                                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {org.status || 'ACTIVE'}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Plan override */}
                                <button
                                  onClick={() => handleOpenPlanModal(org)}
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors flex items-center gap-1"
                                  title="Change Plan"
                                >
                                  <CreditCard className="w-3 h-3 text-amber-400" />
                                  <span>Plan</span>
                                </button>

                                {/* Inspect */}
                                {onInspectTenant && (
                                  <button
                                    onClick={() => onInspectTenant(org._id)}
                                    className="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold transition-colors flex items-center gap-1"
                                    title="Inspect Tenant"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Inspect</span>
                                  </button>
                                )}

                                {/* Support Impersonate */}
                                {onImpersonate && org.owner?._id && (
                                  <button
                                    onClick={() => onImpersonate(org.owner._id)}
                                    className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-colors flex items-center gap-1"
                                    title="Support Impersonation"
                                  >
                                    <ShieldAlert className="w-3 h-3" />
                                    <span>Support</span>
                                  </button>
                                )}

                                {/* Suspend / Activate Account */}
                                <button
                                  onClick={() =>
                                    setSuspendOrgModal({
                                      open: true,
                                      org,
                                      isSuspending: !isSuspended,
                                      reason: '',
                                    })
                                  }
                                  className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors flex items-center gap-1 ${
                                    isSuspended
                                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                      : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  }`}
                                  title={isSuspended ? 'Reactivate Organisation Account' : 'Suspend / Ban Organisation Account'}
                                >
                                  {isSuspended ? (
                                    <>
                                      <ShieldCheck className="w-3 h-3" />
                                      <span>Activate</span>
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-3 h-3" />
                                      <span>Suspend</span>
                                    </>
                                  )}
                                </button>

                                {/* Permanently Delete Organisation */}
                                <button
                                  onClick={() => setDeleteOrgModal({ open: true, org, confirmText: '' })}
                                  className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition-colors flex items-center gap-1"
                                  title="Permanently Delete Organisation Account"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Inline Expandable Team Members Roster */}
                          {isExpanded && (
                            <tr className="bg-slate-950/60 border-y border-slate-800/80">
                              <td colSpan={6} className="p-4 pl-8">
                                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <div className="flex items-center gap-2">
                                      <Users className="w-4 h-4 text-indigo-400" />
                                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                                        Team Roster for {org.organisationName}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      {orgTeam.length} Member{orgTeam.length === 1 ? '' : 's'} assigned
                                    </span>
                                  </div>

                                  {isLoadingTeam ? (
                                    <div className="p-4 text-center text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
                                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                                      <span>Loading team roster...</span>
                                    </div>
                                  ) : orgTeam.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-500">
                                      No additional team members found for this organisation.
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs">
                                        <thead className="text-[10px] text-slate-400 uppercase font-bold border-b border-slate-800/80">
                                          <tr>
                                            <th className="py-2 px-3">Name & Contact</th>
                                            <th className="py-2 px-3">Role</th>
                                            <th className="py-2 px-3">Account Status</th>
                                            <th className="py-2 px-3">Role Control</th>
                                            <th className="py-2 px-3 text-right">User Governance</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/40 text-slate-300">
                                          {orgTeam.map((member) => {
                                            const isBanned = !member.isActive || member.userStatus === 'banned' || member.suspension?.isSuspended;

                                            return (
                                              <tr key={member._id} className="hover:bg-slate-800/30">
                                                <td className="py-2 px-3">
                                                  <span className="font-bold text-white block">{member.name}</span>
                                                  <span className="text-[11px] text-slate-400 font-mono">
                                                    {member.email || member.phone}
                                                  </span>
                                                </td>

                                                <td className="py-2 px-3">
                                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                                                    {member.role}
                                                  </span>
                                                </td>

                                                <td className="py-2 px-3">
                                                  <span
                                                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                                                      isBanned
                                                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    }`}
                                                  >
                                                    {isBanned ? 'Banned' : 'Active'}
                                                  </span>
                                                </td>

                                                <td className="py-2 px-3">
                                                  <select
                                                    value={member.role}
                                                    onChange={(e) => handleUpdateUserRole(member._id, e.target.value)}
                                                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500 font-mono"
                                                  >
                                                    <option value="admin">Admin</option>
                                                    <option value="manager">Manager</option>
                                                    <option value="counsellor">Counselor</option>
                                                    <option value="agent">Agent</option>
                                                    <option value="user">Solo User</option>
                                                  </select>
                                                </td>

                                                <td className="py-2 px-3 text-right">
                                                  <div className="flex items-center justify-end gap-1.5">
                                                    {/* Ban / Unban Button */}
                                                    <button
                                                      onClick={() =>
                                                        setBanModal({
                                                          open: true,
                                                          user: member,
                                                          isBanning: !isBanned,
                                                          reason: '',
                                                        })
                                                      }
                                                      className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1 ${
                                                        isBanned
                                                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                          : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                      }`}
                                                      title={isBanned ? 'Unban User' : 'Ban User & Terminate Active Sessions'}
                                                    >
                                                      {isBanned ? (
                                                        <>
                                                          <ShieldCheck className="w-3 h-3" />
                                                          <span>Unban</span>
                                                        </>
                                                      ) : (
                                                        <>
                                                          <Ban className="w-3 h-3" />
                                                          <span>Ban</span>
                                                        </>
                                                      )}
                                                    </button>

                                                    {/* Remove from Org Button */}
                                                    <button
                                                      onClick={() =>
                                                        setConfirmRemoveUserModal({
                                                          open: true,
                                                          user: member,
                                                          orgId: org._id,
                                                          orgName: org.organisationName,
                                                        })
                                                      }
                                                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold transition-all flex items-center gap-1"
                                                      title="Remove User from this Organisation"
                                                    >
                                                      <UserX className="w-3 h-3 text-orange-400" />
                                                      <span>Remove</span>
                                                    </button>

                                                    {/* Permanently Delete Button */}
                                                    <button
                                                      onClick={() =>
                                                        setDeleteUserModal({
                                                          open: true,
                                                          user: member,
                                                          confirmText: '',
                                                        })
                                                      }
                                                      className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold transition-all flex items-center gap-1"
                                                      title="Permanently Delete User Account"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                      <span>Delete</span>
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="p-3 border-t border-slate-800 bg-[#0a0f1d] flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Page {pagination.page} of {pagination.pages}</span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => onPageChange && onPageChange(pagination.page - 1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white"
                  >
                    Prev
                  </button>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => onPageChange && onPageChange(pagination.page + 1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. VIEW B: ALL USERS & ROLES VIEW */}
      {activeView === 'USERS' && (
        <div className="space-y-4">
          {/* User Search & Filters */}
          <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => onUserSearchChange && onUserSearchChange(e.target.value)}
                  placeholder="Search users by name, email, phone..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => onUserRoleFilterChange && onUserRoleFilterChange(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Organisation Admin</option>
                <option value="manager">Manager</option>
                <option value="counsellor">Counselor</option>
                <option value="agent">Agent / Sales Rep</option>
                <option value="user">User / Solo</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Total Platform Users: {usersPagination.total || users.length}
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0a0f1d] text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">User & Contact</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Assigned Organisation</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Role Override</th>
                    <th className="px-4 py-3 text-right">User Governance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No platform users match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isBanned = !u.isActive || u.userStatus === 'banned' || u.suspension?.isSuspended;

                      return (
                        <tr key={u._id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-white">{u.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email || u.phone}</div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                              {u.role}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-300 font-medium">
                            {u.companyId?.companyInfo?.companyName || u.companyId?.name || (u.role === 'admin' ? 'Primary Workspace Owner' : 'Independent')}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                                isBanned
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {isBanned ? 'Banned' : 'Active'}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateUserRole(u._id, e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500 font-mono"
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Manager</option>
                              <option value="counsellor">Counselor</option>
                              <option value="agent">Agent</option>
                              <option value="user">Solo User</option>
                            </select>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Ban / Unban Button */}
                              <button
                                onClick={() =>
                                  setBanModal({
                                    open: true,
                                    user: u,
                                    isBanning: !isBanned,
                                    reason: '',
                                  })
                                }
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 ${
                                  isBanned
                                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                }`}
                                title={isBanned ? 'Unban User' : 'Ban User & Terminate Active Sessions'}
                              >
                                {isBanned ? (
                                  <>
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Unban</span>
                                  </>
                                ) : (
                                  <>
                                    <Ban className="w-3.5 h-3.5" />
                                    <span>Ban</span>
                                  </>
                                )}
                              </button>

                              {/* Permanently Delete Button */}
                              <button
                                onClick={() =>
                                  setDeleteUserModal({
                                    open: true,
                                    user: u,
                                    confirmText: '',
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition-all flex items-center gap-1"
                                title="Permanently Delete User Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {usersPagination.pages > 1 && (
              <div className="p-3 border-t border-slate-800 bg-[#0a0f1d] flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Page {usersPagination.page} of {usersPagination.pages}</span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={usersPagination.page <= 1}
                    onClick={() => onUserPageChange && onUserPageChange(usersPagination.page - 1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white"
                  >
                    Prev
                  </button>
                  <button
                    disabled={usersPagination.page >= usersPagination.pages}
                    onClick={() => onUserPageChange && onUserPageChange(usersPagination.page + 1)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUICK PLAN OVERRIDE MODAL */}
      {selectedOrgForPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#0d1424] border border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Override License Plan
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrgForPlan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyQuickPlan} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Organisation</label>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold">
                  {selectedOrgForPlan.organisationName}
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Select License Plan</label>
                <select
                  value={quickPlan}
                  onChange={(e) => setQuickPlan(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value="basic_solo">Basic Solo (₹499/mo)</option>
                  <option value="smart_solo">Smart Solo (₹999/mo)</option>
                  <option value="power_solo">Power Solo (₹1,499/mo)</option>
                  <option value="team_starter">Team Starter (₹2,499/mo)</option>
                  <option value="business">Business Agency (₹4,999/mo)</option>
                  <option value="enterprise">Enterprise Command (₹9,999/mo)</option>
                  <option value="free">Free / Trial</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Billing Cycle</label>
                  <select
                    value={quickBillingCycle}
                    onChange={(e) => setQuickBillingCycle(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Duration (Days)</label>
                  <select
                    value={quickDuration}
                    onChange={(e) => setQuickDuration(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="14">14 Days (Trial)</option>
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="365">365 Days (1 Year)</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Audit Reason / Justification</label>
                <input
                  type="text"
                  value={quickReason}
                  onChange={(e) => setQuickReason(e.target.value)}
                  placeholder="e.g. VIP client upgrade, promotional contract"
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedOrgForPlan(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingPlan}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shadow-sm shadow-amber-500/20 disabled:opacity-50"
                >
                  {updatingPlan ? 'Applying...' : 'Apply Plan Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BAN / UNBAN USER MODAL */}
      {banModal.open && banModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#0d1424] border border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ban className={`w-4 h-4 ${banModal.isBanning ? 'text-rose-400' : 'text-emerald-400'}`} />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {banModal.isBanning ? 'Ban User Account' : 'Reactivate User Account'}
                </h3>
              </div>
              <button
                onClick={() => setBanModal({ open: false, user: null, isBanning: true, reason: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmBanUser} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="font-bold text-white text-sm">{banModal.user.name}</div>
                <div className="text-slate-400 font-mono text-[11px]">{banModal.user.email || banModal.user.phone}</div>
                <div className="text-slate-500 text-[10px] uppercase font-mono mt-1">Role: {banModal.user.role}</div>
              </div>

              {banModal.isBanning ? (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Security Suspension Enforcement</span>
                  </div>
                  <p className="text-[11px] text-rose-300/90 leading-relaxed">
                    Banning this user will immediately revoke all active JWT login tokens and block authentication across all CRM web and mobile applications.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                  Reactivating this account will clear all suspension flags and allow the user to log back in.
                </div>
              )}

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Audit Reason / Justification</label>
                <input
                  type="text"
                  required={banModal.isBanning}
                  value={banModal.reason}
                  onChange={(e) => setBanModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder={banModal.isBanning ? 'e.g. Policy violation, suspicious activity, client request' : 'e.g. Account reinstated'}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setBanModal({ open: false, user: null, isBanning: true, reason: '' })}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded-xl font-bold transition-colors disabled:opacity-50 ${
                    banModal.isBanning
                      ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-sm shadow-rose-500/20'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20'
                  }`}
                >
                  {actionLoading ? 'Processing...' : banModal.isBanning ? 'Ban User' : 'Reactivate User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERMANENTLY DELETE USER MODAL */}
      {deleteUserModal.open && deleteUserModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#0d1424] border border-rose-900/50 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Permanently Delete User Account
                </h3>
              </div>
              <button
                onClick={() => setDeleteUserModal({ open: false, user: null, confirmText: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeleteUser} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Permanent Deletion Warning</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-200/90">
                  You are about to permanently delete user <span className="font-bold text-white">{deleteUserModal.user.name}</span> ({deleteUserModal.user.email || deleteUserModal.user.phone}).
                  This will remove all workspace memberships and unassign associated leads.
                  <span className="font-bold block mt-1 text-rose-400">This action CANNOT be undone.</span>
                </p>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">
                  Type <span className="text-rose-400 font-mono font-bold">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteUserModal.confirmText}
                  onChange={(e) => setDeleteUserModal(prev => ({ ...prev, confirmText: e.target.value }))}
                  placeholder="DELETE"
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-rose-900/60 text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteUserModal({ open: false, user: null, confirmText: '' })}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || deleteUserModal.confirmText.trim().toUpperCase() !== 'DELETE'}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold transition-colors shadow-sm shadow-rose-600/30"
                >
                  {actionLoading ? 'Deleting...' : 'Permanently Delete User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REMOVE USER FROM ORGANISATION MODAL */}
      {removeUserModal.open && removeUserModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#0d1424] border border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-orange-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Remove User from Organisation
                </h3>
              </div>
              <button
                onClick={() => setRemoveUserModal({ open: false, user: null, orgId: null, orgName: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-white">{removeUserModal.user.name}</span> ({removeUserModal.user.email || removeUserModal.user.phone}) from organisation <span className="font-bold text-amber-400">{removeUserModal.orgName}</span>?
              </p>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                The user&apos;s workspace membership in this tenant will be revoked and any leads currently assigned to them will be moved to unassigned.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRemoveUserModal({ open: false, user: null, orgId: null, orgName: '' })}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmRemoveUser}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Removing...' : 'Remove User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND / ACTIVATE ORGANISATION MODAL */}
      {suspendOrgModal.open && suspendOrgModal.org && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#0d1424] border border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ban className={`w-4 h-4 ${suspendOrgModal.isSuspending ? 'text-amber-400' : 'text-emerald-400'}`} />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {suspendOrgModal.isSuspending ? 'Suspend Organisation Account' : 'Reactivate Organisation Account'}
                </h3>
              </div>
              <button
                onClick={() => setSuspendOrgModal({ open: false, org: null, isSuspending: true, reason: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSuspendOrg} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="font-bold text-white text-sm">{suspendOrgModal.org.organisationName}</div>
                <div className="text-slate-400 font-mono text-[11px]">
                  Owner: {suspendOrgModal.org.owner?.name} ({suspendOrgModal.org.owner?.email || suspendOrgModal.org.owner?.phone})
                </div>
              </div>

              {suspendOrgModal.isSuspending ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  Suspending this organisation will temporarily lock out all associated team members from accessing the CRM workspace.
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                  Reactivating this organisation will unlock the CRM workspace and restore full team access.
                </div>
              )}

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Audit Reason / Justification</label>
                <input
                  type="text"
                  required={suspendOrgModal.isSuspending}
                  value={suspendOrgModal.reason}
                  onChange={(e) => setSuspendOrgModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder={suspendOrgModal.isSuspending ? 'e.g. Non-payment, violation of service terms' : 'e.g. Account reinstated'}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSuspendOrgModal({ open: false, org: null, isSuspending: true, reason: '' })}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded-xl font-bold transition-colors disabled:opacity-50 ${
                    suspendOrgModal.isSuspending
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm shadow-amber-500/20'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20'
                  }`}
                >
                  {actionLoading ? 'Processing...' : suspendOrgModal.isSuspending ? 'Suspend Organisation' : 'Activate Organisation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERMANENTLY DELETE ORGANISATION MODAL */}
      {deleteOrgModal.open && deleteOrgModal.org && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#0d1424] border border-rose-900/50 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Permanently Delete Organisation
                </h3>
              </div>
              <button
                onClick={() => setDeleteOrgModal({ open: false, org: null, confirmText: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeleteOrg} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Permanent Deletion Warning</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-200/90">
                  You are about to permanently delete organisation <span className="font-bold text-white">{deleteOrgModal.org.organisationName}</span>.
                  This will remove the workspace and all workspace memberships.
                  <span className="font-bold block mt-1 text-rose-400">This action CANNOT be undone.</span>
                </p>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">
                  Type <span className="text-rose-400 font-mono font-bold">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteOrgModal.confirmText}
                  onChange={(e) => setDeleteOrgModal(prev => ({ ...prev, confirmText: e.target.value }))}
                  placeholder="DELETE"
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-rose-900/60 text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteOrgModal({ open: false, org: null, confirmText: '' })}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || deleteOrgModal.confirmText.trim().toUpperCase() !== 'DELETE'}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold transition-colors shadow-sm shadow-rose-600/30"
                >
                  {actionLoading ? 'Deleting...' : 'Permanently Delete Organisation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
