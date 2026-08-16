'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser, clearAuth, waLink } from '@/lib/auth';
import {
  Shield, Crown, Users, UserCheck, UserX, Building2, Briefcase,
  Search, Filter, Plus, Trash2, Send, MessageSquare, AlertTriangle,
  CheckCircle2, RefreshCw, LogOut, ArrowRight, ExternalLink,
  ShieldCheck, ShieldAlert, DollarSign, Zap, Bell, Key, Sparkles,
  Phone, Mail, Calendar, Eye, Target, Layers
} from 'lucide-react';
import AddSaaSLeadModal, {
  SUPERADMIN_SAAS_STAGES,
  SAAS_PLAN_OPTIONS,
  SAAS_SOURCE_OPTIONS
} from '@/components/AddSaaSLeadModal';

const soloPlans = [
  { id: 'basic_solo', label: 'Basic Solo (₹399/m • 2k Leads)' },
  { id: 'smart_solo', label: 'Smart Solo (₹799/m • 10k Leads • Popular)' },
  { id: 'power_solo', label: 'Power Solo (₹1299/m • 25k Leads)' },
];

const orgPlans = [
  { id: 'team_starter', label: 'Team Starter (₹1499/m • 3 Seats • 15k Leads)' },
  { id: 'business', label: 'Business Agency (₹2499/m • 10 Seats • 50k Leads)' },
  { id: 'enterprise', label: 'Enterprise Command (₹4999/m • 25 Seats • Unlimited)' },
];

