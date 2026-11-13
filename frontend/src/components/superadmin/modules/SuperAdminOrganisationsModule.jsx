'use client';

import React, { useState } from 'react';
import {
  Building2, Users, Search, Filter, ShieldAlert, Eye,
  Shield, CheckCircle2, XCircle, ArrowRight, Loader2,
  Sparkles, CreditCard, X, ChevronDown, ChevronUp, UserCheck,
  UserX, Trash2, Edit2, ShieldCheck, Mail, Phone
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

  // Quick User Status Toggle
  const handleToggleUserStatus = async (user) => {
    try {
      const newStatus = !user.isActive;
      const res = await api.patch(`/super-admin/users/${user._id}/status`, {
        isActive: newStatus,
        userStatus: newStatus ? 'active' : 'suspended',
      });
      if (res.data?.success) {
        toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
        if (onRefresh) onRefresh();
      } else {
        toast.error(res.data?.message || 'Failed to update status');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user status');
    }
  };

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
            Unified multi-tenant administration: manage client workspaces, team staff, and role permissions.
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
            <span>Organisations ({pagination.total || organisations.length})</span>
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
            <span>All Users ({usersPagination.total || users.length})</span>
          </button>
        </div>
      </div>

      {/* 2. VIEW A: ORGANISATIONS VIEW */}
      {activeView === 'ORGANISATIONS' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                  placeholder="Search by organisation name, owner, phone..."
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
                    <th className="px-4 py-3">Team Roster</th>
                    <th className="px-4 py-3">Est. MRR</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loading && organisations.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        <Loader2 className="w-5 h-5 text-amber-400 animate-spin mx-auto mb-2" />
                        Loading organisations...
                      </td>
                    </tr>
                  )}

                  {!loading && organisations.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No organisations registered yet. New signups will appear here automatically.
                      </td>
                    </tr>
                  )}

                  {organisations.map((org) => {
                    const isExpanded = Boolean(expandedOrgs[org._id]);
                    const orgTeam = orgUsersMap[org._id] || [];
                    const isLoadingTeam = Boolean(loadingOrgUsers[org._id]);

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
                              <button
                                onClick={() => handleOpenPlanModal(org)}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors flex items-center gap-1"
                                title="Change Plan"
                              >
                                <CreditCard className="w-3 h-3 text-amber-400" />
                                <span>Plan</span>
                              </button>

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
                                          <th className="py-2 px-3 text-right">Role Control</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/40 text-slate-300">
                                        {orgTeam.map((member) => (
                                          <tr key={member._id} className="hover:bg-slate-800/30">
                                            <td className="py-2 px-3">
                                              <span className="font-bold text-white block">{member.name}</span>
                                              <span className="text-[11px] text-slate-400 font-mono">{member.email || member.phone}</span>
                                            </td>

                                            <td className="py-2 px-3">
                                              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                                                {member.role}
                                              </span>
                                            </td>

                                            <td className="py-2 px-3">
                                              <button
                                                onClick={() => handleToggleUserStatus(member)}
                                                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold transition-all ${
                                                  member.isActive
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-rose-500/20 hover:text-rose-300'
                                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-emerald-500/20 hover:text-emerald-300'
                                                }`}
                                                title="Click to toggle status"
                                              >
                                                {member.isActive ? 'Active' : 'Disabled'}
                                              </button>
                                            </td>

                                            <td className="py-2 px-3 text-right">
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
                                          </tr>
                                        ))}
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
                  })}
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
                    <th className="px-4 py-3">Joined Date</th>
                    <th className="px-4 py-3 text-right">Role Override</th>
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
                    users.map((u) => (
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
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold transition-all ${
                              u.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-rose-500/20 hover:text-rose-300'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-emerald-500/20 hover:text-emerald-300'
                            }`}
                            title="Click to toggle status"
                          >
                            {u.isActive ? 'Active' : 'Disabled'}
                          </button>
                        </td>

                        <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}
                        </td>

                        <td className="px-4 py-3 text-right">
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
                      </tr>
                    ))
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
    </div>
  );
}
