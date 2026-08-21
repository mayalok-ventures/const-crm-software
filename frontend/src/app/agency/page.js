'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import {
  Users, Shield, Award, FileText, CheckCircle2, XCircle, Plus, Trash2,
  Edit2, Check, X, DollarSign, AlertTriangle, TrendingUp, HelpCircle, UserPlus,
  ShieldCheck, RefreshCw, BarChart2, Settings, ArrowRight, UserCheck, Clock
} from 'lucide-react';

const PERMISSION_OPTIONS = [
  { value: 'LEAD_VIEW', label: 'LEAD_VIEW', desc: 'Read-only access to company leads pipeline.' },
  { value: 'LEAD_EDIT', label: 'LEAD_EDIT', desc: 'Allows updating details and editing lead profile fields.' },
  { value: 'LEAD_CLAIM', label: 'LEAD_CLAIM', desc: 'Self-claim new and unclaimed leads.' },
  { value: 'LEAD_TRANSFER_REQUEST', label: 'LEAD_TRANSFER_REQUEST', desc: 'Initiate lead transfer request to teammates.' },
  { value: 'LEAD_TRANSFER_APPROVE', label: 'LEAD_TRANSFER_APPROVE', desc: 'Approve or reject pending lead transfers.' },
  { value: 'LEAD_FORCE_TRANSFER', label: 'LEAD_FORCE_TRANSFER', desc: 'Force immediate lead transfer override without approvals.' },
  { value: 'ROLE_VIEW', label: 'ROLE_VIEW', desc: 'View custom company roles structure.' },
  { value: 'ROLE_CREATE', label: 'ROLE_CREATE', desc: 'Create and configure custom agent/manager roles.' },
  { value: 'INCENTIVE_VIEW_SELF', label: 'INCENTIVE_VIEW_SELF', desc: 'Allows sales reps to view their own incentive earnings.' },
  { value: 'INCENTIVE_MANAGE', label: 'INCENTIVE_MANAGE', desc: 'Approve/reject agent incentives and modify split policy configs.' },
  { value: 'ACTIVITY_VIEW', label: 'ACTIVITY_VIEW', desc: 'View global audit activity feed of company actions.' }
];