const PLAN_OPTIONS = [
  'free',
  'basic_solo',
  'smart_solo',
  'power_solo',
  'team_starter',
  'business',
  'enterprise',
  'custom_enterprise',
];
const PLAN_COLORS = {
  free: '#94a3b8',
  basic_solo: '#3b82f6',
  smart_solo: '#f59e0b',
  power_solo: '#8b5cf6',
  team_starter: '#06b6d4',
  business: '#6366f1',
  enterprise: '#10b981',
  custom_enterprise: '#ec4899',
  starter: '#6366f1',
  growth: '#f59e0b',
  pro: '#22c55e',
};

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics', 'users', 'leads', 'coupons', 'alerts', 'abuse'
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Global Metrics
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Users State
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);

  // SaaS Leads CRM State
  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState('all');
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);

  // Modals
  const [planModalUser, setPlanModalUser] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('smart_solo');
  const [selectedPlanCycle, setSelectedPlanCycle] = useState('monthly');
  const [planDays, setPlanDays] = useState(30);

  const [suspendModalUser, setSuspendModalUser] = useState(null);
  const [suspendLevel, setSuspendLevel] = useState(1);
  const [suspendReason, setSuspendReason] = useState('');

  // Coupons
  const [coupons, setCoupons] = useState([]);
  const [newCoupon, setNewCoupon] = useState({ code: '', planGranted: 'pro', durationDays: 30, maxUses: 50, discountPercent: 100 });
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  // Alerts
  const [alertForm, setAlertForm] = useState({ userId: 'all', title: '', message: '', type: 'system_alert' });
  const [sendingAlert, setSendingAlert] = useState(false);

  // Abuse Logs
  const [abuseLogs, setAbuseLogs] = useState([]);
  const [loadingAbuse, setLoadingAbuse] = useState(false);

  const abuseUsers = users?.filter(u => (u.abuseScore && u.abuseScore > 0) || (u.loginAttempts && u.loginAttempts > 3) || u.suspension?.isSuspended) || [];

  // Verify SuperAdmin
  useEffect(() => {
    const user = getUser();
    if (!user || (!user.isAdmin && user.role !== 'superadmin')) {
      toast.error('Super Admin access restricted');
      router.replace('/login');
      return;
    }
    setCurrentUser(user);
    setLoadingInitial(false);
    fetchMetrics();
  }, [router]);

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const { data } = await api.get('/admin/metrics');
      setMetrics(data);
    } catch {
      toast.error('Failed to load global metrics');
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({
        page: userPage,
        limit: 50,
        ...(userSearch && { search: userSearch }),
        ...(userPlanFilter && { plan: userPlanFilter }),
        ...(userRoleFilter && { workStatus: userRoleFilter }),
      });
      const { data } = await api.get(`/admin/users?${params.toString()}`);
      setUsers(data.users);
      setUserTotalPages(data.pages || 1);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCapturedLeads = async () => {
    setLoadingLeads(true);
    try {
      const params = new URLSearchParams({
        limit: 100,
        ...(leadSearch && { search: leadSearch }),
      });
      const { data } = await api.get(`/admin/captured-leads?${params.toString()}`);
      setLeads(data.leads || []);
    } catch {
      toast.error('Failed to load captured platform signups');
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const { data } = await api.get('/admin/coupons');
      setCoupons(data);
    } catch {
      toast.error('Failed to load coupons');
    } finally {
      setLoadingCoupons(false);
    }
  };

  const fetchAbuseLogs = async () => {
    setLoadingAbuse(true);
    try {
      const { data } = await api.get('/admin/abuse-logs');
      setAbuseLogs(data.logs || []);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoadingAbuse(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'leads') fetchCapturedLeads();
    if (activeTab === 'coupons') fetchCoupons();
    if (activeTab === 'abuse') fetchAbuseLogs();
    if (activeTab === 'metrics') fetchMetrics();
  }, [activeTab, userPage, userSearch, userPlanFilter, userRoleFilter]);

  // Actions
  const handleAssignPlan = async (e) => {
    e.preventDefault();
    if (!planModalUser) return;
    try {
      const { data } = await api.put(`/admin/users/${planModalUser._id}/plan`, {
        plan: selectedPlan,
        cycle: selectedPlanCycle || 'monthly',
        durationDays: selectedPlan === 'free' ? 0 : Number(planDays),
      });
      toast.success(`Plan updated to ${selectedPlan.toUpperCase()}`);

      // Immediately update local state in-place
      if (data?.user) {
        setUsers(prev => prev.map(u => u._id === planModalUser._id ? { ...u, ...data.user, plan: selectedPlan } : u));
      }

      setPlanModalUser(null);
      router.refresh();
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign plan');
    }
  };

  const handleSuspendUser = async (e) => {
    e.preventDefault();
    if (!suspendModalUser) return;
    try {
      await api.post(`/admin/users/${suspendModalUser._id}/suspend`, {
        level: suspendLevel,
        reason: suspendReason,
      });
      toast.success(`User suspension set to Level ${suspendLevel}`);
      setSuspendModalUser(null);
      fetchUsers();
    } catch {
      toast.error('Failed to update suspension');
    }
  };

  const handleUnsuspend = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/suspend`, { unsuspend: true });
      toast.success('Suspension lifted successfully');
      fetchUsers();
    } catch {
      toast.error('Failed to lift suspension');
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      const { data } = await api.put(`/admin/users/${userId}/status`);
      toast.success(data.message);
      fetchUsers();
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to permanently delete ${userName} and all their records?`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success('User deleted permanently');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/coupons', newCoupon);
      toast.success(`Coupon ${newCoupon.code.toUpperCase()} created!`);
      setNewCoupon({ code: '', planGranted: 'pro', durationDays: 30, maxUses: 50, discountPercent: 100 });
      fetchCoupons();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create coupon');
    }
  };

  const handleDeleteCoupon = async (id) => {
    try {
      await api.delete(`/admin/coupons/${id}`);
      toast.success('Coupon deleted');
      fetchCoupons();
    } catch {
      toast.error('Failed to delete coupon');
    }
  };

  const handleSendAlert = async (e) => {
    e.preventDefault();
    setSendingAlert(true);
    try {
      await api.post('/admin/alerts', alertForm);
      toast.success('Alert message dispatched successfully 📢');
      setAlertForm({ userId: 'all', title: '', message: '', type: 'system_alert' });
    } catch {
      toast.error('Failed to dispatch alert');
    } finally {
      setSendingAlert(false);
    }
  };

  const handleLeadStatusChange = async (leadId, nextStatus) => {
    try {
      await api.put(`/leads/${leadId}`, { status: nextStatus });
      toast.success('Lead status updated');
      setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status: nextStatus } : l));
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleLeadPlanChange = async (leadId, nextPlan) => {
    try {
      await api.put(`/leads/${leadId}`, { budget: nextPlan, 'customData.interestedPlan': nextPlan });
      toast.success(`Interested plan updated to ${nextPlan}`);
      setLeads(prev => prev.map(l => l._id === leadId ? { ...l, budget: nextPlan } : l));
    } catch {
      toast.error('Failed to update interested plan');
    }
  };

  const handleSignOut = () => {
    clearAuth();
    router.replace('/login');
  };

  if (loadingInitial) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#090d16', color: 'white' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top SuperAdmin Banner */}
      <header style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '14px 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between flex-wrap gap-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Image
              src="/logo.png"
              alt="SalesCRM Logo"
              width={40}
              height={40}
              style={{ borderRadius: 12, objectFit: 'contain', boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' }}
              priority
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                  SalesCRM <span style={{ color: '#f59e0b' }}>SuperAdmin</span>
                </span>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  MASTER CONTROL
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Platform Infrastructure & Global SaaS Control Center</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleSignOut}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: 6,
          background: '#0f172a',
          padding: 6,
          borderRadius: 14,
          border: '1px solid #1e293b',
          marginBottom: 24,
          overflowX: 'auto'
        }}>
          {[
            { id: 'metrics', label: '📊 SaaS Overview & Metrics', icon: Zap },
            { id: 'users', label: '👥 Platform User Accounts', icon: Users },
            { id: 'leads', label: '🎯 SaaS Pipeline & Inbound Leads', icon: Target },
            { id: 'coupons', label: '🎟️ Promo Coupons', icon: Key },
            { id: 'alerts', label: '📢 System Broadcast Alerts', icon: Bell },
            { id: 'abuse', label: '🛡️ Security & Abuse Logs', icon: ShieldAlert },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTab === tab.id ? 'linear-gradient(135deg, #4f46e5, #3730a3)' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : '#94a3b8',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: GLOBAL METRICS & SAAS OVERVIEW
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'metrics' && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Total Registered Accounts</span>
                  <Users size={18} color="#6366f1" />
                </div>
                <h3 style={{ margin: '12px 0 4px', fontSize: 28, fontWeight: 800, color: '#f8fafc' }}>
                  {metrics?.totalUsers ?? '...'}
                </h3>
                <span style={{ fontSize: 11, color: '#22c55e' }}>{metrics?.recentSignups || 0} in last 30 days</span>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Agency / Company Owners</span>
                  <Building2 size={18} color="#f59e0b" />
                </div>
                <h3 style={{ margin: '12px 0 4px', fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>
                  {metrics?.totalCompanyOwners ?? '...'}
                </h3>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Multi-rep Organizations</span>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Solo / Independent Agents</span>
                  <Briefcase size={18} color="#38bdf8" />
                </div>
                <h3 style={{ margin: '12px 0 4px', fontSize: 28, fontWeight: 800, color: '#38bdf8' }}>
                  {metrics?.totalSoloAgents ?? '...'}
                </h3>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Direct Reps</span>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Total Platform Leads Tracked</span>
                  <Sparkles size={18} color="#22c55e" />
                </div>
                <h3 style={{ margin: '12px 0 4px', fontSize: 28, fontWeight: 800, color: '#22c55e' }}>
                  {metrics?.totalLeads ?? '...'}
                </h3>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Across all tenants</span>
              </div>
            </div>

            {/* Plan Tier Distribution */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={18} color="#f59e0b" /> Subscription Tier Breakdown
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {['free', 'basic_solo', 'smart_solo', 'power_solo', 'team_starter', 'business', 'enterprise', 'custom_enterprise'].map(p => (
                  <div key={p} style={{ background: '#1e293b', padding: '16px 14px', borderRadius: 12, borderLeft: `4px solid ${PLAN_COLORS[p] || '#818cf8'}` }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, color: PLAN_COLORS[p] || '#818cf8' }}>
                      {p.replace(/_/g, ' ')}
                    </span>
                    <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 800 }}>
                      {metrics?.planBreakdown?.[p] || 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: GLOBAL PLATFORM USER ACCOUNTS
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 20 }}>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, phone, usercode..."
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: 10,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: 13
                  }}
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: 13 }}
              >
                <option value="">All Roles</option>
                <option value="company_owner">🏢 Agency Owners</option>
                <option value="independent_agent">👤 Solo Reps</option>
              </select>

              <select
                value={userPlanFilter}
                onChange={e => setUserPlanFilter(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: 13 }}
              >
                <option value="">All Plans</option>
                <option value="free">Free Trial</option>
                <option value="basic_solo">Basic Solo</option>
                <option value="smart_solo">Smart Solo</option>
                <option value="power_solo">Power Solo</option>
                <option value="team_starter">Team Starter</option>
                <option value="business">Business Agency</option>
                <option value="enterprise">Enterprise</option>
                <option value="custom_enterprise">Custom Enterprise</option>
              </select>
            </div>

            {/* Table */}
            {loadingUsers ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
            ) : users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>No users match criteria.</div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 10px' }}>User / Account</th>
                      <th style={{ padding: '12px 10px' }}>Usercode</th>
                      <th style={{ padding: '12px 10px' }}>Role</th>
                      <th style={{ padding: '12px 10px' }}>Plan</th>
                      <th style={{ padding: '12px 10px' }}>Leads</th>
                      <th style={{ padding: '12px 10px' }}>Status</th>
                      <th style={{ padding: '12px 10px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const isSuperAdmin = u.role === 'superadmin' || u.isAdmin || u.email === 'admin@crm.com';
                      const isOwner = u.workStatus === 'company_owner';
                      const isSuspended = u.suspension?.isSuspended;

                      return (
                        <tr key={u._id} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {u.name}
                              {isSuperAdmin && (
                                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontWeight: 800 }}>
                                  SUPERADMIN
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{u.email} {u.phone ? `• +${u.phone}` : ''}</div>
                          </td>
                          <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#818cf8' }}>
                            {u.usercode || '—'}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontWeight: 600,
                              background: isSuperAdmin ? 'rgba(99,102,241,0.15)' : (isOwner ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.15)'),
                              color: isSuperAdmin ? '#818cf8' : (isOwner ? '#f59e0b' : '#38bdf8')
                            }}>
                              {isSuperAdmin ? '👑 Super Admin' : (isOwner ? '🏢 Agency Owner' : '👤 Solo Rep')}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: `${PLAN_COLORS[u.plan || 'free']}22`,
                              color: PLAN_COLORS[u.plan || 'free']
                            }}>
                              {u.plan || 'free'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                            {u.leadCount || 0}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isSuspended ? (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600 }}>
                                Suspended (L{u.suspension.level})
                              </span>
                            ) : u.isActive ? (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontWeight: 600 }}>
                                Active
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(148,163,184,0.15)', color: '#94a3b8', fontWeight: 600 }}>
                                Inactive
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                            {isSuperAdmin ? (
                              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>
                                🛡️ Protected Account
                              </span>
                            ) : (
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  onClick={() => {
                                    setPlanModalUser(u);
                                    setSelectedPlan(u.plan || (u.workStatus === 'independent_agent' ? 'basic_solo' : 'team_starter'));
                                    setSelectedPlanCycle(u.billingCycle || 'monthly');
                                  }}
                                  title="Change Plan Tier"
                                  style={{ padding: '6px 10px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#818cf8', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Plan
                                </button>
                                <button
                                  onClick={() => isSuspended ? handleUnsuspend(u._id) : setSuspendModalUser(u)}
                                  title="Suspend / Unsuspend"
                                  style={{ padding: '6px 10px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: isSuspended ? '#22c55e' : '#f59e0b', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                >
                                  {isSuspended ? 'Lift' : 'Ban'}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u._id, u.name)}
                                  title="Delete account"
                                  style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: SUPERADMIN SAAS PIPELINE & INBOUND LEADS
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'leads' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header & Quick Intake */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4" style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '18px 20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#f8fafc' }}>
                    🎯 SaaS Sales Pipeline & Inbound Subscribers
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
                    {leads.length} Total Opportunities
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  Track incoming agency signups, direct ad calls, and subscription upgrades across your 6-stage SaaS funnel.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
                <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    value={leadSearch}
                    onChange={e => setLeadSearch(e.target.value)}
                    placeholder="Search name, phone, agency..."
                    style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white', fontSize: 12 }}
                  />
                </div>

                <button
                  onClick={() => setShowAddLeadModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 16px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    border: 'none',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
                  }}
                >
                  <Plus size={15} /> Quick SaaS Lead Intake
                </button>
              </div>
            </div>

            {/* Pipeline Stage Filter Chips */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {[
                { id: 'all', label: 'All Inbound Leads', count: leads.length, color: '#94a3b8' },
                { id: 'New Lead (From Ads/Calls)', label: '1. New Lead (Ads/Calls)', count: leads.filter(l => l.status === 'New Lead (From Ads/Calls)' || l.status === 'new').length, color: '#6366f1' },
                { id: 'Platform Signup (Auto-generated when a user registers)', label: '2. Platform Signup', count: leads.filter(l => l.status === 'Platform Signup (Auto-generated when a user registers)' || l.status === 'Platform Signup' || l.source === 'Auto-Signup' || l.tags?.includes('platform_signup')).length, color: '#38bdf8' },
                { id: 'Demo Scheduled', label: '3. Demo Scheduled', count: leads.filter(l => l.status === 'Demo Scheduled' || l.status === 'contacted').length, color: '#f59e0b' },
                { id: 'Trial Active', label: '4. Trial Active', count: leads.filter(l => l.status === 'Trial Active' || l.status === 'site_visit_scheduled' || l.status === 'negotiation').length, color: '#a855f7' },
                { id: 'Payment/Subscription Won', label: '5. Paid / Won 🏆', count: leads.filter(l => l.status === 'Payment/Subscription Won' || l.status === 'closed' || l.status === 'paid').length, color: '#22c55e' },
                { id: 'Closed Lost', label: '6. Closed Lost', count: leads.filter(l => l.status === 'Closed Lost' || l.status === 'lost' || l.status === 'churned').length, color: '#ef4444' },
              ].map(chip => {
                const isSelected = selectedStageFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setSelectedStageFilter(chip.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      background: isSelected ? '#1e293b' : '#0f172a',
                      border: isSelected ? `2px solid ${chip.color}` : '1px solid #1e293b',
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{chip.label}</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 999,
                      background: isSelected ? chip.color : '#334155',
                      color: '#ffffff'
                    }}>
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Leads Table */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 20 }}>
              {loadingLeads ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
              ) : leads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
                  No SaaS leads found. Click <strong>"Quick SaaS Lead Intake"</strong> to record an incoming phone inquiry.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        <th style={{ padding: '12px 10px' }}>Prospect Contact</th>
                        <th style={{ padding: '12px 10px' }}>Organization / Agency</th>
                        <th style={{ padding: '12px 10px' }}>Inbound Source</th>
                        <th style={{ padding: '12px 10px' }}>💎 Interested Plan</th>
                        <th style={{ padding: '12px 10px' }}>Sales Pipeline Stage</th>
                        <th style={{ padding: '12px 10px' }}>Next Demo / Follow-Up</th>
                        <th style={{ padding: '12px 10px', textAlign: 'right' }}>Quick Outreach</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads
                        .filter(l => {
                          if (selectedStageFilter === 'all') return true;
                          if (selectedStageFilter === 'New Lead (From Ads/Calls)') {
                            return l.status === 'New Lead (From Ads/Calls)' || l.status === 'new';
                          }
                          if (selectedStageFilter === 'Platform Signup (Auto-generated when a user registers)') {
                            return l.status === 'Platform Signup (Auto-generated when a user registers)' || l.status === 'Platform Signup' || l.source === 'Auto-Signup' || l.tags?.includes('platform_signup');
                          }
                          if (selectedStageFilter === 'Demo Scheduled') {
                            return l.status === 'Demo Scheduled' || l.status === 'contacted';
                          }
                          if (selectedStageFilter === 'Trial Active') {
                            return l.status === 'Trial Active' || l.status === 'site_visit_scheduled' || l.status === 'negotiation';
                          }
                          if (selectedStageFilter === 'Payment/Subscription Won') {
                            return l.status === 'Payment/Subscription Won' || l.status === 'closed' || l.status === 'paid';
                          }
                          if (selectedStageFilter === 'Closed Lost') {
                            return l.status === 'Closed Lost' || l.status === 'lost' || l.status === 'churned';
                          }
                          return l.status === selectedStageFilter;
                        })
                        .map(l => {
                          const currentPlan = l.budget && SAAS_PLAN_OPTIONS.includes(l.budget)
                            ? l.budget
                            : (l.customData?.interestedPlan || 'Pro Plan');

                          const sourceLabel = l.source || l.customData?.leadSource || (l.tags?.includes('platform_signup') ? 'Auto-Signup' : 'Direct Call');

                          // Map generic legacy statuses to the 6 SaaS stages
                          let currentStage = l.status;
                          if (currentStage === 'new') currentStage = 'New Lead (From Ads/Calls)';
                          else if (currentStage === 'contacted') currentStage = 'Demo Scheduled';
                          else if (currentStage === 'site_visit_scheduled' || currentStage === 'negotiation') currentStage = 'Trial Active';
                          else if (currentStage === 'closed' || currentStage === 'paid') currentStage = 'Payment/Subscription Won';
                          else if (currentStage === 'lost' || currentStage === 'churned') currentStage = 'Closed Lost';
                          else if (!SUPERADMIN_SAAS_STAGES.includes(currentStage)) {
                            currentStage = 'New Lead (From Ads/Calls)';
                          }

                          return (
                            <tr key={l._id} style={{ borderBottom: '1px solid #1e293b' }}>
                              <td style={{ padding: '12px 10px' }}>
                                <div style={{ fontWeight: 700, color: '#f8fafc' }}>{l.name}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{l.email} • +{l.phone}</div>
                              </td>
                              <td style={{ padding: '12px 10px', fontWeight: 600, color: '#cbd5e1' }}>
                                {l.company || 'Individual Representative'}
                              </td>
                              <td style={{ padding: '12px 10px' }}>
                                <span style={{
                                  fontSize: 11,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  background: sourceLabel === 'Auto-Signup' ? 'rgba(56,189,248,0.15)' : (sourceLabel === 'Meta Ads' ? 'rgba(59,130,246,0.15)' : (sourceLabel === 'Google Ads' ? 'rgba(234,179,8,0.15)' : 'rgba(99,102,241,0.15)')),
                                  color: sourceLabel === 'Auto-Signup' ? '#38bdf8' : (sourceLabel === 'Meta Ads' ? '#60a5fa' : (sourceLabel === 'Google Ads' ? '#fbbf24' : '#818cf8'))
                                }}>
                                  {sourceLabel}
                                </span>
                              </td>
                              <td style={{ padding: '12px 10px' }}>
                                <select
                                  value={currentPlan}
                                  onChange={e => handleLeadPlanChange(l._id, e.target.value)}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    background: '#1e293b',
                                    border: '1px solid #4f46e5',
                                    color: '#fbbf24',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {SAAS_PLAN_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ padding: '12px 10px' }}>
                                <select
                                  value={currentStage}
                                  onChange={e => handleLeadStatusChange(l._id, e.target.value)}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    background: '#1e293b',
                                    border: currentStage.includes('Won') ? '1px solid #22c55e' : (currentStage.includes('Lost') ? '1px solid #ef4444' : '1px solid #334155'),
                                    color: currentStage.includes('Won') ? '#22c55e' : (currentStage.includes('Lost') ? '#ef4444' : '#f8fafc'),
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {SUPERADMIN_SAAS_STAGES.map(stg => (
                                    <option key={stg} value={stg}>{stg}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ padding: '12px 10px', fontSize: 11, color: '#94a3b8' }}>
                                {l.followUpDate ? new Date(l.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: 6 }}>
                                  {l.phone && l.phone !== '0000000000' && (
                                    <a
                                      href={`tel:${l.phone}`}
                                      title="Call Prospect"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '5px 9px',
                                        borderRadius: 6,
                                        background: 'rgba(99,102,241,0.15)',
                                        border: '1px solid rgba(99,102,241,0.3)',
                                        color: '#818cf8',
                                        textDecoration: 'none',
                                        fontSize: 11,
                                        fontWeight: 600
                                      }}
                                    >
                                      <Phone size={12} /> Call
                                    </a>
                                  )}
                                  {l.phone && l.phone !== '0000000000' && (
                                    <a
                                      href={waLink(l.phone, `Hi ${l.name}! Thank you for your interest in AgencyCRM. Would you like a personalized walkthrough of the ${currentPlan} features for ${l.company || 'your agency'}?`)}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '5px 10px',
                                        borderRadius: 6,
                                        background: 'rgba(34, 197, 94, 0.15)',
                                        border: '1px solid rgba(34, 197, 94, 0.3)',
                                        color: '#22c55e',
                                        textDecoration: 'none',
                                        fontSize: 11,
                                        fontWeight: 700
                                      }}
                                    >
                                      <MessageSquare size={12} /> WhatsApp
                                    </a>
                                  )}
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
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 4: PROMO COUPONS
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'coupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>Create New Promo Code</h3>
              <form onSubmit={handleCreateCoupon} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Coupon Code (e.g. VIP2026)</label>
                  <input
                    value={newCoupon.code}
                    onChange={e => setNewCoupon(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="PROMO50"
                    style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white' }}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Plan Granted</label>
                    <select
                      value={newCoupon.planGranted}
                      onChange={e => setNewCoupon(f => ({ ...f, planGranted: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white' }}
                    >
                      <optgroup label="Solo Plans">
                        <option value="basic_solo">Basic Solo</option>
                        <option value="smart_solo">Smart Solo</option>
                        <option value="power_solo">Power Solo</option>
                      </optgroup>
                      <optgroup label="Organization Plans">
                        <option value="team_starter">Team Starter</option>
                        <option value="business">Business Agency</option>
                        <option value="enterprise">Enterprise</option>
                        <option value="custom_enterprise">Custom Enterprise</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Duration (Days)</label>
                    <input
                      type="number"
                      value={newCoupon.durationDays}
                      onChange={e => setNewCoupon(f => ({ ...f, durationDays: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Max Uses</label>
                  <input
                    type="number"
                    value={newCoupon.maxUses}
                    onChange={e => setNewCoupon(f => ({ ...f, maxUses: e.target.value }))}
                    style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white' }}
                  />
                </div>
                <button type="submit" style={{ padding: 12, borderRadius: 10, background: '#4f46e5', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', marginTop: 6 }}>
                  Generate Promo Code
                </button>
              </form>
            </div>

            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>Active Coupons ({coupons.length})</h3>
              {loadingCoupons ? (
                <div className="spinner" />
              ) : coupons.length === 0 ? (
                <p style={{ color: '#64748b' }}>No coupons created yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {coupons.map(c => (
                    <div key={c._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1e293b', borderRadius: 10, border: '1px solid #334155' }}>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#fbbf24' }}>{c.code}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          Grants <strong>{(c.planGranted || '').toUpperCase()}</strong> for {c.durationDays} days • {c.usedCount || 0} / {c.maxUses || '∞'} used
                        </div>
                      </div>
                      <button onClick={() => handleDeleteCoupon(c._id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 5: SYSTEM BROADCAST ALERTS
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'alerts' && (
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 24, maxWidth: 640 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#f8fafc' }}>📢 Broadcast System Notification</h3>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: '#64748b' }}>
              Send critical platform announcements, maintenance notices, or feature updates to all user inboxes.
            </p>

            <form onSubmit={handleSendAlert} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Broadcast Target</label>
                <select
                  value={alertForm.userId}
                  onChange={e => setAlertForm(f => ({ ...f, userId: e.target.value }))}
                  style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white' }}
                >
                  <option value="all">Everyone (All Accounts)</option>
                  <option value="company_owner">Agency Owners Only</option>
                  <option value="independent_agent">Solo Agents Only</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Notification Title *</label>
                <input
                  value={alertForm.title}
                  onChange={e => setAlertForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Scheduled System Upgrade"
                  style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Message Content *</label>
                <textarea
                  rows={4}
                  value={alertForm.message}
                  onChange={e => setAlertForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Write message here..."
                  style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white', resize: 'vertical' }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={sendingAlert}
                style={{ padding: 12, borderRadius: 10, background: '#f59e0b', color: '#000', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Send size={16} /> {sendingAlert ? 'Broadcasting...' : '📢 Broadcast Alert to Users'}
              </button>
            </form>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 6: SECURITY & ABUSE LOGS
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'abuse' && (
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
              🛡️ Flagged Accounts & Security Incidents ({abuseUsers.length})
            </h3>
            {loadingAbuse ? (
              <div className="spinner" />
            ) : abuseUsers.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#22c55e' }}>
                <CheckCircle2 size={32} style={{ marginBottom: 8, display: 'inline-block' }} />
                <p style={{ margin: 0, fontWeight: 600 }}>Zero security violations detected across the platform.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {abuseUsers.map(u => (
                  <div key={u._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#1e293b', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{u.name} ({u.email || u.phone})</div>
                      <div style={{ fontSize: 12, color: '#ef4444' }}>
                        Abuse Score: <strong>{u.abuseScore}</strong> • Failed Logins: <strong>{u.loginAttempts}</strong> • Plan: <strong>{u.plan}</strong>
                      </div>
                    </div>
                    <button onClick={() => setSuspendModalUser(u)} style={{ padding: '6px 12px', borderRadius: 8, background: '#ef4444', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                      Suspend Account
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plan Assignment Modal */}
      {planModalUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div className="max-h-[90dvh] overflow-y-auto w-full" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: 24, maxWidth: 460 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>
              Assign Plan: {planModalUser.name} ({planModalUser.email || planModalUser.phone})
            </h3>
            <form onSubmit={handleAssignPlan} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Select Plan Tier ({planModalUser?.workStatus === 'independent_agent' ? '👤 Solo Agent' : '🏢 Organization / Agency'})
                </label>
                <select
                  value={selectedPlan}
                  onChange={e => setSelectedPlan(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white' }}
                >
                  <option value="free">Free Trial (10 Leads Limit)</option>
                  {planModalUser?.workStatus === 'independent_agent' ? (
                    <optgroup label="Solo Agent Plans">
                      {soloPlans.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </optgroup>
                  ) : (
                    <optgroup label="Organization & Agency Plans">
                      {orgPlans.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </optgroup>
                  )}
                  <option value="custom_enterprise">Custom Enterprise (Negotiated Enterprise Plan)</option>
                </select>
              </div>

              {selectedPlan !== 'free' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Billing Cycle</label>
                    <select
                      value={selectedPlanCycle}
                      onChange={e => {
                        setSelectedPlanCycle(e.target.value);
                        setPlanDays(e.target.value === 'yearly' ? 365 : 30);
                      }}
                      style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white' }}
                    >
                      <option value="monthly">Monthly (30 Days)</option>
                      <option value="yearly">Yearly (365 Days)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Custom Duration (Days)</label>
                    <input
                      type="number"
                      value={planDays}
                      onChange={e => setPlanDays(e.target.value)}
                      style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setPlanModalUser(null)} style={{ flex: 1, padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: 10, borderRadius: 8, background: '#4f46e5', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Save & Apply Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspension Modal */}
      {suspendModalUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div className="max-h-[90dvh] overflow-y-auto w-full" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: 24, maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#ef4444' }}>Suspend User: {suspendModalUser.name}</h3>
            <form onSubmit={handleSuspendUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Violation Level</label>
                <select value={suspendLevel} onChange={e => setSuspendLevel(Number(e.target.value))} style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white' }}>
                  <option value={1}>Level 1 (24 Hours Warning)</option>
                  <option value={2}>Level 2 (7 Days Lock)</option>
                  <option value={3}>Level 3 (30 Days Freeze)</option>
                  <option value={4}>Level 4 (Permanent Ban)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Reason</label>
                <input value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="e.g. Repeated Spam Complaints" style={{ width: '100%', padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: 'white' }} required />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setSuspendModalUser(null)} style={{ flex: 1, padding: 10, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: 10, borderRadius: 8, background: '#ef4444', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Apply Suspension</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick SaaS Lead Intake Modal */}
      <AddSaaSLeadModal
        isOpen={showAddLeadModal}
        onClose={() => setShowAddLeadModal(false)}
        onCreated={(newLead) => setLeads(prev => [newLead, ...prev])}
      />
    </div>
  );
}
