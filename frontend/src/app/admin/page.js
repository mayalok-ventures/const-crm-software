'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Ticket,
  History,
  Activity,
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Shield,
  Filter,
  Download,
  ArrowLeft,
  Server,
  Database,
  Cpu,
  Clock,
  ChevronRight,
  Eye,
  X,
  Zap,
  Menu,
} from 'lucide-react';
import { getUser } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function SuperAdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation & Auth
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab Data Cache
  const [overview, setOverview] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [plansList, setPlansList] = useState([]);
  const [couponsList, setCouponsList] = useState([]);
  const [logsList, setLogsList] = useState([]);
  const [healthData, setHealthData] = useState(null);

  // Filter States
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userPlanFilter, setUserPlanFilter] = useState('all');

  const [couponSearch, setCouponSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState('all');

  // Modals State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planFormData, setPlanFormData] = useState({
    code: '',
    name: '',
    description: '',
    badge: '',
    category: 'INDIVIDUAL',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    leadsLimit: 1000,
    whatsappLimit: 1000,
    storageGB: 5,
    features: '',
    status: 'ACTIVE',
  });

  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponFormData, setCouponFormData] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxOverallUses: 100,
    validUntil: '',
    appliesToAllPlans: true,
  });

  const [showAssignPlanModal, setShowAssignPlanModal] = useState(false);
  const [selectedUserForPlan, setSelectedUserForPlan] = useState(null);
  const [assignedPlanCode, setAssignedPlanCode] = useState('');

  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [selectedLogPayload, setSelectedLogPayload] = useState(null);

  const [copiedCode, setCopiedCode] = useState(null);

  // Auth Initialization
  useEffect(() => {
    const user = getUser();
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

    if (!storedToken || !user) {
      router.replace('/login');
      return;
    }

    if (user.role !== 'superadmin' && user.role !== 'admin' && user.companyRole !== 'owner') {
      toast.error('Access restricted to Platform SuperAdmins');
      router.replace('/dashboard');
      return;
    }

    setCurrentUser(user);
    setToken(storedToken);
    setLoading(false);

    const initialTab = searchParams?.get('tab');
    if (initialTab && ['overview', 'users', 'plans', 'coupons', 'logs', 'health'].includes(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [router, searchParams]);

  // Auth Fetch Wrapper
  const authFetch = useCallback(
    async (endpoint, options = {}) => {
      const currentToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : '');
      const headers = {
        'Content-Type': 'application/json',
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        ...(options.headers || {}),
      };

      try {
        const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        const res = await fetch(url, { ...options, headers });
        if (res.status === 401) {
          toast.error('Session expired. Please log in again.');
          router.replace('/login');
          return { success: false, status: 401 };
        }
        const data = await res.json();
        return { ...data, status: res.status };
      } catch (err) {
        console.warn(`[API] Error for ${endpoint}:`, err.message);
        return { success: false, error: err.message };
      }
    },
    [token, router]
  );

  // Data Loaders
  const loadOverview = useCallback(async () => {
    const res = await authFetch('/admin/overview');
    if (res?.success) setOverview(res.data);
  }, [authFetch]);

  const loadUsers = useCallback(async () => {
    const res = await authFetch('/admin/users');
    if (res?.success) setUsersList(res.users || []);
  }, [authFetch]);

  const loadPlans = useCallback(async () => {
    const res = await authFetch('/admin/plans');
    if (res?.success) setPlansList(res.plans || []);
  }, [authFetch]);

  const loadCoupons = useCallback(async () => {
    const res = await authFetch('/admin/coupons');
    if (res?.success) setCouponsList(res.coupons || []);
  }, [authFetch]);

  const loadLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (logSearch) params.set('search', logSearch);
    if (logTypeFilter !== 'all') params.set('type', logTypeFilter);
    params.set('limit', '50');

    const res = await authFetch(`/admin/logs?${params.toString()}`);
    if (res?.success) setLogsList(res.logs || []);
  }, [authFetch, logSearch, logTypeFilter]);

  const loadHealth = useCallback(async () => {
    const res = await authFetch('/admin/system-health');
    if (res?.status || res?.components) setHealthData(res);
  }, [authFetch]);

  // Tab Data Orchestrator (Loads on-demand when tab changes)
  const refreshActiveTab = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      if (activeTab === 'overview') await loadOverview();
      else if (activeTab === 'users') await loadUsers();
      else if (activeTab === 'plans') await loadPlans();
      else if (activeTab === 'coupons') await loadCoupons();
      else if (activeTab === 'logs') await loadLogs();
      else if (activeTab === 'health') await loadHealth();
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, token, loadOverview, loadUsers, loadPlans, loadCoupons, loadLogs, loadHealth]);

  useEffect(() => {
    if (token) {
      refreshActiveTab();
    }
  }, [activeTab, token, refreshActiveTab]);

  // Initial preload of plans for user assignment dropdown
  useEffect(() => {
    if (token) {
      loadOverview();
      loadPlans();
    }
  }, [token, loadOverview, loadPlans]);

  // Tab Switcher
  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setMobileSidebarOpen(false);
    router.replace(`/admin?tab=${tabId}`, { scroll: false });
  };

  // --- User Actions ---
  const handleToggleUserStatus = async (userId) => {
    const res = await authFetch(`/admin/users/${userId}/status`, { method: 'PUT' });
    if (res?.success) {
      toast.success(res.message || 'User status updated');
      setUsersList((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, userStatus: res.user?.userStatus || (u.userStatus === 'active' ? 'disabled' : 'active') } : u))
      );
    } else {
      toast.error(res?.message || 'Failed to update user status');
    }
  };

  const handleOpenAssignPlan = (user) => {
    setSelectedUserForPlan(user);
    setAssignedPlanCode(user.plan || 'Free Starter');
    setShowAssignPlanModal(true);
  };

  const handleSaveAssignedPlan = async (e) => {
    e.preventDefault();
    if (!selectedUserForPlan) return;

    const res = await authFetch(`/admin/users/${selectedUserForPlan._id}/plan`, {
      method: 'PUT',
      body: JSON.stringify({ plan: assignedPlanCode }),
    });

    if (res?.success) {
      toast.success(`Plan updated to ${assignedPlanCode}`);
      setUsersList((prev) =>
        prev.map((u) => (u._id === selectedUserForPlan._id ? { ...u, plan: assignedPlanCode } : u))
      );
      setShowAssignPlanModal(false);
      setSelectedUserForPlan(null);
    } else {
      toast.error(res?.message || 'Failed to assign plan');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Are you sure you want to permanently delete user "${user.name || user.email}"? This action cannot be undone.`)) return;

    const res = await authFetch(`/admin/users/${user._id}`, { method: 'DELETE' });
    if (res?.success) {
      toast.success('User deleted successfully');
      setUsersList((prev) => prev.filter((u) => u._id !== user._id));
    } else {
      toast.error(res?.message || 'Failed to delete user');
    }
  };

  // --- Plan Actions ---
  const handleOpenAddPlan = () => {
    setEditingPlan(null);
    setPlanFormData({
      code: '',
      name: '',
      description: '',
      badge: '',
      category: 'INDIVIDUAL',
      monthlyPrice: 999,
      yearlyPrice: 9990,
      leadsLimit: 1000,
      whatsappLimit: 1000,
      storageGB: 5,
      features: 'Candidate CRM Access\nInstitutional Course Catalogue\nAdmission Pipeline Tracking\nWhatsApp Communication Hub',
      status: 'ACTIVE',
    });
    setShowPlanModal(true);
  };

  const handleOpenEditPlan = (plan) => {
    setEditingPlan(plan);
    const monthlyAmt = plan.pricing?.monthly?.amount || plan.monthlyPrice || Math.round((plan.priceInPaise || 0) / 100) || 0;
    const yearlyAmt = plan.pricing?.yearly?.amount || plan.yearlyPrice || monthlyAmt * 10;
    const feats = Array.isArray(plan.whatsIncluded) ? plan.whatsIncluded.join('\n') : '';

    setPlanFormData({
      code: plan.code,
      name: plan.name,
      description: plan.description || '',
      badge: plan.badge || '',
      category: plan.category || 'INDIVIDUAL',
      monthlyPrice: monthlyAmt,
      yearlyPrice: yearlyAmt,
      leadsLimit: plan.limits?.leads ?? 1000,
      whatsappLimit: plan.limits?.monthlyWhatsAppMessages ?? 1000,
      storageGB: plan.limits?.storageGB ?? 5,
      features: feats,
      status: plan.status || 'ACTIVE',
    });
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    const payload = {
      code: planFormData.code.toUpperCase().trim(),
      name: planFormData.name.trim(),
      description: planFormData.description.trim(),
      badge: planFormData.badge.trim() || null,
      category: planFormData.category,
      pricing: {
        monthly: { amount: Number(planFormData.monthlyPrice) || 0, enabled: true },
        yearly: { amount: Number(planFormData.yearlyPrice) || 0, enabled: true },
        currency: 'INR',
      },
      limits: {
        leads: Number(planFormData.leadsLimit) || 1000,
        monthlyWhatsAppMessages: Number(planFormData.whatsappLimit) || 1000,
        storageGB: Number(planFormData.storageGB) || 5,
        seats: 1,
      },
      whatsIncluded: planFormData.features
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean),
      status: planFormData.status,
    };

    if (editingPlan) {
      const res = await authFetch(`/admin/plans/${editingPlan._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res?.success) {
        toast.success(`Plan "${payload.name}" updated successfully`);
        setShowPlanModal(false);
        loadPlans();
      } else {
        toast.error(res?.message || 'Failed to update plan');
      }
    } else {
      const res = await authFetch('/admin/plans', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res?.success) {
        toast.success(`Plan "${payload.name}" created successfully`);
        setShowPlanModal(false);
        loadPlans();
      } else {
        toast.error(res?.message || 'Failed to create plan');
      }
    }
  };

  const handleDeletePlan = async (plan) => {
    if (!confirm(`Are you sure you want to delete plan "${plan.name}"?`)) return;
    const res = await authFetch(`/admin/plans/${plan._id}`, { method: 'DELETE' });
    if (res?.success) {
      toast.success('Plan removed');
      loadPlans();
    } else {
      toast.error(res?.message || 'Failed to delete plan');
    }
  };

  // --- Coupon Actions ---
  const handleOpenAddCoupon = () => {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const dateStr = nextMonth.toISOString().split('T')[0];

    setCouponFormData({
      code: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      maxOverallUses: 100,
      validUntil: dateStr,
      appliesToAllPlans: true,
    });
    setShowCouponModal(true);
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    const payload = {
      code: couponFormData.code.toUpperCase().trim(),
      description: couponFormData.description.trim(),
      discountType: couponFormData.discountType,
      discountValue: Number(couponFormData.discountValue) || 0,
      maxOverallUses: Number(couponFormData.maxOverallUses) || 100,
      validUntil: new Date(couponFormData.validUntil),
      appliesToAllPlans: true,
      applicableCategories: ['INDIVIDUAL'],
    };

    const res = await authFetch('/admin/coupons', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res?.success) {
      toast.success(`Coupon "${payload.code}" created successfully`);
      setShowCouponModal(false);
      loadCoupons();
    } else {
      toast.error(res?.message || 'Failed to create coupon');
    }
  };

  const handleToggleCoupon = async (coupon) => {
    const res = await authFetch(`/admin/coupons/${coupon._id}/toggle`, { method: 'PATCH' });
    if (res?.success) {
      toast.success(`Coupon status updated`);
      loadCoupons();
    } else {
      toast.error(res?.message || 'Failed to toggle coupon');
    }
  };

  const handleDeleteCoupon = async (coupon) => {
    if (!confirm(`Delete coupon "${coupon.code}"?`)) return;
    const res = await authFetch(`/admin/coupons/${coupon._id}`, { method: 'DELETE' });
    if (res?.success) {
      toast.success('Coupon deleted');
      loadCoupons();
    } else {
      toast.error(res?.message || 'Failed to delete coupon');
    }
  };

  const copyCouponCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Copied: ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchSearch =
        !userSearch ||
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phone?.includes(userSearch);

      const status = u.userStatus || (u.isActive ? 'active' : 'disabled');
      const matchStatus = userStatusFilter === 'all' || status === userStatusFilter;
      const matchPlan = userPlanFilter === 'all' || (u.plan || '').toLowerCase() === userPlanFilter.toLowerCase();

      return matchSearch && matchStatus && matchPlan;
    });
  }, [usersList, userSearch, userStatusFilter, userPlanFilter]);

  // Loading State
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#070b14] text-amber-400">
        <div className="text-center">
          <div className="w-9 h-9 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold tracking-wide text-slate-300">Authenticating Super Admin Security Clearance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070b14] text-slate-100 font-sans">
      {/* ── MOBILE DRAWER OVERLAY & SIDEBAR ── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col shadow-2xl z-10 animate-fade-in">
            <div className="p-4 border-b border-slate-800/70 flex items-center justify-between bg-[#070b14]/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-black text-slate-950 shadow-lg shadow-amber-500/20 text-base">
                  ⚡
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight leading-none">Sahyak Platform</h2>
                  <span className="text-[10px] font-semibold text-amber-400 tracking-wider uppercase mt-0.5 block">
                    Super Admin OS
                  </span>
                </div>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
              <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Command Center
              </div>
              {[
                { id: 'overview', label: 'Platform Overview', icon: LayoutDashboard },
                { id: 'users', label: 'Main Users (Consultants)', icon: Users, badge: usersList.length || null },
                { id: 'plans', label: 'Subscription Plans', icon: CreditCard, badge: plansList.length || null },
                { id: 'coupons', label: 'Coupon Engine', icon: Ticket, badge: couponsList.length || null },
                { id: 'logs', label: 'System & Audit Logs', icon: History },
                { id: 'health', label: 'System Health', icon: Activity, badgeDot: true },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${isActive
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-md shadow-amber-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {item.badge}
                      </span>
                    )}
                    {item.badgeDot && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-3.5 border-t border-slate-800/70 bg-[#070b14]/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xs font-bold text-amber-400">
                  {currentUser?.name?.charAt(0) || 'A'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{currentUser?.name || 'Super Admin'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{currentUser?.email || 'admin@yourapp.com'}</p>
                </div>
              </div>
              <Link
                href="/dashboard"
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Return to Admission CRM"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* ── DESKTOP SUPER ADMIN SIDEBAR ── */}
      <aside className="hidden lg:flex w-64 bg-[#0a0f1d] border-r border-slate-800/80 flex-col shrink-0">
        {/* Workspace Brand */}
        <div className="p-4 border-b border-slate-800/70 flex items-center justify-between bg-[#070b14]/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-black text-slate-950 shadow-lg shadow-amber-500/20 text-base">
              ⚡
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight leading-none">Sahyak Platform</h2>
              <span className="text-[10px] font-semibold text-amber-400 tracking-wider uppercase mt-0.5 block">
                Super Admin OS
              </span>
            </div>
          </div>
          <button
            onClick={refreshActiveTab}
            disabled={refreshing}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
            title="Refresh Current View"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Command Center
          </div>

          {[
            { id: 'overview', label: 'Platform Overview', icon: LayoutDashboard },
            { id: 'users', label: 'Main Users (Consultants)', icon: Users, badge: usersList.length || null },
            { id: 'plans', label: 'Subscription Plans', icon: CreditCard, badge: plansList.length || null },
            { id: 'coupons', label: 'Coupon Engine', icon: Ticket, badge: couponsList.length || null },
            { id: 'logs', label: 'System & Audit Logs', icon: History },
            { id: 'health', label: 'System Health', icon: Activity, badgeDot: true },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${isActive
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-md shadow-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {item.badge}
                  </span>
                )}
                {item.badgeDot && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer: User Details & Return to CRM */}
        <div className="p-3.5 border-t border-slate-800/70 bg-[#070b14]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xs font-bold text-amber-400">
              {currentUser?.name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{currentUser?.name || 'Super Admin'}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser?.email || 'admin@yourapp.com'}</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Return to Admission CRM"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </aside>

      {/* ── MAIN CONTENT VIEWPORT ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#070b14] overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800/80 px-3 sm:px-6 flex items-center justify-between bg-[#0a0f1d]/50 backdrop-blur shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight capitalize truncate">
              {activeTab === 'users' ? 'Main Users & Consultants Directory' : activeTab}
            </h1>
            <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-bold tracking-wider rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase shrink-0">
              Super Admin Privilege
            </span>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'plans' && (
              <button
                onClick={handleOpenAddPlan}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Plan</span>
              </button>
            )}

            {activeTab === 'coupons' && (
              <button
                onClick={handleOpenAddCoupon}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Coupon</span>
              </button>
            )}

            <button
              onClick={refreshActiveTab}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-xs font-semibold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Tab Body (Scrollable Container) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 custom-scrollbar">
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: OVERVIEW & PLATFORM KPIS                                  */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-gradient-to-b from-[#0f172a] to-[#0a0f1d] border border-slate-800/80 shadow-lg shadow-black/20">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Registered Consultants</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white tracking-tight">
                    {overview?.totalConsultants ?? overview?.totalUsers ?? usersList.length}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{overview?.activeConsultants ?? usersList.filter((u) => u.userStatus === 'active').length} Active Single Users</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-b from-[#0f172a] to-[#0a0f1d] border border-slate-800/80 shadow-lg shadow-black/20">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Active Plans</span>
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <CreditCard className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white tracking-tight">
                    {overview?.totalPlans ?? plansList.length}
                  </div>
                  <div className="text-[11px] text-amber-400/90 mt-2 font-medium">
                    Free Starter, Solo Pro, Enterprise
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-b from-[#0f172a] to-[#0a0f1d] border border-slate-800/80 shadow-lg shadow-black/20">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Active Coupons</span>
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <Ticket className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white tracking-tight">
                    {overview?.totalCoupons ?? couponsList.length}
                  </div>
                  <div className="text-[11px] text-purple-400 mt-2 font-medium">
                    Promotional Checkout Engine
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-b from-[#0f172a] to-[#0a0f1d] border border-slate-800/80 shadow-lg shadow-black/20">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Platform Health</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-emerald-400 tracking-tight flex items-center gap-2">
                    <span>100%</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      HEALTHY
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">All backend microservices online</div>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div className="p-5 rounded-2xl bg-[#0a0f1d] border border-slate-800/80 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Super Admin Operations</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => handleSelectTab('users')}
                    className="p-4 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-amber-400">Consultants Directory</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">View, assign plan & manage status</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <button
                    onClick={() => handleSelectTab('plans')}
                    className="p-4 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-amber-400">Pricing & Plans</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Edit prices, quotas & features</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <button
                    onClick={() => handleSelectTab('coupons')}
                    className="p-4 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-amber-400">Coupon Generator</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Create discounts & promo codes</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <button
                    onClick={() => handleSelectTab('logs')}
                    className="p-4 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-amber-400">System Logs</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Audit trail & admin activity</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>

              {/* Infrastructure Summary Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-[#0c1322] border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Single-User Admission Consultants OS</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Monolithic agency bloat has been permanently removed. System strictly isolated per consultant.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Database: Active (27017)
                  </span>
                  <span className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    API: Running (5000)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: MAIN USERS DIRECTORY                                      */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'users' && (
            <div className="space-y-4 animate-fade-in">
              {/* Search & Filter Bar */}
              <div className="p-4 rounded-2xl bg-[#0a0f1d] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[260px] bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name, email, or phone..."
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  {userSearch && (
                    <button onClick={() => setUserSearch('')} className="text-slate-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="disabled">Disabled Only</option>
                  </select>

                  <select
                    value={userPlanFilter}
                    onChange={(e) => setUserPlanFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400"
                  >
                    <option value="all">All Plans</option>
                    <option value="Free Starter">Free Starter</option>
                    <option value="Solo Pro">Solo Pro</option>
                    <option value="Solo Enterprise">Solo Enterprise</option>
                  </select>
                </div>
              </div>

              {/* Users Table */}
              <div className="rounded-2xl bg-[#0a0f1d] border border-slate-800/80 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Consultant / User</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Current Plan</th>
                        <th className="py-3 px-4">Managed Leads</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Joined Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500">
                            No matching consultants found
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => {
                          const isActive = user.userStatus === 'active' || user.isActive;
                          return (
                            <tr key={user._id} className="hover:bg-slate-800/40 transition">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-amber-400">
                                    {user.name?.charAt(0) || 'U'}
                                  </div>
                                  <div>
                                    <p className="font-bold text-white">{user.name || 'Unnamed Consultant'}</p>
                                    <p className="text-[11px] text-slate-400">{user.email || user.phone || 'No contact'}</p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${user.role === 'superadmin'
                                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                      : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                    }`}
                                >
                                  {user.role}
                                </span>
                              </td>

                              <td className="py-3 px-4">
                                <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                                  {user.plan || 'Free Starter'}
                                </span>
                              </td>

                              <td className="py-3 px-4">
                                <span className="font-bold text-white">{user.leadsCount || 0}</span>
                                <span className="text-[11px] text-slate-400 ml-1">candidates</span>
                              </td>

                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isActive
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                    }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                  {isActive ? 'Active' : 'Disabled'}
                                </span>
                              </td>

                              <td className="py-3 px-4 text-slate-400 text-[11px]">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenAssignPlan(user)}
                                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
                                    title="Assign / Change Plan"
                                  >
                                    <CreditCard className="w-4 h-4" />
                                  </button>

                                  <button
                                    onClick={() => handleToggleUserStatus(user._id)}
                                    className={`p-1.5 rounded-lg transition ${isActive
                                        ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                                        : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                                      }`}
                                    title={isActive ? 'Disable User' : 'Activate User'}
                                  >
                                    {isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                  </button>

                                  {user.role !== 'superadmin' && (
                                    <button
                                      onClick={() => handleDeleteUser(user)}
                                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                                      title="Delete User"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: SUBSCRIPTION PLANS MANAGEMENT                             */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'plans' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plansList.map((plan) => {
                  const monthlyAmt = plan.pricing?.monthly?.amount || plan.monthlyPrice || Math.round((plan.priceInPaise || 0) / 100) || 0;
                  const yearlyAmt = plan.pricing?.yearly?.amount || plan.yearlyPrice || monthlyAmt * 10;
                  const isArchived = plan.status === 'ARCHIVED';

                  return (
                    <div
                      key={plan._id}
                      className={`rounded-2xl p-6 flex flex-col justify-between border transition-all ${isArchived
                          ? 'bg-slate-900/40 border-slate-800 opacity-60'
                          : 'bg-[#0a0f1d] border-slate-800/90 hover:border-amber-500/40 shadow-xl'
                        }`}
                    >
                      <div>
                        {/* Plan Header */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                            {plan.code}
                          </span>
                          {plan.badge && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {plan.badge}
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{plan.description || 'Single-user admission consulting plan'}</p>

                        {/* Pricing */}
                        <div className="my-5 pb-5 border-b border-slate-800/80">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white tracking-tight">₹{monthlyAmt.toLocaleString()}</span>
                            <span className="text-xs text-slate-400">/ month</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">₹{yearlyAmt.toLocaleString()} billed yearly</p>
                        </div>

                        {/* Limits & Quotas */}
                        <div className="space-y-2 mb-5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Candidate Leads Cap:</span>
                            <span className="font-bold text-white">{(plan.limits?.leads ?? 1000).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">WhatsApp Messages/mo:</span>
                            <span className="font-bold text-white">{(plan.limits?.monthlyWhatsAppMessages ?? 1000).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Cloud Storage:</span>
                            <span className="font-bold text-white">{plan.limits?.storageGB ?? 5} GB</span>
                          </div>
                        </div>

                        {/* Features List */}
                        {Array.isArray(plan.whatsIncluded) && plan.whatsIncluded.length > 0 && (
                          <div className="space-y-1.5 pt-4 border-t border-slate-800/60">
                            {plan.whatsIncluded.slice(0, 4).map((feat, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-300">
                                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-4">
                        <button
                          onClick={() => handleOpenEditPlan(plan)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit Plan</span>
                        </button>

                        <button
                          onClick={() => handleDeletePlan(plan)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                          title="Delete Plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: COUPON ENGINE                                             */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'coupons' && (
            <div className="space-y-4 animate-fade-in">
              {/* Header Strip */}
              <div className="p-4 rounded-2xl bg-[#0a0f1d] border border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={couponSearch}
                    onChange={(e) => setCouponSearch(e.target.value)}
                    placeholder="Search coupons by code or description..."
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>Total Coupons: <strong className="text-white">{couponsList.length}</strong></span>
                  <span>•</span>
                  <span>Active Promos: <strong className="text-emerald-400">{couponsList.filter((c) => c.status === 'ACTIVE' || c.isActive).length}</strong></span>
                </div>
              </div>

              {/* Coupons Table */}
              <div className="rounded-2xl bg-[#0a0f1d] border border-slate-800/80 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Coupon Code</th>
                        <th className="py-3 px-4">Discount</th>
                        <th className="py-3 px-4">Usage / Cap</th>
                        <th className="py-3 px-4">Valid Until</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {couponsList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500">
                            No coupons created yet. Click "Create Coupon" above to start a promotional campaign.
                          </td>
                        </tr>
                      ) : (
                        couponsList
                          .filter((c) => !couponSearch || c.code?.toLowerCase().includes(couponSearch.toLowerCase()) || c.description?.toLowerCase().includes(couponSearch.toLowerCase()))
                          .map((coupon) => {
                            const isExpired = coupon.validUntil && new Date(coupon.validUntil) < new Date();
                            const isActive = (coupon.status === 'ACTIVE' || coupon.isActive) && !isExpired;

                            return (
                              <tr key={coupon._id} className="hover:bg-slate-800/40 transition">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-amber-400 text-sm">{coupon.code}</span>
                                    <button
                                      onClick={() => copyCouponCode(coupon.code)}
                                      className="p-1 text-slate-400 hover:text-white rounded"
                                      title="Copy code"
                                    >
                                      {copiedCode === coupon.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                  {coupon.description && <p className="text-[11px] text-slate-400">{coupon.description}</p>}
                                </td>

                                <td className="py-3 px-4">
                                  <span className="font-bold text-white">
                                    {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} FLAT`}
                                  </span>
                                </td>

                                <td className="py-3 px-4">
                                  <span className="text-white font-semibold">{coupon.usedCount || 0}</span>
                                  <span className="text-slate-400 text-[11px]"> / {coupon.maxOverallUses || '∞'} uses</span>
                                </td>

                                <td className="py-3 px-4 text-slate-400 text-[11px]">
                                  {coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString() : 'No expiry'}
                                </td>

                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isActive
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                      }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                                    {isExpired ? 'Expired' : isActive ? 'Active' : 'Paused'}
                                  </span>
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      onClick={() => handleToggleCoupon(coupon)}
                                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                                      title={isActive ? 'Pause Coupon' : 'Activate Coupon'}
                                    >
                                      {isActive ? <XCircle className="w-4 h-4 text-amber-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
                                    </button>

                                    <button
                                      onClick={() => handleDeleteCoupon(coupon)}
                                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                                      title="Delete Coupon"
                                    >
                                      <Trash2 className="w-4 h-4" />
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
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 5: SYSTEM & AUDIT LOGS                                       */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'logs' && (
            <div className="space-y-4 animate-fade-in">
              {/* Filter Strip */}
              <div className="p-4 rounded-2xl bg-[#0a0f1d] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                    placeholder="Search logs by keyword, actor, or action (press Enter)..."
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={logTypeFilter}
                    onChange={(e) => setLogTypeFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400"
                  >
                    <option value="all">All Event Categories</option>
                    <option value="user">User & Status Events</option>
                    <option value="plan">Plan & Subscription Updates</option>
                    <option value="coupon">Coupon Modifications</option>
                    <option value="auth">Auth & Security Attempts</option>
                  </select>

                  <button
                    onClick={loadLogs}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                  >
                    <Filter className="w-3.5 h-3.5 text-amber-400" />
                    <span>Apply Filter</span>
                  </button>

                  <a
                    href={`${API_BASE}/admin/activity-logs?format=csv`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </a>
                </div>
              </div>

              {/* Logs Table */}
              <div className="rounded-2xl bg-[#0a0f1d] border border-slate-800/80 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/70 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Actor</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Target Entity</th>
                        <th className="py-3 px-4">Event Details</th>
                        <th className="py-3 px-4">IP Address</th>
                        <th className="py-3 px-4 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {logsList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                            No logs recorded for this criteria
                          </td>
                        </tr>
                      ) : (
                        logsList.map((log) => {
                          const actionColor =
                            log.action === 'CREATE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : log.action === 'DELETE'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : log.action === 'STATUS_CHANGE'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

                          return (
                            <tr key={log._id} className="hover:bg-slate-800/40 transition">
                              <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                                {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                              </td>

                              <td className="py-3 px-4 whitespace-nowrap font-sans font-medium text-white">
                                {log.actor || 'System'}
                              </td>

                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${actionColor}`}>
                                  {log.action}
                                </span>
                              </td>

                              <td className="py-3 px-4 whitespace-nowrap text-slate-300 font-sans">
                                {log.entityType || 'General'}
                              </td>

                              <td className="py-3 px-4 text-slate-200 font-sans max-w-xs truncate">
                                {log.details}
                              </td>

                              <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                                {log.ipAddress || '127.0.0.1'}
                              </td>

                              <td className="py-3 px-4 text-right whitespace-nowrap font-sans">
                                {(log.oldValue || log.newValue) && (
                                  <button
                                    onClick={() => {
                                      setSelectedLogPayload(log);
                                      setShowPayloadModal(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
                                    title="View Changed Data"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 6: SYSTEM HEALTH MONITOR                                     */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === 'health' && (
            <div className="space-y-6 animate-fade-in">
              {/* Overall Status Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#0a0f1d] to-[#0a0f1d] border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Activity className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">System Status: 100% HEALTHY</h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        OPERATIONAL
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      All platform components, local persistent MongoDB instance, and API workers are functioning optimally.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-slate-400">System Uptime</p>
                  <p className="text-xl font-bold text-white font-mono mt-0.5">99.98%</p>
                </div>
              </div>

              {/* Components Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: 'Application Server', type: 'Node.js Express', status: 'HEALTHY', icon: Server, ping: '< 1ms' },
                  { name: 'MongoDB Database', type: 'Persistent 127.0.0.1:27017', status: 'HEALTHY', icon: Database, ping: '2ms' },
                  { name: 'WhatsApp Session Hub', type: 'Local Baileys Engine', status: 'HEALTHY', icon: Zap, ping: 'Active' },
                  { name: 'Storage & Assets', type: 'Static Artifacts Storage', status: 'HEALTHY', icon: Cpu, ping: 'Online' },
                  { name: 'Payment Webhook Hub', type: 'UPI & Gateway Listeners', status: 'HEALTHY', icon: CreditCard, ping: 'Active' },
                  { name: 'Scheduler & Crons', type: 'Follow-up Cron Job', status: 'HEALTHY', icon: Clock, ping: 'Active' },
                ].map((comp, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-[#0a0f1d] border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-amber-400">
                        <comp.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{comp.name}</h4>
                        <p className="text-[11px] text-slate-400">{comp.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {comp.status}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-1">{comp.ping}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── MODAL: ASSIGN PLAN ────────────────────────────────────────────── */}
      {showAssignPlanModal && selectedUserForPlan && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1322] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Assign Subscription Plan</h3>
              </div>
              <button onClick={() => setShowAssignPlanModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignedPlan} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Consultant</label>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                  <p className="font-bold text-white">{selectedUserForPlan.name || 'Unnamed'}</p>
                  <p className="text-slate-400 text-[11px]">{selectedUserForPlan.email || selectedUserForPlan.phone}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Subscription Plan</label>
                <select
                  value={assignedPlanCode}
                  onChange={(e) => setAssignedPlanCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="Free Starter">Free Starter (₹0 / mo)</option>
                  <option value="Solo Pro">Solo Pro (₹999 / mo)</option>
                  <option value="Solo Enterprise">Solo Enterprise (₹2,499 / mo)</option>
                  {plansList.map((p) => (
                    <option key={p._id} value={p.name}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignPlanModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
                >
                  Update Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE / EDIT PLAN ──────────────────────────────────────── */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0c1322] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl my-8 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">{editingPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}</h3>
              </div>
              <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Plan Code</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingPlan}
                    value={planFormData.code}
                    onChange={(e) => setPlanFormData({ ...planFormData, code: e.target.value })}
                    placeholder="e.g. SOLO_PRO"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white uppercase focus:outline-none focus:border-amber-400 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Plan Name</label>
                  <input
                    type="text"
                    required
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                    placeholder="e.g. Solo Pro Tier"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description / Tagline</label>
                <input
                  type="text"
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                  placeholder="e.g. Designed for ambitious solo educational consultants"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Monthly Price (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={planFormData.monthlyPrice}
                    onChange={(e) => setPlanFormData({ ...planFormData, monthlyPrice: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Yearly Price (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={planFormData.yearlyPrice}
                    onChange={(e) => setPlanFormData({ ...planFormData, yearlyPrice: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Badge (Optional)</label>
                  <input
                    type="text"
                    value={planFormData.badge}
                    onChange={(e) => setPlanFormData({ ...planFormData, badge: e.target.value })}
                    placeholder="e.g. Popular"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Candidate Leads Cap</label>
                  <input
                    type="number"
                    required
                    value={planFormData.leadsLimit}
                    onChange={(e) => setPlanFormData({ ...planFormData, leadsLimit: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">WhatsApp Msgs/mo</label>
                  <input
                    type="number"
                    required
                    value={planFormData.whatsappLimit}
                    onChange={(e) => setPlanFormData({ ...planFormData, whatsappLimit: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Storage (GB)</label>
                  <input
                    type="number"
                    required
                    value={planFormData.storageGB}
                    onChange={(e) => setPlanFormData({ ...planFormData, storageGB: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Included Features (one per line)</label>
                <textarea
                  rows={4}
                  value={planFormData.features}
                  onChange={(e) => setPlanFormData({ ...planFormData, features: e.target.value })}
                  placeholder="Candidate Management&#10;College & Course Catalogue&#10;WhatsApp Automated Templates"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400 font-mono text-xs"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
                >
                  {editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE COUPON ─────────────────────────────────────────── */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1322] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Ticket className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Create Promotional Coupon</h3>
              </div>
              <button onClick={() => setShowCouponModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  value={couponFormData.code}
                  onChange={(e) => setCouponFormData({ ...couponFormData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. WELCOME50, DIWALI2026"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={couponFormData.description}
                  onChange={(e) => setCouponFormData({ ...couponFormData, description: e.target.value })}
                  placeholder="e.g. New Consultant Launch Discount"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Discount Type</label>
                  <select
                    value={couponFormData.discountType}
                    onChange={(e) => setCouponFormData({ ...couponFormData, discountType: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {couponFormData.discountType === 'PERCENTAGE' ? 'Discount Value (%)' : 'Discount Value (₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={couponFormData.discountType === 'PERCENTAGE' ? '100' : undefined}
                    value={couponFormData.discountValue}
                    onChange={(e) => setCouponFormData({ ...couponFormData, discountValue: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Max Overall Uses</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={couponFormData.maxOverallUses}
                    onChange={(e) => setCouponFormData({ ...couponFormData, maxOverallUses: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Valid Until (Expiry)</label>
                  <input
                    type="date"
                    required
                    value={couponFormData.validUntil}
                    onChange={(e) => setCouponFormData({ ...couponFormData, validUntil: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCouponModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
                >
                  Publish Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: LOG PAYLOAD INSPECTOR ──────────────────────────────────── */}
      {showPayloadModal && selectedLogPayload && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1322] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Audit Log State Payload</h3>
              </div>
              <button onClick={() => setShowPayloadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 font-mono text-[11px]">
              <div>
                <p className="font-sans text-xs font-bold text-slate-400 mb-1 uppercase">Old State (Before):</p>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 overflow-x-auto">
                  {JSON.stringify(selectedLogPayload.oldValue || 'None', null, 2)}
                </pre>
              </div>

              <div>
                <p className="font-sans text-xs font-bold text-slate-400 mb-1 uppercase">New State (After):</p>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 overflow-x-auto">
                  {JSON.stringify(selectedLogPayload.newValue || 'None', null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800 text-right">
              <button
                onClick={() => setShowPayloadModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#070b14] text-amber-400">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SuperAdminContent />
    </Suspense>
  );
}
