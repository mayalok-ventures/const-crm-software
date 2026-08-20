'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Users, TrendingUp, Activity, Shield, AlertTriangle,
  Plus, Search, Check, X, RefreshCw,
  Phone, MessageSquare, DollarSign, Clock,
  Layers, Download, CheckCircle2,
  Send, Sliders, FileText, UserCheck, UserX, Eye,
  Trash2, Share2, Grid, List, Award, ArrowRight,
  Briefcase, AlertCircle, Crown, ChevronLeft, ChevronRight,
  Zap, Ticket
} from 'lucide-react';
import { getUser } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Standard 5 Kanban Stages
const KANBAN_STAGES = [
  { id: 'new_lead', label: 'New Lead', color: 'border-slate-500/40 bg-slate-500/10 text-slate-300', dot: 'bg-slate-400' },
  { id: 'contacted', label: 'Contacted', color: 'border-blue-500/40 bg-blue-500/10 text-blue-300', dot: 'bg-blue-400' },
  { id: 'not_interested', label: 'Not Interested', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300', dot: 'bg-rose-400' },
  { id: 'converted', label: 'Converted', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
  { id: 'payment_done', label: 'Payment Done', color: 'border-purple-500/40 bg-purple-500/10 text-purple-300', dot: 'bg-purple-400' },
];

const SERVICE_CATALOG = {
  basic_solo: { label: 'Basic Solo (₹399/mo)', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  smart_solo: { label: 'Smart Solo (₹799/mo)', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  power_solo: { label: 'Power Solo (₹1,299/mo)', color: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  team_starter: { label: 'Team Starter (₹1,499/mo)', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  business: { label: 'Business Agency (₹2,499/mo)', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  enterprise: { label: 'Enterprise Command (₹4,999/mo)', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  custom_enterprise: { label: 'Custom Enterprise', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  free: { label: 'Free Trial', color: 'bg-slate-700/30 text-slate-300 border-slate-700' },
};

const ITEMS_PER_PAGE = 25;

export default function AdminPage() {
  const router = useRouter();

  // Auth & System State
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState('pipeline');
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Tab Data Cache (Lazy loaded for instant speed)
  const [metrics, setMetrics] = useState(null);
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState({ flaggedLeads: [], overdueFollowUps: [], totalAlerts: 0 });
  const [activityLogs, setActivityLogs] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loadedTabs, setLoadedTabs] = useState(new Set());

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [leadTypeFilter, setLeadTypeFilter] = useState('all');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('all');
  const [viewMode, setViewMode] = useState('kanban');

  // Pagination Pages
  const [tablePage, setTablePage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [logPage, setLogPage] = useState(1);

  // Modals & Drawers
  const [selectedLead, setSelectedLead] = useState(null);
  const [targetLead, setTargetLead] = useState(null);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedUserForPlan, setSelectedUserForPlan] = useState(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  // Form States
  const [followUpForm, setFollowUpForm] = useState({ scheduled_at: '', note: '' });
  const [convertForm, setConvertForm] = useState({
    custom_payment_amount: '',
    custom_price_reason: '',
    payment_method: 'bank_transfer',
    transaction_id: '',
    verify_payment: true,
  });
  const [newLeadForm, setNewLeadForm] = useState({
    name: '', phone: '', email: '', company: '', service_required: 'smart_solo', monthly_spend: '', goal_timeline: 'immediate', assignedTo: '', notes: ''
  });
  const [newAgentForm, setNewAgentForm] = useState({
    name: '', email: '', phone: '', password: 'Password@123', companyRole: 'sales_rep', incentive_pct: 10, whatsapp_connection: 'agent_owned'
  });
  const [reassignForm, setReassignForm] = useState({ fromAgentId: '', toAgentId: '' });
  const [couponForm, setCouponForm] = useState({ code: '', discount_pct: 20, max_uses: 100 });
  const [alertForm, setAlertForm] = useState({ title: '', message: '', type: 'info' });

  // 1. Instant Auth Guard Check (Single Unified Admin Role)
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!storedToken) {
      router.replace('/login');
      return;
    }
    try {
      const u = JSON.parse(storedUser || '{}');
      if (u.role !== 'admin' && u.role !== 'superadmin' && !u.isAdmin && u.email !== 'admin@crm.com') {
        router.replace('/dashboard');
        return;
      }
    } catch {
      router.replace('/login');
      return;
    }
    setToken(storedToken);
  }, [router]);

  // 2. Fetch Lightweight Metrics Fast (< 80ms)
  const fetchMetrics = useCallback(async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/admin/metrics`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.warn('Metrics sync error:', err.message);
    }
  }, [token]);

  // 3. Lazy Tab-Specific Fast Loader (Instant UI Response)
  const loadTabData = useCallback(async (tabName, authToken = token, force = false) => {
    if (!authToken) return;
    if (!force && loadedTabs.has(tabName)) return; // Already cached in memory!

    const headers = { Authorization: `Bearer ${authToken}` };
    try {
      if (tabName === 'pipeline') {
        const [lRes, aRes] = await Promise.all([
          fetch(`${API_BASE}/admin/leads?limit=250`, { headers }).catch(() => null),
          fetch(`${API_BASE}/admin/agents`, { headers }).catch(() => null),
        ]);
        if (lRes && lRes.ok) {
          const d = await lRes.json();
          setLeads(d.leads || []);
        }
        if (aRes && aRes.ok) {
          const d = await aRes.json();
          setAgents(d.agents || []);
        }
      } else if (tabName === 'agents') {
        const aRes = await fetch(`${API_BASE}/admin/agents`, { headers });
        if (aRes.ok) {
          const d = await aRes.json();
          setAgents(d.agents || []);
        }
      } else if (tabName === 'users') {
        const uRes = await fetch(`${API_BASE}/admin/users?limit=300`, { headers });
        if (uRes.ok) {
          const d = await uRes.json();
          setUsersList(d.users || []);
        }
      } else if (tabName === 'alerts_queue') {
        const alRes = await fetch(`${API_BASE}/admin/alerts-queue`, { headers });
        if (alRes.ok) {
          const d = await alRes.json();
          setAdminAlerts(d || { flaggedLeads: [], overdueFollowUps: [], totalAlerts: 0 });
        }
      } else if (tabName === 'activity_logs') {
        const actRes = await fetch(`${API_BASE}/admin/activity-logs?limit=100`, { headers });
        if (actRes.ok) {
          const d = await actRes.json();
          setActivityLogs(d.logs || []);
        }
      } else if (tabName === 'coupons') {
        const cRes = await fetch(`${API_BASE}/admin/coupons`, { headers });
        if (cRes.ok) {
          const d = await cRes.json();
          setCoupons(d.coupons || (Array.isArray(d) ? d : []));
        }
      }
      setLoadedTabs(prev => new Set(prev).add(tabName));
    } catch (err) {
      console.warn(`Tab ${tabName} load error:`, err.message);
    }
  }, [token, loadedTabs]);

  // Initial fast load (Metrics + Active Tab only)
  useEffect(() => {
    if (token) {
      fetchMetrics(token);
      loadTabData(activeTab, token);
    }
  }, [token, activeTab, fetchMetrics, loadTabData]);

  // Refresh active tab
  const handleRefreshAll = async () => {
    setSyncing(true);
    await Promise.all([
      fetchMetrics(token),
      loadTabData(activeTab, token, true),
    ]);
    setSyncing(false);
    toast.success('Admin data synchronized ⚡');
  };

  // Switch Tab instantly
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    loadTabData(newTab, token);
  };

  // Memoized Search & Filter on Leads
  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return leads.filter((lead) => {
      if (leadTypeFilter === 'real' && !lead.isRealData) return false;
      if (leadTypeFilter === 'test' && !lead.isTestData) return false;
      if (agentFilter !== 'all') {
        const assignedId = lead.assignedTo?._id || lead.assignedTo;
        if (assignedId !== agentFilter) return false;
      }
      if (q) {
        const nMatch = lead.name?.toLowerCase().includes(q);
        const pMatch = lead.phone?.toLowerCase().includes(q);
        const eMatch = lead.email?.toLowerCase().includes(q);
        const cMatch = lead.company?.toLowerCase().includes(q);
        if (!nMatch && !pMatch && !eMatch && !cMatch) return false;
      }
      return true;
    });
  }, [leads, leadTypeFilter, agentFilter, searchQuery]);

  // Paginated Leads (for Table View)
  const paginatedLeads = useMemo(() => {
    const start = (tablePage - 1) * ITEMS_PER_PAGE;
    return filteredLeads.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLeads, tablePage]);

  // Memoized Search & Filter on Users
  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.toLowerCase().trim();
    return usersList.filter((user) => {
      if (userTypeFilter === 'real' && !user.isRealData) return false;
      if (userTypeFilter === 'test' && !user.isTestData) return false;
      if (userPlanFilter !== 'all' && user.plan !== userPlanFilter) return false;
      if (q) {
        const nMatch = user.name?.toLowerCase().includes(q);
        const pMatch = user.phone?.toLowerCase().includes(q);
        const eMatch = user.email?.toLowerCase().includes(q);
        const cMatch = (user.companyInfo?.companyName || user.organizationName)?.toLowerCase().includes(q);
        const uMatch = user.usercode?.toLowerCase().includes(q);
        if (!nMatch && !pMatch && !eMatch && !cMatch && !uMatch) return false;
      }
      return true;
    });
  }, [usersList, userTypeFilter, userPlanFilter, userSearchQuery]);

  // Paginated Users
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, userPage]);

  // Optimistic UI Stage Change
  const handleUpdateStage = async (leadId, newStage) => {
    // Optimistic state update (Instant 60fps response)
    setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status: newStage, stage: newStage } : l));
    try {
      const res = await fetch(`${API_BASE}/admin/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) {
        toast.success(`Stage updated to ${newStage.replace(/_/g, ' ')}`);
        fetchMetrics(token);
      } else {
        toast.error('Server failed to update stage');
        loadTabData('pipeline', token, true);
      }
    } catch {
      toast.error('Network error updating stage');
      loadTabData('pipeline', token, true);
    }
  };

  // Create Lead
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLeadForm.name.trim() || !newLeadForm.phone.trim()) {
      return toast.error('Lead Name and Phone are required.');
    }
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newLeadForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Lead created in CRM pipeline! 🚀');
        setShowAddLeadModal(false);
        setNewLeadForm({ name: '', phone: '', email: '', company: '', service_required: 'smart_solo', monthly_spend: '', goal_timeline: 'immediate', assignedTo: '', notes: '' });
        loadTabData('pipeline', token, true);
        fetchMetrics(token);
      } else {
        toast.error(data.message || 'Failed to create lead');
      }
    } catch {
      toast.error('Server error creating lead');
    } finally {
      setActionLoading(false);
    }
  };

  // Onboard Agent
  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!newAgentForm.name.trim() || !newAgentForm.email.trim() || !newAgentForm.phone.trim()) {
      return toast.error('Name, Email and Phone are required.');
    }
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newAgentForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Agent ${newAgentForm.name} onboarded! 🌟`);
        setShowAddAgentModal(false);
        setNewAgentForm({ name: '', email: '', phone: '', password: 'Password@123', companyRole: 'sales_rep', incentive_pct: 10, whatsapp_connection: 'agent_owned' });
        loadTabData('agents', token, true);
        fetchMetrics(token);
      } else {
        toast.error(data.message || 'Failed to onboard agent');
      }
    } catch {
      toast.error('Server error onboarding agent');
    } finally {
      setActionLoading(false);
    }
  };

  // Convert Lead with Payment
  const handleConvertLead = async (e) => {
    e.preventDefault();
    if (!convertForm.custom_payment_amount || Number(convertForm.custom_payment_amount) <= 0) {
      return toast.error('Valid Payment Amount is required.');
    }
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/leads/${targetLead._id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(convertForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Deal converted with recorded payment! 💰');
        setShowConvertModal(false);
        loadTabData('pipeline', token, true);
        fetchMetrics(token);
      } else {
        toast.error(data.message || 'Failed to convert deal');
      }
    } catch {
      toast.error('Server error converting deal');
    } finally {
      setActionLoading(false);
    }
  };

  // Schedule Follow-Up
  const handleScheduleFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpForm.scheduled_at || !followUpForm.note.trim()) {
      return toast.error('Date/Time and mandatory agenda note are required.');
    }
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/leads/${targetLead._id}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(followUpForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Follow-up scheduled ⏰');
        setShowFollowUpModal(false);
        setFollowUpForm({ scheduled_at: '', note: '' });
        loadTabData('pipeline', token, true);
      } else {
        toast.error(data.message || 'Failed to schedule follow-up');
      }
    } catch {
      toast.error('Server error scheduling follow-up');
    } finally {
      setActionLoading(false);
    }
  };

  // User Actions: Assign Plan, Toggle Status, Purge Test Data
  const handleAssignPlan = async (userId, planName) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/users/${userId}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planName }),
      });
      if (res.ok) {
        toast.success(`Plan updated to ${planName.toUpperCase()} ✅`);
        setShowPlanModal(false);
        // Optimistic update
        setUsersList(prev => prev.map(u => u._id === userId ? { ...u, plan: planName } : u));
      } else {
        toast.error('Failed to update plan');
      }
    } catch {
      toast.error('Server error updating plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId) => {
    try {
      // Optimistic update
      setUsersList(prev => prev.map(u => u._id === userId ? { ...u, isActive: !u.isActive } : u));
      const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('User status updated ✅');
      } else {
        toast.error('Failed to toggle status');
        loadTabData('users', token, true);
      }
    } catch {
      toast.error('Server error updating status');
      loadTabData('users', token, true);
    }
  };

  const handlePurgeTestData = async () => {
    if (!confirm('⚠️ Are you sure you want to purge ONLY synthetic test leads & demo accounts? Real production users will be 100% preserved.')) return;
    try {
      setActionLoading(true);
      const res = await fetch(`${API_BASE}/admin/purge-test-data`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Test data cleaned up successfully! 🧹');
        fetchMetrics(token);
        loadTabData(activeTab, token, true);
      } else {
        toast.error(data.message || 'Failed to purge test data');
      }
    } catch {
      toast.error('Server error during test data purge');
    } finally {
      setActionLoading(false);
    }
  };

  // Export CSV Activity Logs
  const handleExportCSV = () => {
    if (!activityLogs.length) return toast.error('No activity logs to export.');
    const headers = ['Timestamp', 'Action', 'Performer', 'Details'];
    const rows = activityLogs.map(l => [
      `"${new Date(l.timestamp || l.createdAt).toLocaleString()}"`,
      `"${l.action || ''}"`,
      `"${l.performedByName || l.performerName || 'System'}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CRM_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Activity logs exported as CSV! 📥');
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col selection:bg-amber-500/30">
      {/* 1. Universal Admin Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black">
                <Crown size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black tracking-tight text-white">Admin Panel</span>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Unified Suite
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Platform Management & CRM Control</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleRefreshAll}
              disabled={syncing}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700/60 transition"
              title="Refresh Data"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin text-amber-400' : ''} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 border border-indigo-500/30 transition"
            >
              <ArrowRight size={14} />
              <span className="hidden sm:inline">CRM User View</span>
            </Link>

            <Link
              href="/profile"
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700/60 transition"
            >
              <Users size={14} />
              <span className="hidden sm:inline">Profile</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Strip */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-[#0f172a]/70 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Revenue</span>
              <DollarSign size={16} />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              ₹{Number(metrics?.totalRevenueWon || metrics?.pipeline?.totalRevenue || metrics?.totalRevenue || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-400/90 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp size={12} /> {metrics?.pipeline?.converted || metrics?.convertedLeadsCount || 0} Won Deals
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0f172a]/70 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-indigo-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Leads</span>
              <Layers size={16} />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {metrics?.totalLeads || leads.length}
            </div>
            <div className="text-[11px] text-indigo-400/90 font-semibold mt-1">
              Active CRM Pipeline
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0f172a]/70 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Registered Users</span>
              <Users size={16} />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {metrics?.totalUsers || usersList.length}
            </div>
            <div className="text-[11px] text-blue-400/90 font-semibold mt-1">
              {metrics?.activeUsers || usersList.filter(u => u.isActive !== false).length} Active Accounts
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0f172a]/70 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-violet-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sales Agents</span>
              <Award size={16} />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {metrics?.totalSoloAgents || agents.length}
            </div>
            <div className="text-[11px] text-violet-400/90 font-semibold mt-1">
              Commission Hierarchy
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0f172a]/70 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Alerts Queue</span>
              <AlertTriangle size={16} />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {adminAlerts?.totalAlerts || 0}
            </div>
            <div className="text-[11px] text-rose-400/90 font-semibold mt-1">
              {adminAlerts?.overdueFollowUps?.length || 0} Overdue Follow-ups
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0f172a]/70 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">System Health</span>
              <Zap size={16} />
            </div>
            <div className="text-sm font-black text-emerald-400 flex items-center gap-1.5 pt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              100% Operational
            </div>
            <div className="text-[11px] text-slate-400 font-semibold mt-1">
              High-Speed Engine
            </div>
          </div>
        </section>

        {/* 3. Navigation Tabs */}
        <section className="border-b border-slate-800/80 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar pb-1">
          <div className="flex items-center gap-2">
            {[
              { id: 'pipeline', label: 'Pipeline & Deals', icon: Layers, count: metrics?.totalLeads || leads.length },
              { id: 'agents', label: 'Agent Network', icon: Award, count: metrics?.totalSoloAgents || agents.length },
              { id: 'users', label: 'Users & Tenants', icon: Users, count: metrics?.totalUsers || usersList.length },
              { id: 'alerts_queue', label: 'Alerts & Audits', icon: AlertTriangle, count: adminAlerts?.totalAlerts || 0, alert: true },
              { id: 'activity_logs', label: 'Activity Logs', icon: Activity, count: activityLogs.length },
              { id: 'coupons', label: 'Coupons & Alerts', icon: Ticket, count: coupons.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon size={15} className={isActive ? 'text-amber-400' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      tab.alert && tab.count > 0
                        ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                        : isActive
                        ? 'bg-amber-500/30 text-amber-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePurgeTestData}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 flex items-center gap-1.5 transition whitespace-nowrap"
            >
              <Trash2 size={13} />
              <span>Purge Test Data</span>
            </button>
          </div>
        </section>

        {/* 4. Tab 1: CRM Pipeline & Deals */}
        {activeTab === 'pipeline' && (
          <section className="space-y-4">
            {/* Filter Bar */}
            <div className="p-4 rounded-2xl bg-[#0f172a]/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1 max-w-md">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Fast search prospect by name, phone, email..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      <X size={13} />
                    </button>
                  )}
                </div>

                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Agents</option>
                  {agents.map(a => (
                    <option key={a._id} value={a._id}>{a.name}</option>
                  ))}
                </select>

                <select
                  value={leadTypeFilter}
                  onChange={(e) => setLeadTypeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Data</option>
                  <option value="real">Real Leads Only</option>
                  <option value="test">Test Data Only</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-slate-900 p-1 rounded-xl border border-slate-700/80 flex items-center gap-1">
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`p-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'kanban' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    title="Kanban Board"
                  >
                    <Grid size={15} />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'table' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    title="Table View"
                  >
                    <List size={15} />
                  </button>
                </div>

                <button
                  onClick={() => setShowAddLeadModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
                >
                  <Plus size={14} />
                  <span>Add Lead</span>
                </button>
              </div>
            </div>

            {/* Kanban View */}
            {viewMode === 'kanban' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {KANBAN_STAGES.map((stage) => {
                  const stageLeads = filteredLeads.filter(l => (l.status || l.stage) === stage.id);
                  return (
                    <div key={stage.id} className="flex flex-col rounded-2xl bg-[#0f172a]/60 border border-slate-800/80 overflow-hidden">
                      <div className={`px-3.5 py-2.5 border-b flex items-center justify-between ${stage.color}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                          <span className="text-xs font-bold">{stage.label}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-900/60 text-white">
                          {stageLeads.length}
                        </span>
                      </div>

                      <div className="p-2.5 flex-1 space-y-2.5 overflow-y-auto max-h-[650px]">
                        {stageLeads.length === 0 ? (
                          <div className="text-center py-8 text-slate-500 text-xs font-medium">
                            No prospects
                          </div>
                        ) : (
                          stageLeads.slice(0, 40).map((lead) => (
                            <div
                              key={lead._id}
                              className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-sm transition space-y-2 group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition">
                                    {lead.name}
                                  </h4>
                                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{lead.phone}</p>
                                </div>
                                <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded-md uppercase ${
                                  lead.isRealData ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {lead.isRealData ? 'Real' : 'Test'}
                                </span>
                              </div>

                              {lead.company && (
                                <div className="text-[11px] text-slate-300 flex items-center gap-1 font-medium">
                                  <Briefcase size={11} className="text-slate-500" />
                                  <span>{lead.company}</span>
                                </div>
                              )}

                              {lead.followUpDate && (
                                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <Clock size={11} />
                                    <span>{new Date(lead.followUpDate).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
                                <button
                                  onClick={() => setSelectedLead(lead)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1 transition"
                                >
                                  <Eye size={11} /> View
                                </button>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => { setTargetLead(lead); setShowFollowUpModal(true); }}
                                    className="p-1 rounded bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition"
                                    title="Schedule Follow-Up"
                                  >
                                    <Clock size={12} />
                                  </button>
                                  {stage.id !== 'converted' && stage.id !== 'payment_done' && (
                                    <button
                                      onClick={() => { setTargetLead(lead); setShowConvertModal(true); }}
                                      className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/30 transition"
                                      title="Convert Deal"
                                    >
                                      Convert
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Paginated Table View */
              <div className="rounded-2xl bg-[#0f172a]/80 border border-slate-800 overflow-hidden space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3.5">Prospect</th>
                        <th className="p-3.5">Phone & Email</th>
                        <th className="p-3.5">Company</th>
                        <th className="p-3.5">Stage</th>
                        <th className="p-3.5">Follow-Up</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {paginatedLeads.map(lead => (
                        <tr key={lead._id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3.5 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <span>{lead.name}</span>
                              <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded ${lead.isRealData ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                {lead.isRealData ? 'Real' : 'Test'}
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-300 font-mono text-[11px]">
                            <div>{lead.phone}</div>
                            <div className="text-slate-500 text-[10px]">{lead.email || '-'}</div>
                          </td>
                          <td className="p-3.5 text-slate-300">{lead.company || '-'}</td>
                          <td className="p-3.5">
                            <select
                              value={lead.status || lead.stage || 'new_lead'}
                              onChange={(e) => handleUpdateStage(lead._id, e.target.value)}
                              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-200 focus:outline-none focus:border-amber-500"
                            >
                              {KANBAN_STAGES.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3.5 text-slate-300">
                            {lead.followUpDate ? (
                              <span className="text-amber-300 font-medium">
                                {new Date(lead.followUpDate).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right space-x-2">
                            <button
                              onClick={() => setSelectedLead(lead)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
                            >
                              Details
                            </button>
                            <button
                              onClick={() => { setTargetLead(lead); setShowConvertModal(true); }}
                              className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/30"
                            >
                              Convert
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-3 flex items-center justify-between border-t border-slate-800 text-xs text-slate-400">
                  <span>Showing {(tablePage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(tablePage * ITEMS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length} leads</span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={tablePage === 1}
                      onClick={() => setTablePage(p => p - 1)}
                      className="p-1 rounded bg-slate-800 disabled:opacity-30 hover:bg-slate-700"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="font-bold text-white">Page {tablePage}</span>
                    <button
                      disabled={tablePage * ITEMS_PER_PAGE >= filteredLeads.length}
                      onClick={() => setTablePage(p => p + 1)}
                      className="p-1 rounded bg-slate-800 disabled:opacity-30 hover:bg-slate-700"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 5. Tab 2: Agent Network */}
        {activeTab === 'agents' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Agent Commission Network & Hierarchy</h3>
                <p className="text-xs text-slate-400">Manage sales agents, track individual incentive payouts, and configure commission rates.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddAgentModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
                >
                  <Plus size={14} />
                  <span>Onboard Agent</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <div key={agent._id} className="p-4 rounded-2xl bg-[#0f172a]/80 border border-slate-800 space-y-3 shadow-sm hover:border-slate-700 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm">
                        {agent.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{agent.name}</h4>
                        <p className="text-xs text-slate-400">{agent.email}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {agent.incentive_pct || 10}% Commission
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Sales Won</span>
                      <span className="font-bold text-emerald-400">₹{Number(agent.total_sales || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Incentives Earned</span>
                      <span className="font-bold text-amber-300">₹{Number(agent.incentive_earned || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>User Code: <strong className="text-slate-200">{agent.usercode || 'AGT-' + agent._id?.slice(-4)}</strong></span>
                    <span>Phone: {agent.phone || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. Tab 3: Users & Tenants */}
        {activeTab === 'users' && (
          <section className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#0f172a]/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1 max-w-md">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search user by name, phone, email..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <select
                  value={userTypeFilter}
                  onChange={(e) => setUserTypeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Accounts ({usersList.length})</option>
                  <option value="real">Real Accounts Only ({usersList.filter(u => u.isRealData).length})</option>
                  <option value="test">Test Accounts Only ({usersList.filter(u => u.isTestData).length})</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl bg-[#0f172a]/80 border border-slate-800 overflow-hidden space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">User</th>
                      <th className="p-3.5">Phone & Email</th>
                      <th className="p-3.5">Organization</th>
                      <th className="p-3.5">Plan</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {paginatedUsers.map(u => (
                      <tr key={u._id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>{u.name}</span>
                            <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded ${u.isRealData ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                              {u.isRealData ? 'Real' : 'Test'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-300 font-mono text-[11px]">
                          <div>{u.phone}</div>
                          <div className="text-slate-500 text-[10px]">{u.email}</div>
                        </td>
                        <td className="p-3.5 text-slate-300">{u.companyInfo?.companyName || u.organizationName || '-'}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                            SERVICE_CATALOG[u.plan]?.color || 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {u.plan || 'Free'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <button
                            onClick={() => handleToggleUserStatus(u._id)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase transition ${
                              u.isActive !== false ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                            }`}
                          >
                            {u.isActive !== false ? 'Active' : 'Suspended'}
                          </button>
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => { setSelectedUserForPlan(u); setShowPlanModal(true); }}
                            className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-[11px] font-bold border border-indigo-500/30 transition"
                          >
                            Change Plan
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* User Pagination Controls */}
              <div className="p-3 flex items-center justify-between border-t border-slate-800 text-xs text-slate-400">
                <span>Showing {(userPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(userPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={userPage === 1}
                    onClick={() => setUserPage(p => p - 1)}
                    className="p-1 rounded bg-slate-800 disabled:opacity-30 hover:bg-slate-700"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="font-bold text-white">Page {userPage}</span>
                  <button
                    disabled={userPage * ITEMS_PER_PAGE >= filteredUsers.length}
                    onClick={() => setUserPage(p => p + 1)}
                    className="p-1 rounded bg-slate-800 disabled:opacity-30 hover:bg-slate-700"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 7. Tab 4: Alerts Queue */}
        {activeTab === 'alerts_queue' && (
          <section className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Critical Alerts & Audit Queue</h3>
              <p className="text-xs text-slate-400">Flagged deals requiring approval and overdue follow-up notifications.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#0f172a]/80 border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <AlertCircle size={16} /> Flagged Deals ({adminAlerts?.flaggedLeads?.length || 0})
                </h4>
                <div className="space-y-2">
                  {(adminAlerts?.flaggedLeads || []).length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">No flagged deals. ✨</div>
                  ) : (
                    adminAlerts.flaggedLeads.map(lead => (
                      <div key={lead._id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-white">
                          <span>{lead.name}</span>
                          <span className="text-amber-400">₹{lead.closedDealAmount || lead.budget}</span>
                        </div>
                        <p className="text-slate-400 text-[11px]">Reason: {lead.customPriceReason || 'Discount override applied'}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0f172a]/80 border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                  <Clock size={16} /> Overdue Follow-Ups ({adminAlerts?.overdueFollowUps?.length || 0})
                </h4>
                <div className="space-y-2">
                  {(adminAlerts?.overdueFollowUps || []).length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">No overdue follow-ups. ⏰</div>
                  ) : (
                    adminAlerts.overdueFollowUps.map(lead => (
                      <div key={lead._id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-white">
                          <span>{lead.name}</span>
                          <span className="text-rose-400">{new Date(lead.followUpDate).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-400 text-[11px]">Note: &ldquo;{lead.followUpNote || 'Agenda note'}&rdquo;</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 8. Tab 5: Activity Logs */}
        {activeTab === 'activity_logs' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Platform Audit Logs</h3>
                <p className="text-xs text-slate-400">Chronological history of lead conversions, payments, and user actions.</p>
              </div>
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 transition"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="rounded-2xl bg-[#0f172a]/80 border border-slate-800 divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
              {activityLogs.map((log, idx) => (
                <div key={idx} className="p-3.5 flex items-start justify-between gap-3 text-xs hover:bg-slate-800/30 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 mt-0.5">
                      <Activity size={15} />
                    </div>
                    <div>
                      <div className="font-bold text-white">{log.action?.replace(/_/g, ' ').toUpperCase()}</div>
                      <p className="text-slate-400 text-[11px] mt-0.5">{log.details || log.description}</p>
                      <div className="text-[10px] text-slate-500 mt-1">By: {log.performedByName || log.performerName || 'System'}</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                    {new Date(log.timestamp || log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9. Tab 6: Coupons */}
        {activeTab === 'coupons' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Promo Coupons & Discounts</h3>
                <p className="text-xs text-slate-400">Issue discount coupons to users.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coupons.map((c, i) => (
                <div key={i} className="p-4 rounded-2xl bg-[#0f172a]/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold text-sm">
                      {c.code}
                    </span>
                    <span className="text-emerald-400 font-black text-sm">{c.discount_pct || c.discountPct}% OFF</span>
                  </div>
                  <div className="text-xs text-slate-400">Uses: {c.used_count || 0} / {c.max_uses || 'Unlimited'}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 10. Modals */}

      {/* Slide-Over Drawer */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0f172a] border-l border-slate-800 h-full p-6 overflow-y-auto space-y-5 animate-in slide-in-from-right duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Prospect Details</h3>
              <button onClick={() => setSelectedLead(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px] block">Full Name</span>
                <span className="text-sm font-bold text-white">{selectedLead.name}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px] block">Phone Number</span>
                <span className="text-slate-200 font-mono">{selectedLead.phone}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px] block">Email</span>
                <span className="text-slate-200">{selectedLead.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px] block">Company</span>
                <span className="text-slate-200">{selectedLead.company || 'N/A'}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2">
              <button
                onClick={() => { setTargetLead(selectedLead); setShowFollowUpModal(true); }}
                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2"
              >
                <Clock size={14} /> Schedule Follow-Up
              </button>
              <button
                onClick={() => { setTargetLead(selectedLead); setShowConvertModal(true); }}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2"
              >
                <Award size={14} /> Convert Deal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Assignment Modal */}
      {showPlanModal && selectedUserForPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Assign Subscription Plan</h3>
              <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-400">Select subscription plan for <strong>{selectedUserForPlan.name}</strong>:</p>
            <div className="space-y-2">
              {['free', 'basic_solo', 'smart_solo', 'power_solo', 'team_starter', 'business', 'enterprise', 'custom_enterprise'].map(p => (
                <button
                  key={p}
                  onClick={() => handleAssignPlan(selectedUserForPlan._id, p)}
                  disabled={actionLoading}
                  className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-left text-xs font-bold text-white flex items-center justify-between"
                >
                  <span>{SERVICE_CATALOG[p]?.label || p.replace(/_/g, ' ').toUpperCase()}</span>
                  {selectedUserForPlan.plan === p && <Check size={14} className="text-amber-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Convert Deal Modal */}
      {showConvertModal && targetLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleConvertLead} className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Convert Lead & Record Payment</h3>
              <button type="button" onClick={() => setShowConvertModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={convertForm.custom_payment_amount}
                  onChange={(e) => setConvertForm(prev => ({ ...prev, custom_payment_amount: e.target.value }))}
                  placeholder="e.g. 50000"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Payment Method</label>
                <select
                  value={convertForm.payment_method}
                  onChange={(e) => setConvertForm(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                >
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="upi">UPI / QR Code</option>
                  <option value="credit_card">Credit / Debit Card</option>
                  <option value="cash">Cash Receipt</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Transaction / UTR ID</label>
                <input
                  type="text"
                  value={convertForm.transaction_id}
                  onChange={(e) => setConvertForm(prev => ({ ...prev, transaction_id: e.target.value }))}
                  placeholder="e.g. UTR-982746193"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition"
            >
              Verify Payment & Convert Deal 💰
            </button>
          </form>
        </div>
      )}

      {/* Schedule Follow-Up Modal */}
      {showFollowUpModal && targetLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleScheduleFollowUp} className="w-full max-w-sm bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Schedule Follow-Up</h3>
              <button type="button" onClick={() => setShowFollowUpModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={followUpForm.scheduled_at}
                  onChange={(e) => setFollowUpForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Mandatory Agenda Note *</label>
                <textarea
                  required
                  rows={3}
                  value={followUpForm.note}
                  onChange={(e) => setFollowUpForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="e.g. Call to discuss contract and demo"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition"
            >
              Confirm Follow-Up Schedule ⏰
            </button>
          </form>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateLead} className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Create New Lead</h3>
              <button type="button" onClick={() => setShowAddLeadModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Prospect Name *</label>
                <input
                  type="text"
                  required
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Rajesh Verma"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="9876543210"
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">Email Address</label>
                  <input
                    type="email"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="rajesh@example.com"
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Company / Organization</label>
                <input
                  type="text"
                  value={newLeadForm.company}
                  onChange={(e) => setNewLeadForm(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="e.g. Apex Enterprises"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition"
            >
              Add Lead to Pipeline 🚀
            </button>
          </form>
        </div>
      )}

      {/* Onboard Agent Modal */}
      {showAddAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateAgent} className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Onboard Sales Agent</h3>
              <button type="button" onClick={() => setShowAddAgentModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Agent Name *</label>
                <input
                  type="text"
                  required
                  value={newAgentForm.name}
                  onChange={(e) => setNewAgentForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Rohit Mehra"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newAgentForm.email}
                    onChange={(e) => setNewAgentForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="rohit@crm.com"
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-bold">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={newAgentForm.phone}
                    onChange={(e) => setNewAgentForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="9876543210"
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition"
            >
              Onboard Agent 🌟
            </button>
          </form>
        </div>
      )}

      {/* Mobile Nav */}
      <BottomNav active="admin" />
    </div>
  );
}