export default function AgencyPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'roster' | 'roles' | 'incentives' | 'logs'

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

  // Roster, Roles & Policies State
  const [agents, setAgents] = useState([]);
  const [roles, setRoles] = useState([]);
  const [incentivesList, setIncentivesList] = useState([]);
  const [globalActivity, setGlobalActivity] = useState([]);
  const [activePolicy, setActivePolicy] = useState({
    name: '40/60 Split Policy',
    calculationType: 'SPLIT',
    firstHandlerPercentage: 40,
    closerPercentage: 60
  });

  // Modal / Editing State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', roleType: 'AGENT', permissions: [] });
  
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentForm, setAgentForm] = useState({ roleId: '', managerId: '', employeeStatus: 'active' });

  const [incentiveActionData, setIncentiveActionData] = useState(null); // { id, status, reason: '' }

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setCurrentUser(u);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch dashboard overview
      const resDash = await api.get('/agency/dashboard');
      setDashboardData(resDash.data);

      // 2. Fetch company roster
      const resAgents = await api.get('/company/agents');
      setAgents(resAgents.data?.agents || []);

      // 3. Fetch custom roles
      const resRoles = await api.get('/agency/roles');
      setRoles(resRoles.data?.roles || []);

      // 4. Fetch incentives list
      const resIncentives = await api.get('/agency/incentives');
      setIncentivesList(resIncentives.data?.incentives || []);

      // 5. Fetch Global Activity Feed
      const resActivity = await api.get('/agency/activity');
      setGlobalActivity(resActivity.data?.activities || []);

    } catch (err) {
      toast.error(err.response?.data?.message || 'Error loading agency dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Roles Operations
  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) return toast.error('Role name is required');
    if (roleForm.permissions.length === 0) return toast.error('Please assign at least one permission');

    try {
      if (editingRole) {
        await api.patch(`/agency/roles/${editingRole._id}`, roleForm);
        toast.success('Custom role updated successfully');
      } else {
        await api.post('/agency/roles', roleForm);
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
    setAgentForm({
      roleId: ag.roleId?._id || ag.roleId || '',
      managerId: ag.managerId?._id || ag.managerId || '',
      employeeStatus: ag.employeeStatus || 'active'
    });
  };

  const handleSaveAgent = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/agency/agents/${editingAgent._id}`, agentForm);
      toast.success(`Agent configuration updated for ${editingAgent.name}`);
      setEditingAgent(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update agent profile');
    }
  };

  // Incentive Policy updates
  const handleSavePolicy = async (e) => {
    e.preventDefault();
    try {
      await api.post('/agency/incentive-policies', activePolicy);
      toast.success('Active incentive policy updated');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update policy');
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

  // Permission selection logic
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

  const isOwner = dashboardData.role === 'OWNER';
  const isManager = dashboardData.role === 'MANAGER';

  return (
    <div className="app-shell">
      <main className="main-content" style={{ flex: 1, padding: '24px 20px', paddingBottom: 80, overflowY: 'auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.025em' }}>
              🛡️ Agency Control Center
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Manage customized roles, lead claim flows, and incentive calculations under your organization tenant.
            </p>
          </div>
          <button onClick={fetchData} className="btn btn-secondary btn-sm" style={{ gap: 6, borderRadius: 8 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Dynamic Warning for non-owners */}
        {!isOwner && !isManager && (
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #ef4444', background: 'rgba(239, 68, 68, 0.08)', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <AlertTriangle color="#ef4444" size={20} />
              <div>
                <strong style={{ display: 'block', fontSize: 13 }}>Access Restricted</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  You are viewing this dashboard as an agent. Administrative tabs like custom roles and settings are locked.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 16, overflowX: 'auto' }}>
          {[
            { id: 'overview', label: '📊 Metrics Overview', show: true },
            { id: 'roster', label: '👥 Team Roster', show: true },
            { id: 'roles', label: '🛡️ Role Editor', show: isOwner },
            { id: 'incentives', label: '💰 Incentive Policies', show: isOwner || isManager },
            { id: 'logs', label: '📝 Audit Feed', show: isOwner }
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

        {/* TAB CONTENTS */}

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div>
            {/* Numeric KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
              {[
                { title: 'Total Leads Handled', val: dashboardData.metrics.totalLeads, color: 'var(--accent)', icon: FileText },
                { title: 'Closed / Won Deals', val: dashboardData.metrics.wonLeads, color: 'var(--green)', icon: UserCheck },
                { title: 'Conversion Success Rate', val: `${Number(dashboardData.metrics.conversionRate).toFixed(1)}%`, color: 'var(--accent)', icon: TrendingUp },
                { title: 'Incentives Generated', val: `₹${dashboardData.metrics.incentiveGenerated}`, color: 'var(--green)', icon: DollarSign },
                { title: 'Pending Approval', val: `₹${dashboardData.metrics.incentivePending}`, color: '#f59e0b', icon: Clock },
                { title: 'Approved Earnings', val: `₹${dashboardData.metrics.incentiveApproved}`, color: 'var(--green)', icon: ShieldCheck }
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {card.title}
                      </span>
                      <strong style={{ fontSize: 22, fontWeight: 800, color: card.color, display: 'block', marginTop: 4 }}>
                        {card.val}
                      </strong>
                    </div>
                    <div style={{ background: 'var(--surface)', padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
                      <Icon size={20} color={card.color} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Audit Logs list in overview */}
            {isOwner && (
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>
                  📝 Recent Administrative Audit Logs
                </h3>
                {dashboardData.auditLogs.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>No audit events recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dashboardData.auditLogs.map(log => (
                      <div key={log._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <strong style={{ fontSize: 13, display: 'block' }}>{log.action.replace(/_/g, ' ')}</strong>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Actor: {log.actorId?.name || 'System Owner'} | Details: {log.reason}
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. TEAM ROSTER TAB */}
        {activeTab === 'roster' && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                👥 Active Organization Team Roster ({agents.length})
              </h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
                    <th style={{ padding: '10px 8px' }}>Name</th>
                    <th style={{ padding: '10px 8px' }}>Email / Phone</th>
                    <th style={{ padding: '10px 8px' }}>Custom Role</th>
                    <th style={{ padding: '10px 8px' }}>Reporting Manager</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                    {isOwner && <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {agents.map(ag => (
                    <tr key={ag._id} style={{ borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>
                            {ag.name.slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ display: 'block' }}>{ag.name}</strong>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {ag.usercode}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ display: 'block' }}>{ag.email}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ag.phone}</span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          background: 'rgba(79, 70, 229, 0.08)',
                          color: 'var(--accent)',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600
                        }}>
                          {ag.roleId?.name || (ag.companyRole === 'owner' ? 'OWNER (Default)' : 'AGENT (Default)')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {ag.managerId ? (
                          <span>{ag.managerId.name || agents.find(a => a._id === ag.managerId)?.name || 'Assigned'}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>None (Direct Report)</span>
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
                      {isOwner && (
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleEditAgent(ag)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: 6 }}
                            title="Edit Roster Options"
                          >
                            <Edit2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Agent Editor Overlay */}
            {editingAgent && (
              <div className="modal-overlay" onClick={() => setEditingAgent(null)}>
                <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
                    ✏️ Configure Agent: {editingAgent.name}
                  </h3>
                  <form onSubmit={handleSaveAgent} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Custom Tenant Role</label>
                      <select
                        value={agentForm.roleId}
                        onChange={e => setAgentForm({ ...agentForm, roleId: e.target.value })}
                        className="form-control btn-full"
                        style={{ width: '100%' }}
                      >
                        <option value="">Default permissions (Default Agent)</option>
                        {roles.map(r => (
                          <option key={r._id} value={r._id}>{r.name} ({r.roleType})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Reporting Manager</label>
                      <select
                        value={agentForm.managerId}
                        onChange={e => setAgentForm({ ...agentForm, managerId: e.target.value })}
                        className="form-control btn-full"
                        style={{ width: '100%' }}
                      >
                        <option value="">None (Reports to Owner)</option>
                        {agents.filter(a => a._id !== editingAgent._id && a.companyRole !== 'agent').map(a => (
                          <option key={a._id} value={a._id}>{a.name} ({a.roleId?.name || 'Manager'})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Employment Status</label>
                      <select
                        value={agentForm.employeeStatus}
                        onChange={e => setAgentForm({ ...agentForm, employeeStatus: e.target.value })}
                        className="form-control btn-full"
                        style={{ width: '100%' }}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                        <option value="terminated">Terminated</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save Configuration</button>
                      <button type="button" onClick={() => setEditingAgent(null)} className="btn btn-ghost">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. ROLE EDITOR TAB */}
        {activeTab === 'roles' && (
          <div>
            {/* Custom Roles List */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                🛡️ Custom Tenant Roles Layout
              </h3>
              <button
                onClick={() => {
                  setEditingRole(null);
                  setRoleForm({ name: '', roleType: 'AGENT', permissions: [] });
                  setShowRoleModal(true);
                }}
                className="btn btn-primary btn-sm"
                style={{ gap: 4, borderRadius: 8 }}
              >
                <Plus size={14} /> Create Custom Role
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
              {roles.map(r => (
                <div key={r._id} className="card" style={{ padding: 18, borderLeft: '3px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <strong style={{ fontSize: 15, display: 'block' }}>{r.name}</strong>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type: {r.roleType}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => {
                          setEditingRole(r);
                          setRoleForm({
                            name: r.name,
                            roleType: r.roleType,
                            permissions: r.permissions
                          });
                          setShowRoleModal(true);
                        }}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: 4 }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteRole(r._id)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: 4, color: '#ef4444' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 12px', minHeight: 40 }}>
                    {r.permissions.join(', ').slice(0, 80)}
                    {r.permissions.join(', ').length > 80 ? '...' : ''}
                  </div>

                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                    Total Permissions: {r.permissions.length}
                  </span>
                </div>
              ))}
            </div>

            {/* Custom Role Creation Modal */}
            {showRoleModal && (
              <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
                <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
                    {editingRole ? '✏️ Modify Custom Role' : '🛡️ Create Custom Tenant Role'}
                  </h3>

                  <form onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Role Display Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Lead Coordinator, Senior Manager"
                        value={roleForm.name}
                        onChange={e => setRoleForm({ ...roleForm, name: e.target.value })}
                        className="form-control"
                        style={{ width: '100%' }}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Base Role Type</label>
                      <select
                        value={roleForm.roleType}
                        onChange={e => setRoleForm({ ...roleForm, roleType: e.target.value })}
                        className="form-control btn-full"
                        style={{ width: '100%' }}
                      >
                        <option value="AGENT">AGENT</option>
                        <option value="MANAGER">MANAGER</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                        Select Enabled Permissions (Permission Ceiling Enforced)
                      </label>
                      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {PERMISSION_OPTIONS.map(opt => {
                          const checked = roleForm.permissions.includes(opt.value);
                          return (
                            <label
                              key={opt.value}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 8,
                                cursor: 'pointer',
                                fontSize: 12,
                                padding: 6,
                                background: checked ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                                borderRadius: 6
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleTogglePermission(opt.value)}
                                style={{ marginTop: 2 }}
                              />
                              <div>
                                <span style={{ fontWeight: 600, display: 'block' }}>{opt.label}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{opt.desc}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                        {editingRole ? 'Save Changes' : 'Create Role'}
                      </button>
                      <button type="button" onClick={() => setShowRoleModal(false)} className="btn btn-ghost">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. INCENTIVES TAB */}
        {activeTab === 'incentives' && (
          <div>
            {/* Split Policy Configuration */}
            {isOwner && (
              <div className="card" style={{ padding: 22, marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>
                  🛠️ Configure Global Incentive Split Policies
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                  Set split percentages for leads that pass through multiple agents before conversion.
                </p>

                <form onSubmit={handleSavePolicy} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 160 }}>
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Split Mode</span>
                    <select
                      value={activePolicy.calculationType}
                      onChange={e => setActivePolicy({ ...activePolicy, calculationType: e.target.value })}
                      className="form-control"
                      style={{ width: '100%' }}
                    >
                      <option value="SPLIT">SPLIT (First Handler + Closer)</option>
                      <option value="FINAL_OWNER">FINAL OWNER ONLY</option>
                      <option value="FIRST_HANDLER">FIRST HANDLER ONLY</option>
                    </select>
                  </div>

                  {activePolicy.calculationType === 'SPLIT' && (
                    <>
                      <div>
                        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>First Handler %</span>
                        <input
                          type="number"
                          max={100}
                          min={0}
                          value={activePolicy.firstHandlerPercentage}
                          onChange={e => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value)));
                            setActivePolicy({
                              ...activePolicy,
                              firstHandlerPercentage: val,
                              closerPercentage: 100 - val
                            });
                          }}
                          className="form-control"
                          style={{ width: 80 }}
                        />
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Closer / Closer %</span>
                        <input
                          type="number"
                          max={100}
                          min={0}
                          value={activePolicy.closerPercentage}
                          onChange={e => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value)));
                            setActivePolicy({
                              ...activePolicy,
                              closerPercentage: val,
                              firstHandlerPercentage: 100 - val
                            });
                          }}
                          className="form-control"
                          style={{ width: 80 }}
                        />
                      </div>
                    </>
                  )}

                  <button type="submit" className="btn btn-primary" style={{ height: 38, marginTop: 18 }}>
                    Save Policy Configuration
                  </button>
                </form>
              </div>
            )}

            {/* Incentives Ledger List */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>
                💰 Commission Ledger & Payout Approvals
              </h3>

              {incentivesList.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>No incentive records generated yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
                        <th style={{ padding: '10px 8px' }}>Lead Name</th>
                        <th style={{ padding: '10px 8px' }}>Agent Beneficiary</th>
                        <th style={{ padding: '10px 8px' }}>Deal Size</th>
                        <th style={{ padding: '10px 8px' }}>Commission Rate</th>
                        <th style={{ padding: '10px 8px' }}>Earned Amount</th>
                        <th style={{ padding: '10px 8px' }}>Status</th>
                        {isOwner && <th style={{ padding: '10px 8px', textAlign: 'right' }}>Approvals</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {incentivesList.map(inc => (
                        <tr key={inc._id} style={{ borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                          <td style={{ padding: '12px 8px' }}>
                            <strong>{inc.leadId?.name || 'N/A'}</strong>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span>{inc.agentId?.name || 'Deleted User'}</span>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span>₹{inc.totalSales}</span>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span>{Number(inc.incentivePct).toFixed(1)}%</span>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <strong style={{ color: 'var(--green)' }}>₹{inc.incentiveAmount}</strong>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{
                              background: inc.status === 'PENDING' ? 'rgba(245,158,11,0.08)' : (inc.status === 'APPROVED' || inc.status === 'PAID' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'),
                              color: inc.status === 'PENDING' ? '#f59e0b' : (inc.status === 'APPROVED' || inc.status === 'PAID' ? 'var(--green)' : '#ef4444'),
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700
                            }}>
                              {inc.status}
                            </span>
                          </td>
                          {isOwner && (
                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                              {inc.status === 'PENDING' && (
                                <div style={{ display: 'inline-flex', gap: 6 }}>
                                  <button
                                    onClick={() => setIncentiveActionData({ id: inc._id, status: 'APPROVED', reason: '' })}
                                    className="btn btn-ghost btn-sm"
                                    style={{ padding: 4, color: 'var(--green)' }}
                                    title="Approve Payout"
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => setIncentiveActionData({ id: inc._id, status: 'REJECTED', reason: '' })}
                                    className="btn btn-ghost btn-sm"
                                    style={{ padding: 4, color: '#ef4444' }}
                                    title="Reject Payout"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Incentive Remarks Modal */}
            {incentiveActionData && (
              <div className="modal-overlay" onClick={() => setIncentiveActionData(null)}>
                <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>
                    {incentiveActionData.status === 'APPROVED' ? '✅ Confirm Incentive Approval' : '❌ Confirm Incentive Rejection'}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
                    Please add an explanatory remark to save in the system audit logs.
                  </p>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Audit Remark / Reason</label>
                    <textarea
                      placeholder="e.g. Split calculated correctly based on first handler and closing agent."
                      value={incentiveActionData.reason}
                      onChange={e => setIncentiveActionData({ ...incentiveActionData, reason: e.target.value })}
                      className="form-control"
                      style={{ width: '100%', height: 70, resize: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button onClick={handleIncentiveStatus} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                      Submit Decision
                    </button>
                    <button onClick={() => setIncentiveActionData(null)} className="btn btn-ghost">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. AUDIT FEED TAB */}
        {activeTab === 'logs' && (
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>
              📝 System Actions & Multi-Tenant Audit Logs
            </h3>

            {globalActivity.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>No logs recorded under tenant feed.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {globalActivity.map(act => (
                  <div key={act._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <strong style={{ fontSize: 13, display: 'block', textTransform: 'capitalize' }}>
                        {String(act.action || act.eventType).replace(/_/g, ' ')}
                      </strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Details: {act.details || act.description} | Actor: {act.performedBy?.name || 'System Owner'}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {new Date(act.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
      <BottomNav active="agency" />
    </div>
  );
}
