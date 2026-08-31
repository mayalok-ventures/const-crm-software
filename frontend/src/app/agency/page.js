'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser, isOwner, isManager, isRealEstateTenant } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import FormsModule from '@/components/admin/modules/FormsModule';
import {
  Users, Shield, Award, FileText, CheckCircle2, XCircle, Plus, Trash2,
  Edit2, Check, X, DollarSign, AlertTriangle, TrendingUp, HelpCircle, UserPlus,
  ShieldCheck, RefreshCw, BarChart2, Settings, ArrowRight, UserCheck, Clock,
  Sliders, ArrowRightLeft, MapPin, Sparkles, CheckSquare, Search, Flame, Filter
} from 'lucide-react';

const PERMISSION_OPTIONS = [
  { value: 'LEAD_VIEW', label: 'LEAD_VIEW', desc: 'Read-only access to company leads pipeline.' },
  { value: 'LEAD_CREATE', label: 'LEAD_CREATE', desc: 'Create new leads in the CRM.' },
  { value: 'LEAD_EDIT', label: 'LEAD_EDIT', desc: 'Allows updating details and editing lead profile fields.' },
  { value: 'LEAD_DELETE', label: 'LEAD_DELETE', desc: 'Allows deleting leads from pipeline.' },
  { value: 'LEAD_CLAIM', label: 'LEAD_CLAIM', desc: 'Self-claim new and unclaimed leads.' },
  { value: 'LEAD_ASSIGN', label: 'LEAD_ASSIGN', desc: 'Assign leads to sales agents.' },
  { value: 'LEAD_TRANSFER_REQUEST', label: 'LEAD_TRANSFER_REQUEST', desc: 'Initiate lead transfer request to teammates.' },
  { value: 'LEAD_TRANSFER_APPROVE', label: 'LEAD_TRANSFER_APPROVE', desc: 'Approve or reject pending lead transfers.' },
  { value: 'LEAD_FORCE_TRANSFER', label: 'LEAD_FORCE_TRANSFER', desc: 'Force immediate lead transfer override without approvals.' },
  { value: 'LEAD_VIEW_TEAM', label: 'LEAD_VIEW_TEAM', desc: 'View all leads of team members under manager supervision.' },
  { value: 'LEAD_VIEW_ALL', label: 'LEAD_VIEW_ALL', desc: 'View all organization leads across all agents and teams.' },
  { value: 'STAFF_VIEW', label: 'STAFF_VIEW', desc: 'View staff members and agency roster.' },
  { value: 'STAFF_CREATE', label: 'STAFF_CREATE', desc: 'Add new staff members to the organization.' },
  { value: 'STAFF_EDIT', label: 'STAFF_EDIT', desc: 'Edit staff member details and assignments.' },
  { value: 'ROLE_VIEW', label: 'ROLE_VIEW', desc: 'View custom company roles structure.' },
  { value: 'ROLE_CREATE', label: 'ROLE_CREATE', desc: 'Create and configure custom agent/manager roles.' },
  { value: 'ROLE_EDIT', label: 'ROLE_EDIT', desc: 'Edit existing custom company roles.' },
  { value: 'ROLE_DELETE', label: 'ROLE_DELETE', desc: 'Delete custom company roles.' },
  { value: 'REPORT_VIEW_TEAM', label: 'REPORT_VIEW_TEAM', desc: 'View team performance analytics and conversion reports.' },
  { value: 'REPORT_VIEW_AGENCY', label: 'REPORT_VIEW_AGENCY', desc: 'View full agency-wide revenue and sales analytics.' },
  { value: 'INCENTIVE_VIEW_SELF', label: 'INCENTIVE_VIEW_SELF', desc: 'Allows sales reps to view their own incentive earnings.' },
  { value: 'INCENTIVE_VIEW_TEAM', label: 'INCENTIVE_VIEW_TEAM', desc: 'Allows managers to view team incentives.' },
  { value: 'INCENTIVE_APPROVE', label: 'INCENTIVE_APPROVE', desc: 'Approve or reject agent milestone incentives.' },
  { value: 'INCENTIVE_MODIFY', label: 'INCENTIVE_MODIFY', desc: 'Modify incentive policy configurations.' },
  { value: 'INCENTIVE_MANAGE', label: 'INCENTIVE_MANAGE', desc: 'Full incentive management access.' },
  { value: 'EXPORT_LEADS', label: 'EXPORT_LEADS', desc: 'Export leads and reports to CSV / Excel.' },
  { value: 'ACTIVITY_VIEW', label: 'ACTIVITY_VIEW', desc: 'View global audit activity feed of company actions.' },
  { value: 'AUDIT_VIEW', label: 'AUDIT_VIEW', desc: 'View full security audit trails.' },
];

