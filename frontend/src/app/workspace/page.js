'use client';
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser, hasPermission } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import {
  Users, UserPlus, Shield, ShieldCheck, Mail, Check, Copy,
  Trash2, Settings, Building2, RefreshCw, AlertCircle, Award,
  Clock, CheckCircle2, ChevronRight, UserX, Plus, Edit2, Lock,
  Key, Globe, UserCheck, Eye, Sparkles, Filter, X as CloseIcon, Sliders
} from 'lucide-react';

import { useQueryClient } from '@tanstack/react-query';

function WorkspaceTeamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab') || 'team';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(initialTab); // 'team' | 'roles' | 'settings'
  const [currentUser, setCurrentUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState([]);
  const [systemRoles, setSystemRoles] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [permissionCatalogue, setPermissionCatalogue] = useState({});
  const [isOwnerOrManager, setIsOwnerOrManager] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('counsellor');
  const [inviteCustomRoleId, setInviteCustomRoleId] = useState('');
  const [inviteTeam, setInviteTeam] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');

  // Role Editor state
  const [selectedRole, setSelectedRole] = useState(null);
  const [isEditingCustomRole, setIsEditingCustomRole] = useState(false);
  const [customRoleForm, setCustomRoleForm] = useState({
    name: '',
    description: '',
    permissions: [],
  });
  const [savingRole, setSavingRole] = useState(false);

  // System Role Dynamic Editing State
  const [isEditingSystemRole, setIsEditingSystemRole] = useState(false);
  const [systemRoleForm, setSystemRoleForm] = useState({
    roleName: '',
    permissions: [],
  });
  const [savingSystemRole, setSavingSystemRole] = useState(false);

  // Member Overrides Editing State
  const [editingMemberOverrides, setEditingMemberOverrides] = useState(null);
  const [memberOverridesList, setMemberOverridesList] = useState([]);
  const [savingMemberOverrides, setSavingMemberOverrides] = useState(false);

  // Member Edit Role Modal
  const [editingMember, setEditingMember] = useState(null);
  const [memberRoleForm, setMemberRoleForm] = useState({
    role: 'counsellor',
    customRoleId: '',
    team: '',
  });

  // Workspace settings state
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    autoAdvanceStageOnNote: false,
    showFollowUpOnCreate: true,
    maxSnoozeCount: 3,
  });

  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    try {
      const [wsRes, memRes, invRes, rolesRes] = await Promise.all([
        api.get('/workspace/current'),
        api.get('/workspace/members').catch(() => ({ data: { data: [] } })),
        api.get('/workspace/invitations').catch(() => ({ data: { data: [] } })),
        api.get('/workspace/roles').catch(() => ({ data: { systemRoles: [], customRoles: [], permissionCatalogue: {} } })),
      ]);

      const ws = wsRes.data?.data;
      setWorkspace(ws);
      if (ws) {
        queryClient.setQueryData(['workspace', 'current'], ws);
        setSettingsForm({
          name: ws.name || '',
          autoAdvanceStageOnNote: ws.settings?.autoAdvanceStageOnNote || false,
          showFollowUpOnCreate: ws.settings?.showFollowUpOnCreate ?? true,
          maxSnoozeCount: ws.settings?.maxSnoozeCount || 3,
        });
      }

      const memberList = memRes.data?.data || [];
      queryClient.setQueryData(['workspace', 'members'], memberList);
      setMembers(memberList);

      const invList = invRes.data?.data || [];
      setInvitations(invList);

      const sysRoles = rolesRes.data?.systemRoles || [];
      const cRoles = rolesRes.data?.customRoles || [];
      const pCat = rolesRes.data?.permissionCatalogue || {};

      setSystemRoles(sysRoles);
      setCustomRoles(cRoles);
      setPermissionCatalogue(pCat);

      // Default select first role if not set
      setSelectedRole(prev => prev || sysRoles[0]);

      const u = getUser();
      setCurrentUser(u);

      const myMem = memberList.find(m => String(m.userId?._id || m.userId) === String(u?._id));
      const role = myMem?.role || (u?.role === 'superadmin' ? 'owner' : 'counsellor');
      setIsOwnerOrManager(role === 'owner' || role === 'manager');
    } catch (err) {
      console.error('loadWorkspaceData error:', err);
      toast.error('Failed to load workspace data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const updateAuth = () => {
      const u = getUser();
      if (!u) {
        router.replace('/login');
        return;
      }
      setCurrentUser(u);
    };
    updateAuth();
    window.addEventListener('user-updated', updateAuth);

    // Seed from TanStack Query cache if available
    const cachedWs = queryClient.getQueryData(['workspace', 'current']);
    const cachedMembers = queryClient.getQueryData(['workspace', 'members']);
    if (cachedWs) {
      setWorkspace(cachedWs);
      setSettingsForm({
        name: cachedWs.name || '',
        autoAdvanceStageOnNote: cachedWs.settings?.autoAdvanceStageOnNote || false,
        showFollowUpOnCreate: cachedWs.settings?.showFollowUpOnCreate ?? true,
        maxSnoozeCount: cachedWs.settings?.maxSnoozeCount || 3,
      });
      setLoading(false);
    }
    if (cachedMembers && cachedMembers.length > 0) {
      setMembers(cachedMembers);
    }

    loadWorkspaceData();
    return () => window.removeEventListener('user-updated', updateAuth);
  }, [router, loadWorkspaceData, queryClient]);

  // Handle Send Invite
  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.trim()) {
      toast.error('Please enter teammate email');
      return;
    }

    setSendingInvite(true);
    try {
      const payload = {
        email: inviteEmail.trim(),
        role: inviteRole,
        team: inviteTeam.trim() || undefined,
      };
      if (inviteRole === 'custom' && inviteCustomRoleId) {
        payload.customRoleId = inviteCustomRoleId;
      }

      const res = await api.post('/workspace/invitations', payload);
      toast.success(res.data?.message || 'Invitation sent successfully!');
      
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const inviteUrl = res.data?.inviteUrl ? `${origin}${res.data.inviteUrl}` : `${origin}/invite?token=${res.data?.data?.token}`;
      setGeneratedInviteLink(inviteUrl);
      
      loadWorkspaceData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  // Revoke Invitation
  const handleRevokeInvitation = async (id) => {
    if (!confirm('Are you sure you want to revoke this pending invitation?')) return;
    try {
      await api.delete(`/workspace/invitations/${id}`);
      toast.success('Invitation revoked');
      loadWorkspaceData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke invitation');
    }
  };

  // Resend / Refresh Invitation
  const handleResendInvitation = async (id) => {
    try {
      const res = await api.post(`/workspace/invitations/${id}/resend`);
      toast.success(res.data?.message || 'Invitation refreshed and extended for 7 days');
      loadWorkspaceData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to refresh invitation');
    }
  };

  // Update Member Role & Team
  const handleSaveMemberRole = async (e) => {
    e.preventDefault();
    if (!editingMember) return;
    try {
      const payload = {
        role: memberRoleForm.role,
        team: memberRoleForm.team,
        customRoleId: memberRoleForm.role === 'custom' ? memberRoleForm.customRoleId : null,
      };

      await api.put(`/workspace/members/${editingMember._id}/role`, payload);
      toast.success('Member role updated successfully');
      setEditingMember(null);
      loadWorkspaceData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update member role';
      toast.error(msg);
    }
  };

  // Deactivate Member
  const handleDeactivateMember = async (memberId, memberName) => {
    if (!confirm(`Are you sure you want to deactivate ${memberName || 'this member'}?`)) return;
    try {
      await api.delete(`/workspace/members/${memberId}`);
      toast.success('Member deactivated from workspace');
      loadWorkspaceData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deactivate member');
    }
  };

  // Workspace Settings Save
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put('/workspace/current', {
        name: settingsForm.name,
        settings: {
          autoAdvanceStageOnNote: settingsForm.autoAdvanceStageOnNote,
          showFollowUpOnCreate: settingsForm.showFollowUpOnCreate,
          maxSnoozeCount: Number(settingsForm.maxSnoozeCount) || 3,
        },
      });
      toast.success('Workspace settings updated successfully');
      loadWorkspaceData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Role Editor: Permissions Category Grouping
  const groupedPermissions = useMemo(() => {
    const groups = {};
    Object.values(permissionCatalogue).forEach(p => {
      const cat = p.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [permissionCatalogue]);

  // Handle toggling permission on Custom Role Form
  const handleTogglePermission = (permKey) => {
    setCustomRoleForm(prev => {
      const existingIdx = prev.permissions.findIndex(p => p.key === permKey);
      if (existingIdx >= 0) {
        return {
          ...prev,
          permissions: prev.permissions.filter(p => p.key !== permKey),
        };
      } else {
        return {
          ...prev,
          permissions: [...prev.permissions, { key: permKey, scope: 'workspace' }],
        };
      }
    });
  };

  // Handle changing scope on Custom Role Form
  const handleChangeScope = (permKey, newScope) => {
    setCustomRoleForm(prev => {
      const existingIdx = prev.permissions.findIndex(p => p.key === permKey);
      if (existingIdx >= 0) {
        const copy = [...prev.permissions];
        copy[existingIdx] = { ...copy[existingIdx], scope: newScope };
        return { ...prev, permissions: copy };
      } else {
        return {
          ...prev,
          permissions: [...prev.permissions, { key: permKey, scope: newScope }],
        };
      }
    });
  };

  // Save Custom Role
  const handleSaveCustomRole = async (e) => {
    e.preventDefault();
    if (!customRoleForm.name || !customRoleForm.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    setSavingRole(true);
    try {
      if (customRoleForm._id) {
        await api.put(`/workspace/roles/${customRoleForm._id}`, {
          name: customRoleForm.name.trim(),
          description: customRoleForm.description?.trim(),
          permissions: customRoleForm.permissions,
        });
        toast.success(`Role "${customRoleForm.name}" updated successfully`);
      } else {
        await api.post('/workspace/roles', {
          name: customRoleForm.name.trim(),
          description: customRoleForm.description?.trim(),
          permissions: customRoleForm.permissions,
        });
        toast.success(`Role "${customRoleForm.name}" created successfully`);
      }
      setIsEditingCustomRole(false);
      loadWorkspaceData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save role');
    } finally {
      setSavingRole(false);
    }
  };

  // Delete Custom Role
  const handleDeleteCustomRole = async (roleId, roleName) => {
    if (!confirm(`Are you sure you want to delete role "${roleName}"?`)) return;
    try {
      await api.delete(`/workspace/roles/${roleId}`);
      toast.success('Custom role deleted successfully');
      loadWorkspaceData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

  // System Role Dynamic Editing Handlers
  const handleToggleSystemRolePermission = (permKey) => {
    setSystemRoleForm(prev => {
      const existingIdx = prev.permissions.findIndex(p => p.key === permKey);
      if (existingIdx >= 0) {
        return {
          ...prev,
          permissions: prev.permissions.filter(p => p.key !== permKey),
        };
      } else {
        return {
          ...prev,
          permissions: [...prev.permissions, { key: permKey, scope: 'workspace' }],
        };
      }
    });
  };

  const handleChangeSystemRoleScope = (permKey, newScope) => {
    setSystemRoleForm(prev => {
      const existingIdx = prev.permissions.findIndex(p => p.key === permKey);
      if (existingIdx >= 0) {
        const copy = [...prev.permissions];
        copy[existingIdx] = { ...copy[existingIdx], scope: newScope };
        return { ...prev, permissions: copy };
      } else {
        return {
          ...prev,
          permissions: [...prev.permissions, { key: permKey, scope: newScope }],
        };
      }
    });
  };

  const handleSaveSystemRole = async () => {
    if (!systemRoleForm.roleName) return;
    setSavingSystemRole(true);
    try {
      await api.put(`/workspace/roles/system/${systemRoleForm.roleName}`, {
        permissions: systemRoleForm.permissions,
      });
      toast.success(`Standard role "${systemRoleForm.roleName}" permissions updated`);
      setIsEditingSystemRole(false);
      await loadWorkspaceData();
      window.dispatchEvent(new Event('user-updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update system role');
    } finally {
      setSavingSystemRole(false);
    }
  };

  // Member Overrides Handlers
  const openMemberOverridesModal = (member) => {
    setEditingMemberOverrides(member);
    setMemberOverridesList(member.permissionOverrides ? JSON.parse(JSON.stringify(member.permissionOverrides)) : []);
  };

  const handleToggleMemberOverride = (permKey, defaultScope = 'workspace') => {
    setMemberOverridesList(prev => {
      const existingIdx = prev.findIndex(p => p.key === permKey);
      if (existingIdx === -1) {
        // Not overridden -> Explicitly Granted
        return [...prev, { key: permKey, scope: defaultScope, granted: true }];
      } else if (prev[existingIdx].granted === true) {
        // Explicitly Granted -> Explicitly Revoked
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], granted: false };
        return updated;
      } else {
        // Explicitly Revoked -> Remove override (Inherit from role)
        return prev.filter(p => p.key !== permKey);
      }
    });
  };

  const handleChangeMemberOverrideScope = (permKey, newScope) => {
    setMemberOverridesList(prev => {
      const existingIdx = prev.findIndex(p => p.key === permKey);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], scope: newScope };
        return updated;
      }
      return prev;
    });
  };

  const handleResetMemberOverrides = () => {
    setMemberOverridesList([]);
  };

  const handleSaveMemberOverrides = async () => {
    if (!editingMemberOverrides?._id) return;
    setSavingMemberOverrides(true);
    try {
      await api.put(`/workspace/members/${editingMemberOverrides._id}/permissions`, {
        permissionOverrides: memberOverridesList,
      });
      toast.success(`Permissions customized for ${editingMemberOverrides.name || 'member'}`);
      setEditingMemberOverrides(null);
      await loadWorkspaceData();
      window.dispatchEvent(new Event('user-updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update member permissions');
    } finally {
      setSavingMemberOverrides(false);
    }
  };

  // Helper to copy text to clipboard
  const copyToClipboard = (text, label = 'Link') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'owner': return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'manager': return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'counsellor': return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'auditor': return 'bg-slate-100 text-slate-800 border-slate-300';
      default: return 'bg-purple-100 text-purple-900 border-purple-300';
    }
  };

  return (
    <div className="app-container">
      <BottomNav active="workspace" />

      <main className="main-content">
        <div style={{ width: '100%' }} className="pb-mobile-nav max-w-5xl mx-auto">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold m-0 text-slate-900 flex items-center gap-2.5" suppressHydrationWarning>
                  <Building2 size={24} className="text-indigo-600 shrink-0" />
                  {workspace?.name || 'Workspace & Team Management'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 border border-indigo-200 text-indigo-700" suppressHydrationWarning>
                  {members.length <= 1 ? 'Solo Mode' : 'Team Workspace'}
                </span>
              </div>
              <p className="m-0 mt-1 text-xs sm:text-sm text-slate-500">
                Manage your admission consulting organization, invite counsellors, configure dynamic permissions, and set workflow policies.
              </p>
            </div>

            {hasPermission(currentUser, 'members.invite') && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedInviteLink('');
                    setInviteEmail('');
                    setInviteTeam('');
                    setShowInviteModal(true);
                  }}
                  className="btn btn-primary text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-indigo-100"
                >
                  <UserPlus size={16} />
                  <span>Invite Teammate</span>
                </button>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                activeTab === 'team'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Users size={16} />
              <span>Team & Members ({members.length})</span>
            </button>

            {hasPermission(currentUser, 'roles.manage') && (
              <button
                type="button"
                onClick={() => setActiveTab('roles')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                  activeTab === 'roles'
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck size={16} />
                <span>Dynamic Roles & Permissions ({systemRoles.length + customRoles.length})</span>
              </button>
            )}

            {hasPermission(currentUser, 'workspace.settings.edit') && (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                  activeTab === 'settings'
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Sliders size={16} />
                <span>Workspace Policies & Settings</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="animate-spin mx-auto mb-2 text-indigo-500" size={24} />
              <p className="text-xs">Loading workspace details...</p>
            </div>
          ) : (
            <div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* TAB 1: TEAM MEMBERS & INVITATIONS */}
              {/* ───────────────────────────────────────────────────────────── */}
              {activeTab === 'team' && (
                <div className="space-y-6">

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Account Owner</span>
                      <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                        <Award size={15} className="text-amber-500" />
                        {workspace?.ownerId?.name || currentUser?.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {workspace?.ownerId?.email || currentUser?.email}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Active Team Size</span>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">
                        {members.length} {members.length === 1 ? 'Member' : 'Members'}
                      </div>
                      <div className="text-[11px] text-indigo-600 font-semibold mt-0.5">
                        {members.length <= 1 ? 'Solo Consultant Default' : 'Collaborative Agency'}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Pending Invitations</span>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">
                        {invitations.length} {invitations.length === 1 ? 'Invite' : 'Invites'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        7-day expiration lifespan
                      </div>
                    </div>
                  </div>

                  {/* Active Members Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 m-0 flex items-center gap-2">
                        <Users size={16} className="text-indigo-600" />
                        Active Workspace Members ({members.length})
                      </h3>
                      <span className="text-xs text-slate-400">Strict server-side authorization</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-4">Member</th>
                            <th className="py-3 px-4">Role</th>
                            <th className="py-3 px-4">Team</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {members.map((member, idx) => {
                            const isThisUser = String(member.userId?._id || member.userId) === String(currentUser?._id);
                            const memberKey = member._id || member.id || member.userId?._id || member.userId || `member-${idx}`;
                            return (
                              <tr key={memberKey} className="hover:bg-slate-50/50 transition">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    {member.name || member.userId?.name || 'Unnamed Member'}
                                    {isThisUser && (
                                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-[9px] font-extrabold text-indigo-700">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                    {member.email || member.userId?.email || 'N/A'}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase border ${getRoleBadgeClass(member.role)}`}>
                                      {member.customRole ? `${member.customRole} (Custom)` : member.role}
                                    </span>
                                    {member.hasCustomPermissions && (
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200" title="Custom individual overrides configured">
                                        Customized
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-500 font-medium">
                                  {member.team || 'General'}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    {member.status || 'Active'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {hasPermission(currentUser, 'roles.manage') && member.role !== 'owner' && (
                                      <button
                                        type="button"
                                        onClick={() => openMemberOverridesModal(member)}
                                        className="p-1.5 rounded-lg border border-purple-200 text-purple-700 bg-purple-50/50 hover:bg-purple-100 transition"
                                        title="Customize User Permissions"
                                      >
                                        <Key size={13} />
                                      </button>
                                    )}

                                    {hasPermission(currentUser, 'members.edit_role') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingMember(member);
                                          setMemberRoleForm({
                                            role: member.role || 'counsellor',
                                            customRoleId: member.customRoleId?._id || member.customRoleId || '',
                                            team: member.team || '',
                                          });
                                        }}
                                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition"
                                        title="Change Role & Permissions"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                    )}

                                    {hasPermission(currentUser, 'members.deactivate') && !isThisUser && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeactivateMember(member._id, member.name || member.userId?.name)}
                                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 transition"
                                        title="Deactivate Member"
                                      >
                                        <UserX size={13} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pending Invitations Section */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 m-0 flex items-center gap-2">
                        <Mail size={16} className="text-amber-600" />
                        Pending Teammate Invitations ({invitations.length})
                      </h3>
                      <span className="text-xs text-slate-400">Cryptographic tokens with auto-expiry</span>
                    </div>

                    {invitations.length === 0 ? (
                      <div className="p-6 text-center text-slate-400">
                        <p className="text-xs m-0">No pending invitations. Click "Invite Teammate" to add counsellors to your workspace.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {invitations.map((inv, idx) => {
                          const origin = typeof window !== 'undefined' ? window.location.origin : '';
                          const directLink = `${origin}/invite?token=${inv.token}`;
                          const isExpired = new Date(inv.expiresAt) < new Date();
                          const invKey = inv._id || inv.id || inv.token || `invitation-${idx}`;

                          return (
                            <div key={invKey} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-2">
                                  <span>{inv.email}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getRoleBadgeClass(inv.role)}`}>
                                    {inv.role}
                                  </span>
                                  {isExpired ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-rose-100 text-rose-700">
                                      Expired
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                      <Clock size={11} />
                                      Valid until {new Date(inv.expiresAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                                  <span>Team: {inv.team || 'General'}</span>
                                  <span>•</span>
                                  <span>Invited by: {inv.invitedBy?.name || 'Owner'}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(directLink, 'Invitation Link')}
                                  className="btn btn-outline text-xs flex items-center gap-1.5 py-1.5 px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                >
                                  <Copy size={13} />
                                  <span>Copy Link</span>
                                </button>

                                {hasPermission(currentUser, 'members.invite') && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleResendInvitation(inv._id)}
                                      className="btn btn-outline text-xs flex items-center gap-1.5 py-1.5 px-3 border-slate-200 text-slate-700 hover:bg-slate-50"
                                      title="Extend 7-day token"
                                    >
                                      <RefreshCw size={13} />
                                      <span>Resend</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleRevokeInvitation(inv._id)}
                                      className="btn text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 py-1.5 px-3 rounded-lg"
                                    >
                                      <Trash2 size={13} />
                                      <span>Revoke</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* TAB 2: DYNAMIC ROLES & PERMISSIONS EDITOR */}
              {/* ───────────────────────────────────────────────────────────── */}
              {activeTab === 'roles' && hasPermission(currentUser, 'roles.manage') && (
                <div className="space-y-6">
                  
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-indigo-950 m-0 flex items-center gap-2">
                        <ShieldCheck size={18} className="text-indigo-600" />
                        Dynamic Role-Based Access Control (RBAC)
                      </h4>
                      <p className="text-[11px] sm:text-xs text-indigo-800 m-0 mt-0.5">
                        Define custom roles or inspect default system matrices. Permissions enforce deny-by-default server-side boundaries across records (`own`, `team`, `workspace`).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingCustomRole(true);
                        setCustomRoleForm({
                          _id: null,
                          name: '',
                          description: '',
                          permissions: [
                            { key: 'leads.view', scope: 'own' },
                            { key: 'leads.create', scope: 'workspace' },
                            { key: 'followups.create', scope: 'own' },
                          ],
                        });
                      }}
                      className="btn btn-primary text-xs flex items-center gap-1.5 shrink-0"
                    >
                      <Plus size={14} />
                      <span>Create Custom Role</span>
                    </button>
                  </div>

                  {/* Role Selector and Permission Details Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column: Roles List */}
                    <div className="space-y-4">
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">
                          Standard System Roles (Editable by Admin)
                        </h4>
                        <div className="space-y-2">
                          {systemRoles.map(role => {
                            const isSelected = selectedRole?.name === role.name && !isEditingCustomRole;
                            return (
                              <button
                                key={role.name}
                                type="button"
                                onClick={() => {
                                  setSelectedRole(role);
                                  setIsEditingCustomRole(false);
                                }}
                                className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-indigo-50 border-indigo-400 shadow-sm'
                                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/70'
                                }`}
                              >
                                <div>
                                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                    <Lock size={12} className="text-slate-400" />
                                    <span>{role.label || role.name}</span>
                                  </div>
                                  <p className="text-[10.5px] text-slate-500 m-0 mt-0.5 line-clamp-1">
                                    {role.description}
                                  </p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${getRoleBadgeClass(role.name)}`}>
                                  {role.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="border-t border-slate-100 my-4 pt-3 flex items-center justify-between">
                          <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider m-0">
                            Custom Roles ({customRoles.length})
                          </h4>
                        </div>

                        {customRoles.length === 0 ? (
                          <div className="p-4 rounded-xl bg-slate-50 text-center text-slate-400 text-xs">
                            No custom roles created yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {customRoles.map((role, idx) => {
                              const isSelected = selectedRole?._id === role._id || (isEditingCustomRole && customRoleForm._id === role._id);
                              const roleKey = role._id || role.name || `custom-role-${idx}`;
                              return (
                                <div
                                  key={roleKey}
                                  className={`p-3 rounded-xl border transition flex items-center justify-between ${
                                    isSelected
                                      ? 'bg-indigo-50 border-indigo-400 shadow-sm'
                                      : 'bg-white border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <div
                                    className="cursor-pointer flex-1"
                                    onClick={() => {
                                      setSelectedRole(role);
                                      setIsEditingCustomRole(false);
                                    }}
                                  >
                                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                      <Key size={12} className="text-indigo-500" />
                                      <span>{role.name}</span>
                                    </div>
                                    <p className="text-[10.5px] text-slate-500 m-0 mt-0.5 line-clamp-1">
                                      {role.description || `${role.permissions?.length || 0} permissions`}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsEditingCustomRole(true);
                                        setCustomRoleForm({
                                          _id: role._id,
                                          name: role.name,
                                          description: role.description || '',
                                          permissions: role.permissions || [],
                                        });
                                      }}
                                      className="p-1 rounded text-slate-400 hover:text-indigo-600"
                                      title="Edit Custom Role"
                                    >
                                      <Edit2 size={13} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCustomRole(role._id, role.name)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600"
                                      title="Delete Role"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right 2 Columns: Permissions Matrix Editor */}
                    <div className="md:col-span-2">
                      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        
                        {/* Editor Header */}
                        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900 m-0">
                                {isEditingCustomRole
                                  ? (customRoleForm._id ? `Edit Role: ${customRoleForm.name}` : 'New Custom Role')
                                  : isEditingSystemRole
                                    ? `Edit Standard Role: ${systemRoleForm.roleName}`
                                    : `Role Details: ${selectedRole?.label || selectedRole?.name}`}
                              </h3>
                              <span className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase border ${getRoleBadgeClass(isEditingSystemRole ? systemRoleForm.roleName : selectedRole?.name)}`}>
                                {isEditingSystemRole ? 'Customizing Standard Role' : (selectedRole?.isSystem ? 'Standard System Role' : 'Custom Role')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 m-0 mt-0.5">
                              {isEditingCustomRole
                                ? 'Configure permissions and record access scopes for this custom role'
                                : isEditingSystemRole
                                  ? `Admins can customize default permissions for all teammates with the ${systemRoleForm.roleName} role`
                                  : (selectedRole?.description || 'Inspect effective permissions and record scopes')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {!isEditingCustomRole && !isEditingSystemRole && selectedRole?.isSystem && selectedRole?.name !== 'owner' && hasPermission(currentUser, 'roles.manage') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditingSystemRole(true);
                                  setIsEditingCustomRole(false);
                                  setSystemRoleForm({
                                    roleName: selectedRole.name,
                                    permissions: selectedRole.permissions ? JSON.parse(JSON.stringify(selectedRole.permissions)) : [],
                                  });
                                }}
                                className="btn btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
                              >
                                <Edit2 size={13} />
                                <span>Edit Role Permissions</span>
                              </button>
                            )}

                            {!isEditingCustomRole && !isEditingSystemRole && selectedRole?.isSystem && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditingCustomRole(true);
                                  setIsEditingSystemRole(false);
                                  setCustomRoleForm({
                                    _id: null,
                                    name: `${selectedRole.label || selectedRole.name} (Custom Copy)`,
                                    description: `Copy of ${selectedRole.label || selectedRole.name} with custom scope overrides`,
                                    permissions: selectedRole.permissions || [],
                                  });
                                }}
                                className="btn btn-outline text-xs flex items-center gap-1.5 py-1.5 px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                              >
                                <Copy size={13} />
                                <span>Duplicate as Custom Role</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Custom Role Form Inputs (When Editing) */}
                        {isEditingCustomRole && (
                          <div className="p-4 bg-indigo-50/40 border-b border-indigo-100 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  Role Name *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={customRoleForm.name}
                                  onChange={e => setCustomRoleForm(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="e.g. Senior Visa Counsellor"
                                  className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  Description
                                </label>
                                <input
                                  type="text"
                                  value={customRoleForm.description}
                                  onChange={e => setCustomRoleForm(prev => ({ ...prev, description: e.target.value }))}
                                  placeholder="e.g. Manages international visa pipelines and enquiries"
                                  className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Interactive Permission Categories Matrix */}
                        <div className="p-4 space-y-5 max-h-[600px] overflow-y-auto">
                          {Object.entries(groupedPermissions).map(([category, perms]) => (
                            <div key={category} className="border border-slate-200 rounded-xl overflow-hidden">
                              <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                                  {category}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {perms.length} Permissions
                                </span>
                              </div>

                              <div className="divide-y divide-slate-100">
                                {perms.map(p => {
                                  const isEditing = isEditingCustomRole || isEditingSystemRole;
                                  const effectiveList = isEditingCustomRole
                                    ? customRoleForm.permissions
                                    : isEditingSystemRole
                                      ? systemRoleForm.permissions
                                      : (selectedRole?.permissions || []);
                                  const assigned = effectiveList.find(item => item.key === p.key);
                                  const isChecked = !!assigned;
                                  const currentScope = assigned?.scope || 'workspace';

                                  return (
                                    <div
                                      key={p.key}
                                      className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition ${
                                        isChecked ? 'bg-indigo-50/20' : 'bg-white'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2.5">
                                        {isEditing ? (
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                              if (isEditingCustomRole) handleTogglePermission(p.key);
                                              else if (isEditingSystemRole) handleToggleSystemRolePermission(p.key);
                                            }}
                                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            id={`chk_${p.key}`}
                                          />
                                        ) : (
                                          <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                            isChecked ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                                          }`}>
                                            {isChecked ? <Check size={10} strokeWidth={3} /> : <span className="text-[9px]">✕</span>}
                                          </div>
                                        )}

                                        <div>
                                          <label
                                            htmlFor={isEditing ? `chk_${p.key}` : undefined}
                                            className="text-xs font-bold text-slate-900 block cursor-pointer m-0"
                                          >
                                            {p.label || p.key}
                                          </label>
                                          <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                                            {p.description}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Scope Selector */}
                                      <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-auto">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Scope:</span>
                                        {isEditing && isChecked ? (
                                          <select
                                            value={currentScope}
                                            onChange={e => {
                                              if (isEditingCustomRole) handleChangeScope(p.key, e.target.value);
                                              else if (isEditingSystemRole) handleChangeSystemRoleScope(p.key, e.target.value);
                                            }}
                                            className="text-[11px] font-bold rounded-lg border border-slate-200 bg-white px-2 py-1 outline-none text-slate-800"
                                          >
                                            <option value="own">Own Records</option>
                                            <option value="team">Team Records</option>
                                            <option value="workspace">All Workspace</option>
                                          </select>
                                        ) : (
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            isChecked
                                              ? (currentScope === 'own' ? 'bg-amber-100 text-amber-800' : currentScope === 'team' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800')
                                              : 'bg-slate-100 text-slate-400'
                                          }`}>
                                            {isChecked ? currentScope : 'Disabled'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Editor Action Buttons (When Editing) */}
                        {isEditingCustomRole && (
                          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                            <button
                              type="button"
                              onClick={() => setIsEditingCustomRole(false)}
                              className="btn btn-outline text-xs px-4 py-2"
                              disabled={savingRole}
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              onClick={handleSaveCustomRole}
                              disabled={savingRole}
                              className="btn btn-primary text-xs px-5 py-2 flex items-center gap-2"
                            >
                              {savingRole && <RefreshCw size={13} className="animate-spin" />}
                              <span>{savingRole ? 'Saving...' : 'Save Role Permissions'}</span>
                            </button>
                          </div>
                        )}

                        {isEditingSystemRole && (
                          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs text-slate-600">
                              Editing standard system role: <span className="font-extrabold text-indigo-700 uppercase">{systemRoleForm.roleName}</span>. Modifies permissions for all teammates with this role.
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => setIsEditingSystemRole(false)}
                                className="btn btn-outline text-xs px-4 py-2"
                                disabled={savingSystemRole}
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                onClick={handleSaveSystemRole}
                                disabled={savingSystemRole}
                                className="btn btn-primary text-xs px-5 py-2 flex items-center gap-2"
                              >
                                {savingSystemRole && <RefreshCw size={13} className="animate-spin" />}
                                <span>{savingSystemRole ? 'Saving...' : 'Save Standard Role Permissions'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* TAB 3: WORKSPACE POLICIES & SETTINGS */}
              {/* ───────────────────────────────────────────────────────────── */}
              {activeTab === 'settings' && hasPermission(currentUser, 'workspace.settings.edit') && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm max-w-2xl">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                    <Sliders size={18} className="text-indigo-600" />
                    Operational Workflow Policies
                  </h3>
                  <p className="text-xs text-slate-500 m-0 mt-1 mb-6">
                    Configure core automated pipeline behaviors and reminder thresholds for all counsellors in this workspace.
                  </p>

                  <form onSubmit={handleSaveSettings} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Consultancy Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={settingsForm.name}
                        onChange={e => setSettingsForm({ ...settingsForm, name: e.target.value })}
                        disabled={!isOwnerOrManager}
                        placeholder="e.g. EduGuide Admission Consultants"
                        className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-4">
                      {/* Policy 1: Auto advance stage on note */}
                      <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50/50 cursor-pointer transition">
                        <input
                          type="checkbox"
                          checked={settingsForm.autoAdvanceStageOnNote}
                          onChange={e => setSettingsForm({ ...settingsForm, autoAdvanceStageOnNote: e.target.checked })}
                          disabled={!isOwnerOrManager}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            Auto-Advance Pipeline Stage on Note Addition
                          </div>
                          <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                            When disabled (recommended), logging notes or call remarks will NOT alter candidate pipeline stage unless explicitly selected by the counsellor.
                          </p>
                        </div>
                      </label>

                      {/* Policy 2: Show follow-up on create */}
                      <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50/50 cursor-pointer transition">
                        <input
                          type="checkbox"
                          checked={settingsForm.showFollowUpOnCreate}
                          onChange={e => setSettingsForm({ ...settingsForm, showFollowUpOnCreate: e.target.checked })}
                          disabled={!isOwnerOrManager}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            Prompt Follow-Up Appointment on Candidate Creation
                          </div>
                          <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                            Requires or prompts counsellors to book an immediate introductory call reminder when capturing a new enquiry.
                          </p>
                        </div>
                      </label>

                      {/* Policy 3: Max Snooze Count */}
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/30">
                        <label className="block text-xs font-bold text-slate-900 mb-1">
                          Maximum Snooze Delays Allowed
                        </label>
                        <p className="text-[11px] text-slate-500 m-0 mb-2">
                          Limits how many times a counsellor can quick-snooze a follow-up before the system enforces an explicit appointment reschedule with recorded reason.
                        </p>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            max="5"
                            value={settingsForm.maxSnoozeCount}
                            onChange={e => setSettingsForm({ ...settingsForm, maxSnoozeCount: e.target.value })}
                            disabled={!isOwnerOrManager}
                            className="w-24 text-xs font-bold rounded-lg border border-slate-200 bg-white px-3 py-1.5 outline-none focus:border-indigo-500"
                          />
                          <span className="text-xs text-slate-500">snoozes (Default: 3)</span>
                        </div>
                      </div>
                    </div>

                    {isOwnerOrManager && (
                      <div className="pt-4 border-t border-slate-100 flex justify-end">
                        <button
                          type="submit"
                          disabled={savingSettings}
                          className="btn btn-primary text-xs px-5 py-2.5 flex items-center gap-2"
                        >
                          {savingSettings && <RefreshCw size={14} className="animate-spin" />}
                          <span>{savingSettings ? 'Saving Policies...' : 'Save Workspace Policies'}</span>
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}

            </div>
          )}

        </div>
      </main>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: INVITE TEAMMATE MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showInviteModal && hasPermission(currentUser, 'members.invite') && (
        <div
          className="fixed inset-0 z-[9600] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 sm:p-6 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-indigo-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0">Invite Teammate</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            {generatedInviteLink ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <CheckCircle2 size={28} className="text-emerald-600 mx-auto mb-2" />
                  <h4 className="text-xs font-bold text-emerald-900 m-0">Invitation Ready!</h4>
                  <p className="text-[11px] text-emerald-700 m-0 mt-1">
                    Share this link with your teammate. It grants direct access to your workspace upon acceptance.
                  </p>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono break-all">
                  <span className="truncate flex-1 text-slate-600">{generatedInviteLink}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedInviteLink, 'Invitation Link')}
                    className="btn btn-primary text-xs py-1 px-3 shrink-0 flex items-center gap-1"
                  >
                    <Copy size={12} />
                    <span>Copy</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-outline w-full text-xs py-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Teammate Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="counsellor@consultancy.com"
                    className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assign Role *
                  </label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                  >
                    <option value="counsellor">Counsellor (Assigned Candidates & Follow-ups)</option>
                    <option value="manager">Manager (Team Operations & Assignments)</option>
                    <option value="auditor">Auditor (Read-Only Inspection)</option>
                    {customRoles.map(cr => (
                      <option key={cr._id} value="custom">Custom: {cr.name}</option>
                    ))}
                  </select>
                </div>

                {inviteRole === 'custom' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Select Custom Role Definition *
                    </label>
                    <select
                      value={inviteCustomRoleId}
                      onChange={e => setInviteCustomRoleId(e.target.value)}
                      className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                    >
                      <option value="">Select custom role...</option>
                      {customRoles.map(cr => (
                        <option key={cr._id} value={cr._id}>{cr.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Department / Team (Optional)
                  </label>
                  <input
                    type="text"
                    value={inviteTeam}
                    onChange={e => setInviteTeam(e.target.value)}
                    placeholder="e.g. Study Abroad, Engineering Intake"
                    className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="btn btn-outline text-xs px-4 py-2"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={sendingInvite}
                    className="btn btn-primary text-xs px-5 py-2 flex items-center gap-2"
                  >
                    {sendingInvite && <RefreshCw size={13} className="animate-spin" />}
                    <span>{sendingInvite ? 'Generating...' : 'Generate Invite Link'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: EDIT MEMBER ROLE MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      {editingMember && hasPermission(currentUser, 'members.edit_role') && (
        <div
          className="fixed inset-0 z-[9600] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setEditingMember(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 sm:p-6 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-indigo-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0">
                  Update Member Role
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveMemberRole} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Member
                </label>
                <div className="text-xs font-bold text-slate-900 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  {editingMember.name || editingMember.userId?.name} ({editingMember.email || editingMember.userId?.email})
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Role *
                </label>
                <select
                  value={memberRoleForm.role}
                  onChange={e => setMemberRoleForm({ ...memberRoleForm, role: e.target.value })}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                >
                  <option value="owner">Owner (Complete Authority)</option>
                  <option value="manager">Manager (Team Operations)</option>
                  <option value="counsellor">Counsellor (Assigned Candidates)</option>
                  <option value="auditor">Auditor (Read-Only Inspection)</option>
                  {customRoles.map(cr => (
                    <option key={cr._id} value="custom">Custom: {cr.name}</option>
                  ))}
                </select>
                {editingMember.role === 'owner' && (
                  <p className="text-[10.5px] text-amber-600 m-0 mt-1">
                    ⚠️ Last Owner Protection: Cannot demote the sole active owner of this workspace.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Team / Department
                </label>
                <input
                  type="text"
                  value={memberRoleForm.team}
                  onChange={e => setMemberRoleForm({ ...memberRoleForm, team: e.target.value })}
                  placeholder="e.g. Undergraduate Admissions"
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="btn btn-outline text-xs px-4 py-2"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary text-xs px-5 py-2"
                >
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3: MEMBER PERMISSION OVERRIDES MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      {editingMemberOverrides && hasPermission(currentUser, 'roles.manage') && (
        <div
          className="fixed inset-0 z-[9700] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setEditingMemberOverrides(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-purple-600" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0">
                    Customize Member Permissions
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase border ${getRoleBadgeClass(editingMemberOverrides.role)}`}>
                    {editingMemberOverrides.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500 m-0 mt-0.5">
                  Overriding permissions for <strong className="text-slate-800">{editingMemberOverrides.name || editingMemberOverrides.userId?.name}</strong> ({editingMemberOverrides.email || editingMemberOverrides.userId?.email}).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMemberOverrides(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            {/* Overrides Explanation Banner */}
            <div className="bg-purple-50/60 border-b border-purple-100 px-4 py-2.5 text-[11px] text-purple-900 flex items-center justify-between gap-3">
              <span>
                <strong>Override Precedence:</strong> Explicit overrides take immediate effect over role defaults.
              </span>
              <button
                type="button"
                onClick={handleResetMemberOverrides}
                className="text-[10.5px] font-bold text-purple-700 hover:text-purple-900 underline shrink-0"
              >
                Reset All to Role Defaults
              </button>
            </div>

            {/* Modal Body: Grouped Permissions with 3-State Controls */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {Object.entries(groupedPermissions).map(([category, perms]) => (
                <div key={category} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      {category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {perms.length} Permissions
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {perms.map(p => {
                      const override = memberOverridesList.find(o => o.key === p.key);
                      const isOverridden = !!override;
                      const isGranted = override ? override.granted === true : false;
                      const isRevoked = override ? override.granted === false : false;
                      const currentScope = override?.scope || 'workspace';

                      return (
                        <div key={p.key} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/40 transition">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">{p.label || p.key}</span>
                              {isOverridden ? (
                                isGranted ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                                    Explicitly Granted
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-800">
                                    Explicitly Revoked
                                  </span>
                                )
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold text-slate-400 bg-slate-100">
                                  Role Default
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] text-slate-500 m-0 mt-0.5">{p.description}</p>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            {/* Scope Selector if Granted */}
                            {isGranted && (
                              <select
                                value={currentScope}
                                onChange={e => handleChangeMemberOverrideScope(p.key, e.target.value)}
                                className="text-[10.5px] font-bold rounded-lg border border-slate-200 bg-white px-2 py-1 outline-none text-slate-800"
                              >
                                <option value="own">Own</option>
                                <option value="team">Team</option>
                                <option value="workspace">Workspace</option>
                              </select>
                            )}

                            {/* 3-State Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleMemberOverride(p.key)}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                                !isOverridden
                                  ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                  : isGranted
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                    : 'border-rose-300 bg-rose-50 text-rose-700'
                              }`}
                            >
                              {!isOverridden ? 'Default' : (isGranted ? '✓ Granted' : '✕ Revoked')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                {memberOverridesList.length} custom {memberOverridesList.length === 1 ? 'override' : 'overrides'} configured
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMemberOverrides(null)}
                  className="btn btn-outline text-xs px-4 py-2"
                  disabled={savingMemberOverrides}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMemberOverrides}
                  disabled={savingMemberOverrides}
                  className="btn btn-primary text-xs px-5 py-2 flex items-center gap-2 bg-purple-600 hover:bg-purple-700 border-purple-600"
                >
                  {savingMemberOverrides && <RefreshCw size={13} className="animate-spin" />}
                  <span>{savingMemberOverrides ? 'Saving...' : 'Apply Overrides'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function WorkspaceTeamPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-slate-400">
        <RefreshCw className="animate-spin mx-auto mb-2 text-indigo-500" size={24} />
        <p className="text-xs">Loading workspace...</p>
      </div>
    }>
      <WorkspaceTeamContent />
    </Suspense>
  );
}