const DEFAULT_SYSTEM_ROLES = [
  {
    _id: 'default_manager',
    name: 'manager',
    roleType: 'MANAGER',
    isSystemRole: true,
    description: 'Supervise sales agents, distribute leads, approve transfers, and view team reports',
    permissions: [
      'LEAD_VIEW', 'LEAD_CREATE', 'LEAD_EDIT', 'LEAD_CLAIM', 'LEAD_ASSIGN',
      'LEAD_TRANSFER_REQUEST', 'LEAD_TRANSFER_APPROVE', 'LEAD_FORCE_TRANSFER',
      'LEAD_VIEW_TEAM', 'STAFF_VIEW', 'STAFF_CREATE', 'STAFF_EDIT',
      'ROLE_VIEW', 'REPORT_VIEW_TEAM', 'INCENTIVE_VIEW_TEAM', 'INCENTIVE_APPROVE',
      'ACTIVITY_VIEW'
    ]
  },
  {
    _id: 'default_agent',
    name: 'agent',
    roleType: 'AGENT',
    isSystemRole: true,
    description: 'View and edit assigned leads, claim new leads, and submit transfer requests',
    permissions: [
      'LEAD_VIEW', 'LEAD_CREATE', 'LEAD_EDIT', 'LEAD_CLAIM',
      'LEAD_TRANSFER_REQUEST', 'INCENTIVE_VIEW_SELF', 'ACTIVITY_VIEW'
    ]
  }
];

export default function AgencyPage() {
  return (
    <Suspense fallback={<div className="app-shell flex items-center justify-center min-h-screen"><div className="spinner" /></div>}>
      <AgencyPageContent />
    </Suspense>
  );
}

function AgencyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('performance'); // 'performance' | 'workload' | 'members' | 'transfers' | 'forms' | 'roles' | 'incentives' | 'activity'

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam) {
      if (tabParam === 'roster' || tabParam === 'members') setActiveTab('members');
      else if (tabParam === 'overview' || tabParam === 'performance') setActiveTab('performance');
      else if (tabParam === 'workload') setActiveTab('workload');
      else if (tabParam === 'transfers') setActiveTab('transfers');
      else if (tabParam === 'activity' || tabParam === 'logs') setActiveTab('activity');
      else if (['performance', 'workload', 'members', 'transfers', 'forms', 'roles', 'incentives', 'activity'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, [searchParams]);

  // Dashboard Metrics & Logs State
  const [dashboardData, setDashboardData] = useState({
    role: 'AGENT',
    metrics: {
      totalLeads: 0,
      wonLeads: 0,
      lostLeads: 0,
      conversionRate: 0,
      incentiveGenerated: 0,
      incentivePending: 0,
      incentiveApproved: 0
    },
    auditLogs: []
  });

  // Team Data States
  const [agents, setAgents] = useState([]);
  const [roles, setRoles] = useState(DEFAULT_SYSTEM_ROLES);
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [teamWorkload, setTeamWorkload] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [transferNotifications, setTransferNotifications] = useState([]);
  const [incentivesList, setIncentivesList] = useState([]);
  const [globalActivity, setGlobalActivity] = useState([]);
  const [activePolicy, setActivePolicy] = useState({
    name: '40/60 Split Policy',
    calculationType: 'SPLIT',
    firstHandlerPercentage: 40,
    closerPercentage: 60
  });

  // Filters & Search
  const [performanceSearch, setPerformanceSearch] = useState('');
  const [workloadSearch, setWorkloadSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE' | 'AVAILABLE'
  const [sortKey, setSortKey] = useState('bookings'); // 'bookings' | 'revenue' | 'conversion' | 'leads'

  // Modals
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', roleType: 'AGENT', permissions: [] });
  
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentForm, setAgentForm] = useState({ roleId: '', companyRole: 'agent', managerId: '', employeeStatus: 'active' });

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    companyRole: 'agent',
    roleId: '',
    managerId: ''
  });

  // Force Transfer Modal State
  const [showForceTransferModal, setShowForceTransferModal] = useState(false);
  const [forceTransferForm, setForceTransferForm] = useState({
    leadId: '',
    targetUserId: '',
    reason: 'Manager Reallocation'
  });
  const [unassignedLeadsList, setUnassignedLeadsList] = useState([]);

  const [incentiveActionData, setIncentiveActionData] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setCurrentUser(u);
  }, [router]);

  const formatINR = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        dashRes,
        agentsRes,
        rolesRes,
        incentivesRes,
        activityRes,
        perfRes,
        workloadRes,
        membersRes,
        notifRes,
        leadsRes,
        policiesRes
      ] = await Promise.all([
        api.get('/agency/dashboard').catch(() => ({ data: null })),
        api.get('/company/agents').catch(() => ({ data: { agents: [] } })),
        api.get('/agency/roles').catch(() => ({ data: { roles: [] } })),
        api.get('/agency/incentives').catch(() => ({ data: { incentives: [] } })),
        api.get('/agency/activity').catch(() => ({ data: { activities: [] } })),
        api.get('/real-estate/team/performance').catch(() => ({ data: { data: [] } })),
        api.get('/real-estate/team/workload').catch(() => ({ data: { data: [] } })),
        api.get('/real-estate/team/members').catch(() => ({ data: { data: [] } })),
        api.get('/notifications').catch(() => ({ data: { notifications: [] } })),
        api.get('/leads?limit=100').catch(() => ({ data: { leads: [] } })),
        api.get('/agency/incentive-policies').catch(() => ({ data: { policies: [] } })),
      ]);

      if (dashRes.data) setDashboardData(dashRes.data);
      setAgents(agentsRes.data?.agents || []);
      
      const backendRoles = rolesRes.data?.roles || [];
      if (backendRoles.length > 0) {
        const hasManager = backendRoles.some(r => r.roleType === 'MANAGER');
        const hasAgent = backendRoles.some(r => r.roleType === 'AGENT');
        const combined = [...backendRoles];
        if (!hasManager) combined.unshift(DEFAULT_SYSTEM_ROLES[0]);
        if (!hasAgent) combined.push(DEFAULT_SYSTEM_ROLES[1]);
        setRoles(combined);
      } else {
        setRoles(DEFAULT_SYSTEM_ROLES);
      }

      setIncentivesList(incentivesRes.data?.incentives || []);
      setGlobalActivity(activityRes.data?.activities || []);
      setTeamPerformance(perfRes.data?.data || []);
      setTeamWorkload(workloadRes.data?.data || []);
      setTeamMembers(membersRes.data?.data || []);
      setUnassignedLeadsList(leadsRes.data?.leads || []);
      
      const policies = policiesRes.data?.policies || [];
      if (policies && policies.length > 0) {
        setActivePolicy(policies.find(p => p.isActive) || policies[0]);
      }

      const notifs = notifRes.data?.notifications || [];
      setTransferNotifications(notifs.filter(n => n.type === 'transfer_request' || n.transferRequestId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error loading team data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Lead Transfer Actions
  const handleAcceptTransfer = async (notif) => {
    const reqId = notif.transferRequestId?._id || notif.transferRequestId;
    if (!reqId) return toast.error('Transfer request ID missing');
    try {
      await api.post(`/agency/transfer-requests/${reqId}/accept`);
      toast.success('Lead transfer request accepted & ownership transferred! ✅');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept transfer');
    }
  };

  const handleRejectTransfer = async (notif) => {
    const reqId = notif.transferRequestId?._id || notif.transferRequestId;
    if (!reqId) return toast.error('Transfer request ID missing');
    try {
      await api.post(`/agency/transfer-requests/${reqId}/reject`);
      toast.success('Lead transfer request rejected');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject transfer');
    }
  };

  const handleForceTransferSubmit = async (e) => {
    e.preventDefault();
    if (!forceTransferForm.leadId || !forceTransferForm.targetUserId) {
      return toast.error('Please select Lead and Target Agent');
    }
    try {
      await api.post(`/agency/leads/${forceTransferForm.leadId}/force-transfer`, {
        targetUserId: forceTransferForm.targetUserId,
        reason: forceTransferForm.reason || 'Manager Direct Override'
      });
      toast.success('Lead force-transferred successfully! 🎯');
      setShowForceTransferModal(false);
      setForceTransferForm({ leadId: '', targetUserId: '', reason: 'Manager Reallocation' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Force transfer failed');
    }
  };

  // Roles Operations
  const handleSaveRole = async (e) => {
    e.preventDefault();
    const cleanRoleName = (roleForm.name || '').trim().toLowerCase();
    if (!cleanRoleName) return toast.error('Role name is required');
    if (roleForm.permissions.length === 0) return toast.error('Please assign at least one permission');

    try {
      const payload = {
        ...roleForm,
        name: cleanRoleName,
      };

      if (editingRole) {
        await api.patch(`/agency/roles/${editingRole._id}`, payload);
        toast.success('Custom role updated successfully');
      } else {
        await api.post('/agency/roles', payload);
        toast.success('Custom role created successfully');
      }
      setShowRoleModal(false);
      setEditingRole(null);
      setRoleForm({ name: '', roleType: 'AGENT', permissions: [] });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save role config');
    }
  };

  const handleDeleteRole = async (id) => {
    if (!confirm('Are you sure you want to delete this custom role? Assigned agents will revert to default permissions.')) return;
    try {
      await api.delete(`/agency/roles/${id}`);
      toast.success('Role deleted successfully');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

  // Agent Operations
  const handleEditAgent = (ag) => {
    setEditingAgent(ag);
    let resolvedRole = ag.companyRole || ag.role || 'agent';
    if (ag.role === 'manager' || ag.companyRole === 'manager') {
      resolvedRole = 'manager';
    }
    setAgentForm({
      roleId: ag.roleId?._id || ag.roleId || '',
      companyRole: resolvedRole,
      managerId: ag.managerId?._id || ag.managerId || '',
      employeeStatus: ag.employeeStatus || 'active'
    });
  };

  const handleSaveAgent = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/agency/agents/${editingAgent._id}`, {
        roleId: agentForm.roleId || null,
        companyRole: agentForm.companyRole || 'agent',
        role: agentForm.companyRole === 'manager' ? 'manager' : 'agent',
        managerId: agentForm.managerId || null,
        employeeStatus: agentForm.employeeStatus
      });
      toast.success(`Agent configuration updated for ${editingAgent.name}`);
      setEditingAgent(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update agent profile');
    }
  };

  const handleCreateMember = async (e) => {
    e.preventDefault();
    if (!newMemberForm.name.trim()) return toast.error('Name is required');
    if (!newMemberForm.password.trim()) return toast.error('Password is required');
    if (!newMemberForm.email && !newMemberForm.phone) {
      return toast.error('Email or Phone is required');
    }

    try {
      const isMgr = newMemberForm.companyRole === 'manager';
      let assignedRoleId = newMemberForm.roleId || null;
      if (!assignedRoleId && isMgr) {
        const mgrRole = roles.find(r => (r.roleType === 'MANAGER' || r.name?.toLowerCase() === 'manager') && r._id && !String(r._id).startsWith('default_'));
        if (mgrRole) assignedRoleId = mgrRole._id;
      }

      const res = await api.post('/company/agents', {
        name: newMemberForm.name,
        email: newMemberForm.email,
        phone: newMemberForm.phone,
        password: newMemberForm.password,
        role: isMgr ? 'manager' : 'agent',
        companyRole: newMemberForm.companyRole || 'agent',
        roleId: assignedRoleId,
        managerId: isMgr ? null : (newMemberForm.managerId || null),
      });

      const newAgentId = res.data?.agent?._id;

      if (newAgentId && (assignedRoleId || newMemberForm.managerId || newMemberForm.companyRole)) {
        await api.patch(`/agency/agents/${newAgentId}`, {
          roleId: assignedRoleId,
          companyRole: newMemberForm.companyRole || 'agent',
          role: isMgr ? 'manager' : 'agent',
          managerId: isMgr ? null : (newMemberForm.managerId || null)
        }).catch(() => {});
      }

      toast.success(res.data?.message || 'Team member created successfully! 🎉');
      setShowAddMemberModal(false);
      setNewMemberForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        companyRole: 'agent',
        roleId: '',
        managerId: ''
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create team member');
    }
  };

  const handleDeleteAgent = async (agent) => {
    if (!confirm(`Are you sure you want to remove "${agent.name}" from your organization team roster?`)) {
      return;
    }
    try {
      await api.delete(`/agency/agents/${agent._id}`);
      toast.success(`Team member ${agent.name} removed successfully ✅`);
      fetchData();
    } catch {
      try {
        await api.delete(`/company/agents/${agent._id}`);
        toast.success(`Team member ${agent.name} removed successfully ✅`);
        fetchData();
      } catch (fallbackErr) {
        toast.error(fallbackErr.response?.data?.message || 'Failed to remove team member');
      }
    }
  };

  // Incentive status updates (Approve / Reject)
  const handleIncentiveStatus = async () => {
    if (!incentiveActionData) return;
    try {
      await api.patch(`/agency/incentives/${incentiveActionData.id}`, {
        status: incentiveActionData.status,
        reason: incentiveActionData.reason
      });
      toast.success(`Incentive record marked as ${incentiveActionData.status}`);
      setIncentiveActionData(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update incentive status');
    }
  };

  const handleTogglePermission = (p) => {
    const current = [...roleForm.permissions];
    const idx = current.indexOf(p);
    if (idx > -1) {
      current.splice(idx, 1);
    } else {
      current.push(p);
    }
    setRoleForm({ ...roleForm, permissions: current });
  };

  if (loading && !currentUser) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const isUserOwner = isOwner(currentUser) || dashboardData.role === 'OWNER';
  const isUserManager = isManager(currentUser) || dashboardData.role === 'MANAGER';
  const isRE = isRealEstateTenant(currentUser);

  // Filtered & Sorted Performance Data
  const filteredPerformance = [...teamPerformance]
    .filter(a => {
      if (!performanceSearch) return true;
      const q = performanceSearch.toLowerCase();
      return a.name.toLowerCase().includes(q) || (a.email && a.email.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortKey === 'revenue') return (b.bookingValue || 0) - (a.bookingValue || 0);
      if (sortKey === 'leads') return (b.leadsAssigned || 0) - (a.leadsAssigned || 0);
      if (sortKey === 'conversion') return parseFloat(b.conversionRate || 0) - parseFloat(a.conversionRate || 0);
      return (b.bookings || 0) - (a.bookings || 0);
    });

  // Filtered Workload Data
  const filteredWorkload = teamWorkload.filter(a => {
    if (!workloadSearch) return true;
    const q = workloadSearch.toLowerCase();
    return a.name.toLowerCase().includes(q) || (a.email && a.email.toLowerCase().includes(q));
  });

  // Filtered Members Data
  const filteredMembers = (teamMembers.length > 0 ? teamMembers : agents).filter(m => {
    if (memberFilter === 'ACTIVE') return m.employeeStatus === 'active' || m.isActive !== false;
    if (memberFilter === 'INACTIVE') return m.employeeStatus === 'inactive' || m.isActive === false;
    if (memberFilter === 'AVAILABLE') return m.isAvailable !== false && m.isAvailableForRouting !== false;
    return true;
  });

  return (
    <div className="app-shell">
      <main className="main-content" style={{ flex: 1, padding: '24px 20px', paddingBottom: 80, overflowY: 'auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={26} color="var(--accent)" /> Real Estate Team & Agency Command Center
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Supervise sales agents, monitor team workloads, manage lead approvals & incentive distributions.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={fetchData} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {(isUserOwner || isUserManager) && (
              <button
                onClick={() => setShowForceTransferModal(true)}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, border: '1px solid var(--border)' }}
              >
                <ArrowRightLeft size={14} /> Force Transfer
              </button>
            )}
            {isUserOwner && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="btn btn-primary btn-sm"
                style={{ gap: 6 }}
              >
                <UserPlus size={14} /> Add Member
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 16, overflowX: 'auto' }}>
          {[
            { id: 'performance', label: '🏆 Agent Performance', show: true },
            { id: 'workload', label: '⚡ Workload & Capacity', show: true },
            { id: 'members', label: `👥 Team Members (${filteredMembers.length})`, show: true },
            { id: 'transfers', label: `🔄 Transfers (${transferNotifications.length})`, show: isUserOwner || isUserManager },
            { id: 'forms', label: '📋 Lead Forms & Schema', show: isUserOwner || isUserManager },
            { id: 'roles', label: '🛡️ Role Editor', show: isUserOwner },
            { id: 'incentives', label: '💰 Incentives & Payouts', show: isUserOwner || isUserManager },
            { id: 'activity', label: '📝 Team Activity Logs', show: isUserOwner || isUserManager },
          ].map(tab => {
            if (!tab.show) return null;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 12px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: active ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* 1. AGENT PERFORMANCE TAB                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'performance' && (
          <div>
            {/* Top Stat Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div className="card" style={{ padding: '16px 18px' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Team Leads</span>
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: 'var(--accent)' }}>
                  {teamPerformance.reduce((sum, a) => sum + (a.leadsAssigned || 0), 0)}
                </h3>
              </div>
              <div className="card" style={{ padding: '16px 18px' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Site Visits Completed</span>
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#0ea5e9' }}>
                  {teamPerformance.reduce((sum, a) => sum + (a.completedVisits || 0), 0)}
                </h3>
              </div>
              <div className="card" style={{ padding: '16px 18px' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Bookings Won</span>
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                  {teamPerformance.reduce((sum, a) => sum + (a.bookings || 0), 0)}
                </h3>
              </div>
              <div className="card" style={{ padding: '16px 18px' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Revenue Closed</span>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', color: '#10b981' }}>
                  {formatINR(teamPerformance.reduce((sum, a) => sum + (a.bookingValue || 0), 0))}
                </h3>
              </div>
            </div>

            {/* Performance Controls Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 360 }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search sales agent..."
                    value={performanceSearch}
                    onChange={e => setPerformanceSearch(e.target.value)}
                    className="input"
                    style={{ paddingLeft: 30, fontSize: 13, height: 36 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Sort by:</span>
                <select
                  value={sortKey}
                  onChange={e => setSortKey(e.target.value)}
                  className="input"
                  style={{ height: 36, fontSize: 12, width: 'auto', paddingRight: 24 }}
                >
                  <option value="bookings">🏆 Total Bookings</option>
                  <option value="revenue">💰 Booking Revenue</option>
                  <option value="conversion">🎯 Conversion Rate</option>
                  <option value="leads">📋 Leads Handled</option>
                </select>
              </div>
            </div>

            {/* Performance Leaderboard Table */}
            <div className="card" style={{ padding: 20 }}>
              {filteredPerformance.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Users size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No sales performance records found.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 8px' }}>Rank & Agent</th>
                        <th style={{ padding: '10px 8px' }}>Leads Assigned</th>
                        <th style={{ padding: '10px 8px' }}>Contacted</th>
                        <th style={{ padding: '10px 8px' }}>Site Visits</th>
                        <th style={{ padding: '10px 8px' }}>Opportunities</th>
                        <th style={{ padding: '10px 8px' }}>Bookings</th>
                        <th style={{ padding: '10px 8px' }}>Booking Value</th>
                        <th style={{ padding: '10px 8px' }}>Win Rate %</th>
                        <th style={{ padding: '10px 8px' }}>Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPerformance.map((agent, index) => (
                        <tr key={agent.id || index} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: index === 0 ? '#f59e0b' : (index === 1 ? '#94a3b8' : (index === 2 ? '#b45309' : 'rgba(99,102,241,0.1)')),
                                color: index < 3 ? '#fff' : 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 800
                              }}>
                                {index + 1}
                              </span>
                              <div>
                                <strong style={{ display: 'block', color: 'var(--text)' }}>{agent.name}</strong>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{agent.email || agent.phone}</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', fontWeight: 600 }}>{agent.leadsAssigned}</td>
                          <td style={{ padding: '12px 8px' }}>{agent.leadsContacted}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{ color: '#0ea5e9', fontWeight: 700 }}>{agent.completedVisits}</span> / {agent.siteVisits}
                          </td>
                          <td style={{ padding: '12px 8px' }}>{agent.opportunities || 0}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 800, color: '#10b981' }}>{agent.bookings}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--accent)' }}>{formatINR(agent.bookingValue)}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 700 }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: parseFloat(agent.conversionRate) > 10 ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.08)',
                              color: parseFloat(agent.conversionRate) > 10 ? '#10b981' : 'var(--text)'
                            }}>
                              {agent.conversionRate}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', fontWeight: 700, color: '#10b981' }}>
                            {formatINR(agent.commissionEarned)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. AGENT WORKLOAD & CAPACITY TAB                                         */}
        {/* ========================================================================= */}
        {activeTab === 'workload' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ position: 'relative', width: 300 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter workload by agent..."
                  value={workloadSearch}
                  onChange={e => setWorkloadSearch(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 30, fontSize: 13, height: 36 }}
                />
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 16
            }}>
              {filteredWorkload.map(agent => {
                const leadCap = agent.leadCap || 50;
                const activeLeads = agent.activeLeads || 0;
                const pct = Math.min(100, Math.round((activeLeads / leadCap) * 100));
                const isOverloaded = pct >= 90;

                return (
                  <div key={agent.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      {/* Top Row: Name & Availability */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <strong style={{ fontSize: 15, display: 'block' }}>{agent.name}</strong>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{agent.email || agent.phone}</span>
                        </div>
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 20,
                          background: agent.isAvailable ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          color: agent.isAvailable ? '#10b981' : '#ef4444',
                        }}>
                          ● {agent.isAvailable ? 'AVAILABLE FOR ROUTING' : 'PAUSED / BUSY'}
                        </span>
                      </div>

                      {/* Workload Progress Bar */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Active Capacity</span>
                          <strong style={{ color: isOverloaded ? '#ef4444' : 'var(--text)' }}>
                            {activeLeads} / {leadCap} ({pct}%)
                          </strong>
                        </div>
                        <div style={{ width: '100%', height: 7, borderRadius: 10, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: isOverloaded ? '#ef4444' : (pct > 70 ? '#f59e0b' : '#10b981'),
                            borderRadius: 10,
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>

                      {/* Metric Pills */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', marginBottom: 14 }}>
                        <div style={{ background: 'var(--surface)', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>🔥 HOT Leads</span>
                          <strong style={{ fontSize: 15, color: '#ef4444' }}>{agent.hotLeads || 0}</strong>
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>📅 Follow-ups</span>
                          <strong style={{ fontSize: 15, color: '#f59e0b' }}>{agent.pendingFollowUps || 0}</strong>
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>📍 Site Visits</span>
                          <strong style={{ fontSize: 15, color: '#0ea5e9' }}>{agent.upcomingVisits || 0}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <Link
                        href={`/leads?agent=${agent.id}&tab=team_leads`}
                        className="btn btn-ghost btn-sm"
                        style={{ flex: 1, fontSize: 12, justifyContent: 'center', gap: 4 }}
                      >
                        <FileText size={13} /> View Leads
                      </Link>
                      <button
                        onClick={() => {
                          setForceTransferForm(f => ({ ...f, targetUserId: agent.id }));
                          setShowForceTransferModal(true);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, fontSize: 12, justifyContent: 'center', gap: 4 }}
                      >
                        <ArrowRightLeft size={13} /> Assign Lead
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. TEAM MEMBERS ROSTER TAB                                               */}
        {/* ========================================================================= */}
        {activeTab === 'members' && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {['ALL', 'ACTIVE', 'INACTIVE', 'AVAILABLE'].map(f => (
                  <button
                    key={f}
                    onClick={() => setMemberFilter(f)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: 11.5,
                      fontWeight: 700,
                      border: '1px solid var(--border)',
                      background: memberFilter === f ? 'var(--accent)' : 'var(--surface)',
                      color: memberFilter === f ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {isUserOwner && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="btn btn-primary btn-sm"
                  style={{ gap: 4, borderRadius: 8 }}
                >
                  <UserPlus size={14} /> Add Team Member
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
                    <th style={{ padding: '10px 8px' }}>Member</th>
                    <th style={{ padding: '10px 8px' }}>Contact Info</th>
                    <th style={{ padding: '10px 8px' }}>Role</th>
                    <th style={{ padding: '10px 8px' }}>Manager</th>
                    <th style={{ padding: '10px 8px' }}>Routing & Status</th>
                    {isUserOwner && <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(ag => (
                    <tr key={ag._id || ag.id} style={{ borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>
                            {ag.name.slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ display: 'block' }}>{ag.name}</strong>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {ag.usercode || ag._id?.slice(-6)}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ display: 'block' }}>{ag.email}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ag.phone || '—'}</span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          background: (ag.companyRole === 'manager' || ag.role === 'manager')
                            ? 'rgba(16, 185, 129, 0.12)'
                            : (ag.companyRole === 'owner' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(79, 70, 229, 0.08)'),
                          color: (ag.companyRole === 'manager' || ag.role === 'manager')
                            ? '#10b981'
                            : (ag.companyRole === 'owner' ? '#f59e0b' : 'var(--accent)'),
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>
                          {ag.companyRole === 'owner'
                            ? 'OWNER'
                            : (ag.companyRole === 'manager' || ag.role === 'manager'
                              ? (ag.roleId?.name && ag.roleId?.name !== 'agent' ? `${ag.roleId.name}` : 'MANAGER')
                              : (ag.roleId?.name ? `${ag.roleId.name}` : (ag.companyRole?.toUpperCase() || 'AGENT')))}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {ag.managerId ? (
                          <span>{ag.managerId.name || ag.managerName || 'Assigned'}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>None (Direct)</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          color: ag.employeeStatus === 'active' ? 'var(--green)' : 'var(--text-muted)',
                          fontSize: 12,
                          fontWeight: 700
                        }}>
                          ● {String(ag.employeeStatus || 'active').toUpperCase()}
                        </span>
                      </td>
                      {isUserOwner && (
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <button
                              onClick={() => handleEditAgent(ag)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '6px 8px' }}
                              title="Edit Member Options"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteAgent(ag)}
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '6px 8px', color: '#ef4444' }}
                              title="Remove Team Member"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. LEAD TRANSFERS APPROVAL TAB                                           */}
        {/* ========================================================================= */}
        {activeTab === 'transfers' && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  🔄 Lead Transfer Approvals & Reallocation Queue
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Approve or reject agent-to-agent lead handover requests or initiate immediate manager force transfers.
                </p>
              </div>
              <button
                onClick={() => setShowForceTransferModal(true)}
                className="btn btn-primary btn-sm"
                style={{ gap: 6 }}
              >
                <ArrowRightLeft size={14} /> New Force Transfer
              </button>
            </div>

            {transferNotifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
                <strong style={{ fontSize: 15, display: 'block', color: 'var(--text)' }}>No Pending Transfer Requests</strong>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>All agent handover requests have been approved or resolved.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {transferNotifications.map(notif => (
                  <div
                    key={notif._id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 16,
                      background: 'var(--card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 14
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}>
                          TRANSFER REQUEST
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(notif.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <strong style={{ fontSize: 14, display: 'block' }}>{notif.title || 'Lead Transfer Request'}</strong>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                        {notif.message || notif.details}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => handleRejectTransfer(notif)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#ef4444', gap: 4 }}
                      >
                        <X size={14} /> Reject
                      </button>
                      <button
                        onClick={() => handleAcceptTransfer(notif)}
                        className="btn btn-primary btn-sm"
                        style={{ background: '#10b981', borderColor: '#10b981', gap: 4 }}
                      >
                        <Check size={14} /> Approve Transfer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. FORMS TAB */}
        {activeTab === 'forms' && <FormsModule />}

        {/* 6. ROLE EDITOR TAB */}
        {activeTab === 'roles' && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Agency RBAC Roles & Permissions ({roles.length})</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Default roles (Agent, Manager) are permanent. Customize permissions or create new custom roles anytime.
                </p>
              </div>
              <button onClick={() => { setEditingRole(null); setRoleForm({ name: '', roleType: 'CUSTOM', permissions: [] }); setShowRoleModal(true); }} className="btn btn-primary btn-sm" style={{ gap: 4 }}>
                <Plus size={14} /> Create Custom Role
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
              {roles.map(r => (
                <div key={r._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 14, textTransform: 'capitalize' }}>{r.name}</strong>
                      {r.isSystemRole && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.12)', color: 'var(--green)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>{r.roleType}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                    {r.description || `${r.permissions?.length || 0} permissions configured`}
                  </p>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
                      {r.permissions?.length || 0} Permissions
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          setEditingRole(r);
                          setRoleForm({ name: (r.name || '').toLowerCase(), roleType: r.roleType || 'CUSTOM', permissions: r.permissions || [] });
                          setShowRoleModal(true);
                        }}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px 10px', fontSize: 12, gap: 4, border: '1px solid var(--border)' }}
                        title="Edit Role & Permissions"
                      >
                        <Edit2 size={12} /> Edit Permissions
                      </button>
                      {!r.isSystemRole && r.roleType !== 'OWNER' && (
                        <button
                          onClick={() => handleDeleteRole(r._id)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px 8px', color: '#ef4444' }}
                          title="Delete Custom Role"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. INCENTIVES TAB */}
        {activeTab === 'incentives' && (
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>💰 Deal Incentives & Commission Approvals</h3>
            {incentivesList.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No pending milestone incentive payouts.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px' }}>Agent</th>
                      <th style={{ padding: '8px' }}>Lead / Deal</th>
                      <th style={{ padding: '8px' }}>Milestone</th>
                      <th style={{ padding: '8px' }}>Incentive Amount</th>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incentivesList.map(inc => (
                      <tr key={inc._id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>{inc.userId?.name || 'Sales Rep'}</td>
                        <td style={{ padding: '10px 8px' }}>{inc.leadId?.name || 'Deal'}</td>
                        <td style={{ padding: '10px 8px' }}>{inc.milestone || 'Closed Won'}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 800, color: '#10b981' }}>₹{inc.amount}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: inc.status === 'APPROVED' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: inc.status === 'APPROVED' ? '#10b981' : '#f59e0b' }}>
                            {inc.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                          {inc.status === 'PENDING' && (
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button onClick={() => setIncentiveActionData({ id: inc._id, status: 'APPROVED', reason: '' })} className="btn btn-ghost btn-sm" style={{ color: '#10b981' }}><Check size={14} /> Approve</button>
                              <button onClick={() => setIncentiveActionData({ id: inc._id, status: 'REJECTED', reason: '' })} className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }}><X size={14} /> Reject</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 8. ACTIVITY LOGS TAB */}
        {activeTab === 'activity' && (
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>📝 Live Team Audit Logs & Activity Feed</h3>
            {globalActivity.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No recent activity records.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {globalActivity.map(act => (
                  <div key={act._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div>
                      <strong style={{ fontSize: 13, display: 'block' }}>{act.action?.replace(/_/g, ' ') || 'Action'}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Actor: {act.actorId?.name || 'User'} | {act.details}</span>
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{new Date(act.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Force Transfer Modal */}
        {showForceTransferModal && (
          <div className="modal-overlay" onClick={() => setShowForceTransferModal(false)} style={{ zIndex: 9999 }}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowRightLeft size={18} color="var(--accent)" /> Immediate Force Transfer Override
                </h3>
                <button onClick={() => setShowForceTransferModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={handleForceTransferSubmit}>
                <div style={{ marginBottom: 12 }}>
                  <label className="label" style={{ fontWeight: 600 }}>Select Lead</label>
                  <select
                    value={forceTransferForm.leadId}
                    onChange={e => setForceTransferForm(f => ({ ...f, leadId: e.target.value }))}
                    className="input"
                    required
                  >
                    <option value="">-- Choose Lead --</option>
                    {unassignedLeadsList.map(l => (
                      <option key={l._id} value={l._id}>
                        {l.name} ({l.phone || 'No phone'}) - Current: {l.assignedTo?.name || 'Unassigned'}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label className="label" style={{ fontWeight: 600 }}>Target Sales Agent</label>
                  <select
                    value={forceTransferForm.targetUserId}
                    onChange={e => setForceTransferForm(f => ({ ...f, targetUserId: e.target.value }))}
                    className="input"
                    required
                  >
                    <option value="">-- Choose Target Agent --</option>
                    {agents.map(a => (
                      <option key={a._id} value={a._id}>
                        {a.name} ({a.companyRole || a.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="label" style={{ fontWeight: 600 }}>Reallocation Reason</label>
                  <input
                    type="text"
                    value={forceTransferForm.reason}
                    onChange={e => setForceTransferForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="e.g. Workload balancing, Language match"
                    className="input"
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowForceTransferModal(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Execute Transfer</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)} style={{ zIndex: 9999 }}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>👤 Onboard New Team Member</h3>
                <button onClick={() => setShowAddMemberModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={handleCreateMember}>
                <div style={{ marginBottom: 10 }}>
                  <label className="label">Full Name</label>
                  <input className="input" required value={newMemberForm.name} onChange={e => setNewMemberForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Rajesh Kumar" />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="label">Email Address</label>
                  <input className="input" type="email" value={newMemberForm.email} onChange={e => setNewMemberForm(f => ({ ...f, email: e.target.value }))} placeholder="rajesh@company.com" />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="label">Phone Number</label>
                  <input className="input" value={newMemberForm.phone} onChange={e => setNewMemberForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="label">Initial Password</label>
                  <input className="input" type="password" required value={newMemberForm.password} onChange={e => setNewMemberForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="label">Company Role</label>
                  <select
                    className="input"
                    value={newMemberForm.companyRole}
                    onChange={e => {
                      const selectedRole = e.target.value;
                      setNewMemberForm(f => ({
                        ...f,
                        companyRole: selectedRole,
                        managerId: selectedRole === 'manager' ? '' : f.managerId
                      }));
                    }}
                  >
                    <option value="agent">Agent / Sales Rep</option>
                    <option value="manager">Manager / Supervisor</option>
                    <option value="telecaller">Telecaller</option>
                  </select>
                </div>

                {roles.filter(r => r._id && !String(r._id).startsWith('default_')).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <label className="label">Custom RBAC Role (Optional)</label>
                    <select className="input" value={newMemberForm.roleId} onChange={e => setNewMemberForm(f => ({ ...f, roleId: e.target.value }))}>
                      <option value="">Default Permissions</option>
                      {roles.filter(r => r._id && !String(r._id).startsWith('default_')).map(r => (
                        <option key={r._id} value={r._id}>{r.name} ({r.roleType})</option>
                      ))}
                    </select>
                  </div>
                )}

                {newMemberForm.companyRole !== 'manager' && (
                  <div style={{ marginBottom: 16 }}>
                    <label className="label">Reporting Manager</label>
                    <select className="input" value={newMemberForm.managerId} onChange={e => setNewMemberForm(f => ({ ...f, managerId: e.target.value }))}>
                      <option value="">Direct to Company Owner</option>
                      {agents.filter(a => a.companyRole === 'manager' || a.role === 'manager').map(m => (
                        <option key={m._id} value={m._id}>{m.name} (Manager)</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowAddMemberModal(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Create Account</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Agent Modal */}
        {editingAgent && (
          <div className="modal-overlay" onClick={() => setEditingAgent(null)} style={{ zIndex: 9999 }}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Edit {editingAgent.name}</h3>
                <button onClick={() => setEditingAgent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveAgent}>
                <div style={{ marginBottom: 12 }}>
                  <label className="label">Role Type</label>
                  <select className="input" value={agentForm.companyRole} onChange={e => setAgentForm(f => ({ ...f, companyRole: e.target.value }))}>
                    <option value="agent">Agent</option>
                    <option value="manager">Manager</option>
                    <option value="telecaller">Telecaller</option>
                    <option value="sales_rep">Sales Rep</option>
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label className="label">Custom RBAC Role</label>
                  <select className="input" value={agentForm.roleId} onChange={e => setAgentForm(f => ({ ...f, roleId: e.target.value }))}>
                    <option value="">Default Permissions</option>
                    {roles.map(r => (
                      <option key={r._id} value={r._id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label className="label">Reporting Manager</label>
                  <select className="input" value={agentForm.managerId} onChange={e => setAgentForm(f => ({ ...f, managerId: e.target.value }))}>
                    <option value="">None (Reports to Owner)</option>
                    {agents.filter(a => a._id !== editingAgent._id && (a.companyRole === 'manager' || a.role === 'manager')).map(m => (
                      <option key={m._id} value={m._id}>{m.name} (Manager)</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="label">Employee Status</label>
                  <select className="input" value={agentForm.employeeStatus} onChange={e => setAgentForm(f => ({ ...f, employeeStatus: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setEditingAgent(null)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Custom Role Modal */}
        {showRoleModal && (
          <div className="modal-overlay" onClick={() => setShowRoleModal(false)} style={{ zIndex: 9999 }}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editingRole ? 'Edit Role' : 'Create Custom Role'}</h3>
                <button onClick={() => setShowRoleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveRole}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="label">Role Name</label>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Always Lowercase</span>
                  </div>
                  <input
                    className="input"
                    required
                    value={roleForm.name}
                    onChange={e => setRoleForm(f => ({ ...f, name: e.target.value.toLowerCase() }))}
                    placeholder="e.g. senior_closer or closer"
                    style={{ textTransform: 'lowercase' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Role names are automatically restricted and saved in lowercase.
                  </span>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="label" style={{ marginBottom: 8, display: 'block' }}>Assigned Permissions</label>
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                    {PERMISSION_OPTIONS.map(p => {
                      const checked = roleForm.permissions.includes(p.value);
                      return (
                        <label key={p.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={checked} onChange={() => handleTogglePermission(p.value)} />
                          <span>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowRoleModal(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Save Role</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      <BottomNav active="agency" />
    </div>
  );
}
