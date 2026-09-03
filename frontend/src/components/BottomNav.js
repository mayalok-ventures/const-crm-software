'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  getUser,
  isSuperAdmin,
  isOwner,
  isManager,
  isAgent,
  isRealEstateTenant,
  getUserRole,
  clearAuth,
} from '@/lib/auth';
import api from '@/lib/api';
import {
  Home, FileText, Users, BarChart2, User, MessageCircle, MoreHorizontal, Grid, X as CloseIcon,
  Package, Send, Zap, Shield, Crown, GraduationCap,
  ChevronLeft, ChevronRight, Building2, Calendar, TrendingUp,
  Award, MapPin, ChevronDown, Sliders, Bell, DollarSign,
  Percent, CheckSquare, Layers, LogOut
} from 'lucide-react';
import PlanStatusWidget from '@/components/PlanStatusWidget';

function BottomNavContent({ active }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams?.get('tab') || null;
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSuper, setIsSuper] = useState(false);
  const [isTenantOwner, setIsTenantOwner] = useState(false);
  const [isTenantManager, setIsTenantManager] = useState(false);
  const [isTenantAgent, setIsTenantAgent] = useState(false);
  const [isEducation, setIsEducation] = useState(false);
  const [isRealEstate, setIsRealEstate] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const [profileHref, setProfileHref] = useState('/profile');
  const [generalControlsExpanded, setGeneralControlsExpanded] = useState(false);
  const [leadsExpanded, setLeadsExpanded] = useState(false);

  const handleLogout = () => {
    clearAuth();
    router.replace('/login');
  };

  useEffect(() => {
    const fetchOverdueBadge = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await api.get('/leads/follow-ups/due');
        if (Array.isArray(res.data)) {
          setOverdueCount(res.data.length);
        }
      } catch (e) {}
    };
    fetchOverdueBadge();
    const iv = setInterval(fetchOverdueBadge, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchUnread = async () => {
      try {
        const res = await api.get('/notifications');
        if (mounted) {
          setUnreadCount(res.data?.unreadCount || 0);
        }
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [pathname]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved) setIsCollapsed(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isCollapsed) {
        document.body.classList.add('sidebar-collapsed');
      } else {
        document.body.classList.remove('sidebar-collapsed');
      }
    }
  }, [isCollapsed]);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    const localUser = getUser();
    setUser(localUser);

    const superAdminCheck = isSuperAdmin(localUser);
    const ownerCheck = isOwner(localUser);
    const managerCheck = isManager(localUser);
    const agentCheck = isAgent(localUser);
    const realEstateCheck = isRealEstateTenant(localUser);

    setIsSuper(superAdminCheck);
    setIsTenantOwner(ownerCheck);
    setIsTenantManager(managerCheck);
    setIsTenantAgent(agentCheck);
    setIsRealEstate(realEstateCheck);

    if (superAdminCheck) {
      setProfileHref('/superadmin-dashboard');
    } else {
      setProfileHref('/profile');
    }

    if (String(localUser?.industryType || '').trim().toLowerCase() === 'education') {
      setIsEducation(true);
    }
  }, []);

  const normalize = (p) => (p || '').replace(/\/$/, '').toLowerCase();

  const isLinkActive = (key, href) => {
    if (active === key) return true;
    if (!pathname) return false;
    const normPath = normalize(pathname);
    const [pathPart, queryPart] = (href || '').split('?');
    const normHref = normalize(pathPart);

    if (normPath !== normHref) return false;

    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      const tabParam = params.get('tab');
      if (tabParam) {
        return currentTab === tabParam;
      }
    } else if (normPath === '/dashboard') {
      return !currentTab || currentTab === 'overview';
    }

    return true;
  };

  // Resolve Organization Identity for Branding
  const orgName =
    user?.companyInfo?.companyName ||
    user?.companyId?.companyInfo?.companyName ||
    user?.companyId?.name ||
    (isTenantOwner || isSuper ? (user?.name ? `${user.name}'s Org` : 'Organization') : 'Organization');

  const orgLogo =
    user?.companyInfo?.companyLogo ||
    user?.companyId?.companyInfo?.companyLogo ||
    null;

  const orgInitial = (orgName || 'O').trim().charAt(0).toUpperCase();

  // Mobile Bottom Nav for Agents
  const agentMobileItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home, key: 'dashboard' },
    { href: '/leads', label: 'Leads', icon: Users, key: 'leads' },
    { href: '/follow-ups', label: 'Follow-ups', icon: Calendar, key: 'follow_ups' },
    { href: '/whatsapp', label: 'Inbox', icon: MessageCircle, key: 'whatsapp' },
    { href: '/profile', label: 'Profile', icon: User, key: 'profile' },
  ];

  // Mobile Bottom Nav for Real Estate Managers
  const realEstateManagerMobileItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home, key: 'dashboard' },
    { href: '/leads?tab=team_leads', label: 'Leads', icon: Users, key: 'leads' },
    { href: '/site-visits', label: 'Visits', icon: MapPin, key: 'site_visits' },
    { href: '/pipeline', label: 'Pipeline', icon: TrendingUp, key: 'pipeline' },
    { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, key: 'whatsapp' },
    { href: '/profile', label: 'Profile', icon: User, key: 'profile' },
  ];

  // Mobile Bottom Nav for Generic Managers
  const genericManagerMobileItems = [
    { href: '/dashboard', label: 'Leads', icon: Home, key: 'dashboard' },
    { href: '/whatsapp', label: 'Inbox', icon: MessageCircle, key: 'whatsapp' },
    isEducation
      ? { href: '/catalogue', label: 'Colleges', icon: GraduationCap, key: 'catalogue' }
      : { href: '/projects', label: 'Catalogue', icon: Package, key: 'projects' },
    { href: '/analytics', label: 'Analytics', icon: BarChart2, key: 'analytics' },
    { href: '/profile', label: 'Profile', icon: User, key: 'profile' },
  ];

  // Mobile Bottom Nav for Owners
  const ownerMobileItems = [
    { href: '/dashboard', label: 'Leads', icon: Home, key: 'dashboard' },
    { href: '/integrations', label: 'Ads & APIs', icon: Zap, key: 'integrations' },
    isEducation
      ? { href: '/catalogue', label: 'Colleges', icon: GraduationCap, key: 'catalogue' }
      : { href: '/projects', label: 'Catalogue', icon: Package, key: 'projects' },
    { href: '/whatsapp', label: 'Inbox', icon: MessageCircle, key: 'whatsapp' },
    { href: profileHref, label: 'Profile', icon: User, key: 'profile' },
  ];

  // Generic Manager Desktop Navigation (Non-Real-Estate)
  const genericManagerDesktopItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home, key: 'dashboard' },
    { href: '/leads', label: 'Leads Pipeline', icon: Users, key: 'leads' },
    ...(isEducation
      ? [{ href: '/catalogue', label: 'Colleges & Courses', icon: GraduationCap, key: 'catalogue' }]
      : [{ href: '/projects', label: 'Products & Packages', icon: Package, key: 'projects' }]),
    { href: '/whatsapp', label: 'WhatsApp Hub', icon: MessageCircle, key: 'whatsapp' },
    { href: '/campaigns', label: 'Broadcast Campaigns', icon: Send, key: 'campaigns' },
    { href: '/templates', label: 'Message Templates', icon: FileText, key: 'templates' },
    { href: '/groups', label: 'Audience Groups', icon: Users, key: 'groups' },
    { href: '/analytics', label: 'Sales Analytics', icon: BarChart2, key: 'analytics' },
    { href: '/notifications', label: 'Notifications', icon: Bell, key: 'notifications', badge: unreadCount },
    { href: '/profile', label: 'Profile', icon: User, key: 'profile' },
  ];

  // Owner Desktop Navigation
  const ownerDesktopItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home, key: 'dashboard' },
    { href: '/leads', label: 'Leads Pipeline', icon: Users, key: 'leads' },
    ...(isEducation
      ? [{ href: '/catalogue', label: 'Colleges & Courses', icon: GraduationCap, key: 'catalogue' }]
      : [{ href: '/projects', label: 'Products & Packages', icon: Package, key: 'projects' }]),
    { href: '/integrations', label: 'Ads & Lead Integrations', icon: Zap, key: 'integrations' },
    { href: '/whatsapp', label: 'WhatsApp Hub', icon: MessageCircle, key: 'whatsapp' },
    { href: '/campaigns', label: 'Broadcast Campaigns', icon: Send, key: 'campaigns' },
    { href: '/templates', label: 'Message Templates', icon: FileText, key: 'templates' },
    { href: '/groups', label: 'Audience Groups', icon: Users, key: 'groups' },
    { href: '/analytics', label: 'Sales Analytics', icon: BarChart2, key: 'analytics' },
    { href: '/notifications', label: 'Notifications', icon: Bell, key: 'notifications', badge: unreadCount },
    { href: profileHref, label: 'Organization & Profile', icon: User, key: 'profile' },
  ];

  const mobileItems = isTenantAgent
    ? agentMobileItems
    : isTenantManager
    ? (isRealEstate ? realEstateManagerMobileItems : genericManagerMobileItems)
    : ownerMobileItems;

  return (
    <>
      {/* Mobile Bottom Navigation (Unified 5-Anchor Real Estate Action Bar) */}
      <nav className="bottom-nav flex md:hidden" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(3.75rem + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        zIndex: 8000,
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.04)'
      }}>
        {/* 1. Home */}
        <Link
          href="/dashboard"
          className={`bottom-nav-link ${isLinkActive('dashboard', '/dashboard') ? 'active' : ''}`}
          onClick={() => setIsMoreDrawerOpen(false)}
          style={{ minHeight: 48, minWidth: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none', color: isLinkActive('dashboard', '/dashboard') ? '#4f46e5' : '#64748b' }}
        >
          <Home size={19} />
          <span style={{ fontSize: 10.5, fontWeight: isLinkActive('dashboard', '/dashboard') ? 700 : 500 }}>Home</span>
        </Link>

        {/* 2. Leads */}
        <Link
          href="/leads"
          className={`bottom-nav-link ${isLinkActive('leads', '/leads') ? 'active' : ''}`}
          onClick={() => setIsMoreDrawerOpen(false)}
          style={{ minHeight: 48, minWidth: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none', color: isLinkActive('leads', '/leads') ? '#4f46e5' : '#64748b' }}
        >
          <Users size={19} />
          <span style={{ fontSize: 10.5, fontWeight: isLinkActive('leads', '/leads') ? 700 : 500 }}>Leads</span>
        </Link>

        {/* 3. Follow-ups (with dynamic overdue alarm badge) */}
        <Link
          href="/follow-ups"
          className={`bottom-nav-link ${isLinkActive('follow_ups', '/follow-ups') ? 'active' : ''}`}
          onClick={() => setIsMoreDrawerOpen(false)}
          style={{ minHeight: 48, minWidth: 48, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none', color: isLinkActive('follow_ups', '/follow-ups') ? '#4f46e5' : '#64748b' }}
        >
          <Calendar size={19} />
          <span style={{ fontSize: 10.5, fontWeight: isLinkActive('follow_ups', '/follow-ups') ? 700 : 500 }}>Follow-ups</span>
          {overdueCount > 0 && (
            <span style={{
              position: 'absolute',
              top: 4,
              right: '24%',
              background: '#e11d48',
              color: '#ffffff',
              fontSize: 9,
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: 9999,
              lineHeight: 1.2,
              animation: 'pulse 2s infinite'
            }}>
              {overdueCount}
            </span>
          )}
        </Link>

        {/* 4. WhatsApp */}
        <Link
          href="/whatsapp"
          className={`bottom-nav-link ${isLinkActive('whatsapp', '/whatsapp') ? 'active' : ''}`}
          onClick={() => setIsMoreDrawerOpen(false)}
          style={{ minHeight: 48, minWidth: 48, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none', color: isLinkActive('whatsapp', '/whatsapp') ? '#4f46e5' : '#64748b' }}
        >
          <MessageCircle size={19} />
          <span style={{ fontSize: 10.5, fontWeight: isLinkActive('whatsapp', '/whatsapp') ? 700 : 500 }}>WhatsApp</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: 4,
              right: '24%',
              background: '#22c55e',
              color: '#ffffff',
              fontSize: 9,
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: 9999,
              lineHeight: 1.2
            }}>
              {unreadCount}
            </span>
          )}
        </Link>

        {/* 5. More (Workspaces & Settings Sheet Trigger) */}
        <button
          type="button"
          onClick={() => setIsMoreDrawerOpen(!isMoreDrawerOpen)}
          className={`bottom-nav-link ${isMoreDrawerOpen ? 'active' : ''}`}
          style={{
            minHeight: 48,
            minWidth: 48,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            color: isMoreDrawerOpen ? '#4f46e5' : '#64748b',
            padding: 0
          }}
          aria-label="More Workspaces and Settings"
        >
          <MoreHorizontal size={19} />
          <span style={{ fontSize: 10.5, fontWeight: isMoreDrawerOpen ? 700 : 500 }}>More</span>
        </button>
      </nav>

      {/* Mobile More Workspaces Slide-Up Drawer */}
      {isMoreDrawerOpen && (
        <div
          className="fixed inset-0 z-[9500] bg-slate-950/70 backdrop-blur-sm flex flex-col justify-end md:hidden animate-fade-in"
          onClick={() => setIsMoreDrawerOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl max-h-[82vh] overflow-y-auto p-5 animate-slide-up pb-mobile-sheet"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Grid size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 m-0">All Workspaces</h3>
                  <p className="text-[11px] text-slate-500 m-0">{orgName} • {isTenantAgent ? 'Agent' : isTenantManager ? 'Manager' : 'Owner'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Category 1: Real Estate Sales Operations */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Sales Operations
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/site-visits"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <MapPin size={16} className="text-indigo-600 shrink-0" />
                    <span>Site Visits</span>
                  </Link>

                  <Link
                    href="/pipeline"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <TrendingUp size={16} className="text-indigo-600 shrink-0" />
                    <span>Deals Pipeline</span>
                  </Link>

                  <Link
                    href="/projects"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <Building2 size={16} className="text-indigo-600 shrink-0" />
                    <span>Projects & Units</span>
                  </Link>

                  <Link
                    href="/commission"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <Percent size={16} className="text-emerald-600 shrink-0" />
                    <span>Commissions</span>
                  </Link>
                </div>
              </div>

              {/* Category 2: Marketing & Comms */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Marketing & Integrations
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/campaigns"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <Send size={16} className="text-violet-600 shrink-0" />
                    <span>Broadcasts</span>
                  </Link>

                  <Link
                    href="/templates"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <FileText size={16} className="text-violet-600 shrink-0" />
                    <span>HSM Templates</span>
                  </Link>

                  <Link
                    href="/integrations"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition col-span-2"
                  >
                    <Zap size={16} className="text-amber-600 shrink-0" />
                    <span>Meta Lead Ads & Webhook Integrations</span>
                  </Link>
                </div>
              </div>

              {/* Category 3: Analytics & Management */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Management & Reporting
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/analytics"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <BarChart2 size={16} className="text-blue-600 shrink-0" />
                    <span>Sales Analytics</span>
                  </Link>

                  <Link
                    href="/notifications"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <Bell size={16} className="text-amber-600 shrink-0" />
                      <span>Alerts</span>
                    </div>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-extrabold">
                        {unreadCount}
                      </span>
                    )}
                  </Link>

                  {(isTenantOwner || isTenantManager) && (
                    <Link
                      href="/agency"
                      onClick={() => setIsMoreDrawerOpen(false)}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                    >
                      <Shield size={16} className="text-indigo-600 shrink-0" />
                      <span>Agency Roster</span>
                    </Link>
                  )}

                  {(isTenantOwner || isTenantManager || isSuper) && (
                    <Link
                      href="/admin"
                      onClick={() => setIsMoreDrawerOpen(false)}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 text-amber-900 text-xs font-bold transition"
                    >
                      <Crown size={16} className="text-amber-600 shrink-0" />
                      <span>Admin Control</span>
                    </Link>
                  )}

                  {isTenantOwner && (
                    <Link
                      href="/plans"
                      onClick={() => setIsMoreDrawerOpen(false)}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition col-span-2"
                    >
                      <Award size={16} className="text-indigo-600 shrink-0" />
                      <span>Subscription Plans & Invoices</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Category 4: Profile & Logout */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <Link
                  href={profileHref}
                  onClick={() => setIsMoreDrawerOpen(false)}
                  className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
                >
                  <User size={15} />
                  <span>My Profile</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setIsMoreDrawerOpen(false);
                    handleLogout();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition"
                >
                  <LogOut size={15} />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar Navigation (Visible only on desktop screens >= 768px) */}
      <aside className="sidebar-nav hidden md:flex">
        {/* COMMON BRANDING: [CRM Logo] 🤝 [Organization Logo] + Organization Name */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 14,
            padding: isCollapsed ? '0 0 12px' : '0 4px 12px',
            borderBottom: '1px solid var(--border)',
            position: 'relative',
          }}
        >
          {/* Top Row: CRM Logo + Handshake + Org Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              width: '100%',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isCollapsed ? 4 : 8, margin: isCollapsed ? '0 auto' : '0' }}>
              {/* CRM Logo */}
              <div
                title="SalesCRM Platform"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  overflow: 'hidden',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#ffffff',
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.2)',
                  border: '1px solid #e2e8f0',
                }}
              >
                <Image
                  src="/logo.png"
                  alt="SalesCRM Logo"
                  width={30}
                  height={30}
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>

              {/* Visual Handshake */}
              {!isCollapsed && (
                <span
                  style={{
                    fontSize: 14,
                    lineHeight: 1,
                    opacity: 0.85,
                    userSelect: 'none',
                  }}
                  title="Platform ↔ Organization Partnership"
                >
                  🤝
                </span>
              )}

              {/* Organization Logo */}
              {!isCollapsed && (
                <div
                  title={`Organization: ${orgName}`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: orgLogo ? '#ffffff' : 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  }}
                >
                  {orgLogo ? (
                    <img
                      src={orgLogo}
                      alt={orgName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>
                      {orgInitial}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar Collapse Toggle Button */}
            {!isCollapsed && (
              <button
                onClick={toggleCollapse}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Collapse Sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </div>

          {/* Underneath: Organization Name */}
          {!isCollapsed && (
            <div
              style={{
                width: '100%',
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text)',
                  lineHeight: 1.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  padding: '0 4px',
                }}
                title={orgName}
              >
                {orgName}
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginTop: 1,
                }}
              >
                {isTenantAgent ? 'Agent Workspace' : isTenantManager ? 'Management Workspace' : 'Organization Workspace'}
              </div>
            </div>
          )}
        </div>

        {/* Collapsed Expand Toggle */}
        {isCollapsed && (
          <button
            onClick={toggleCollapse}
            style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '6px 0',
              marginBottom: 12,
            }}
            title="Expand Sidebar"
          >
            <ChevronRight size={18} />
          </button>
        )}

        {/* Dynamic Plan / Upgrade Widget in Sidebar (ONLY FOR TENANT OWNERS) */}
        {!isCollapsed && isTenantOwner && (
          <div style={{ marginBottom: 14, padding: '0 4px' }}>
            <PlanStatusWidget style={{ width: '100%', justifyContent: 'center' }} />
          </div>
        )}

        {/* Menu Navigation Links */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
          {isSuper && (
            <Link
              href="/admin"
              className={`sidebar-nav-link ${isLinkActive('admin', '/admin') ? 'active' : ''}`}
              style={{
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                fontWeight: 700,
                marginBottom: 6,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                padding: isCollapsed ? '10px 0' : '10px 14px',
              }}
              title="Admin Panel"
            >
              <Crown size={18} color="#f59e0b" />
              {!isCollapsed && <span>Admin Panel</span>}
            </Link>
          )}

          {(isTenantOwner || isTenantManager) && (
            <Link
              href="/agency"
              className={`sidebar-nav-link ${isLinkActive('agency', '/agency') ? 'active' : ''}`}
              style={{
                color: 'var(--accent)',
                background: 'rgba(79, 70, 229, 0.08)',
                border: '1px solid rgba(79, 70, 229, 0.15)',
                fontWeight: 600,
                marginBottom: 6,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                padding: isCollapsed ? '10px 0' : '10px 14px',
              }}
              title="Agency Control"
            >
              <Shield size={18} color="var(--accent)" />
              {!isCollapsed && <span>Agency Control</span>}
            </Link>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* COMPLETE AGENT PANEL NAVIGATION (RESTORED & STRUCTURED)        */}
          {/* ───────────────────────────────────────────────────────────── */}
          {isTenantAgent ? (
            <>
              {/* 1. DASHBOARD */}
              <Link
                href="/dashboard"
                className={`sidebar-nav-link ${isLinkActive('dashboard', '/dashboard') ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                }}
                title="Agent Dashboard"
              >
                <Home size={17} color={isLinkActive('dashboard', '/dashboard') ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span style={{ fontWeight: 600 }}>Dashboard</span>}
              </Link>

              {/* 2. LEADS (WITH SUB-ITEMS: UNCLAIMED & MY LEADS) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div
                  className={`sidebar-nav-link ${normalize(pathname) === '/leads' ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                    cursor: 'pointer',
                  }}
                  title="Leads"
                >
                  <Link
                    href="/leads?tab=my_leads"
                    onClick={() => setLeadsExpanded(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                  >
                    <Users size={17} color={normalize(pathname) === '/leads' ? 'var(--accent)' : 'currentColor'} />
                    {!isCollapsed && <span style={{ fontWeight: 600 }}>Leads</span>}
                  </Link>
                  {!isCollapsed && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLeadsExpanded(!leadsExpanded);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <ChevronDown
                        size={14}
                        style={{
                          transform: leadsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                          transition: 'transform 0.2s',
                          color: 'var(--text-muted)',
                        }}
                      />
                    </button>
                  )}
                </div>

                {/* Sub-items for Leads */}
                {!isCollapsed && leadsExpanded && (
                  <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                    <Link
                      href="/leads?tab=unclaimed"
                      className={`sidebar-nav-link ${normalize(pathname) === '/leads' && currentTab === 'unclaimed' ? 'active' : ''}`}
                      style={{
                        padding: '6px 10px',
                        fontSize: 12,
                        minHeight: 28,
                      }}
                    >
                      <span>New / Unclaimed</span>
                    </Link>
                    <Link
                      href="/leads?tab=my_leads"
                      className={`sidebar-nav-link ${normalize(pathname) === '/leads' && (currentTab === 'my_leads' || !currentTab) ? 'active' : ''}`}
                      style={{
                        padding: '6px 10px',
                        fontSize: 12,
                        minHeight: 28,
                      }}
                    >
                      <span>My Leads</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* 3. FOLLOW-UPS */}
              <Link
                href="/follow-ups"
                className={`sidebar-nav-link ${normalize(pathname) === '/follow-ups' ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                }}
                title="Follow-ups"
              >
                <Calendar size={17} color={normalize(pathname) === '/follow-ups' ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span>Follow-ups</span>}
              </Link>

              {/* 4. PIPELINE */}
              <Link
                href="/pipeline"
                className={`sidebar-nav-link ${normalize(pathname) === '/pipeline' ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                }}
                title="Pipeline"
              >
                <TrendingUp size={17} color={normalize(pathname) === '/pipeline' ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span>Pipeline</span>}
              </Link>

              {/* 5. DEALS */}
              <Link
                href="/deals"
                className={`sidebar-nav-link ${normalize(pathname) === '/deals' ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                }}
                title="Deals"
              >
                <Award size={17} color={normalize(pathname) === '/deals' ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span>Deals</span>}
              </Link>

              {/* 6. SITE VISITS */}
              <Link
                href="/site-visits"
                className={`sidebar-nav-link ${normalize(pathname) === '/site-visits' ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                }}
                title="Site Visits"
              >
                <MapPin size={17} color={normalize(pathname) === '/site-visits' ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span>Site Visits</span>}
              </Link>

              {/* 7. PRODUCT & PACKAGES */}
              {isEducation ? (
                <Link
                  href="/catalogue"
                  className={`sidebar-nav-link ${isLinkActive('catalogue', '/catalogue') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Colleges & Courses"
                >
                  <GraduationCap size={17} color={isLinkActive('catalogue', '/catalogue') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Colleges & Courses</span>}
                </Link>
              ) : (
                <Link
                  href="/projects"
                  className={`sidebar-nav-link ${isLinkActive('projects', '/projects') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Product & Packages"
                >
                  <Package size={17} color={isLinkActive('projects', '/projects') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Product & Packages</span>}
                </Link>
              )}

              {/* 8. MY PERFORMANCE */}
              <Link
                href="/analytics"
                className={`sidebar-nav-link ${isLinkActive('analytics', '/analytics') ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                }}
                title="My Performance"
              >
                <BarChart2 size={17} color={isLinkActive('analytics', '/analytics') ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span>My Performance</span>}
              </Link>

              {/* 9. GENERAL CONTROLS (WITH SUB-ITEMS: WHATSAPP HUB, BROADCAST, TEMPLATES, AUDIENCE GROUPS) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div
                  className={`sidebar-nav-link ${normalize(pathname) === '/whatsapp' || normalize(pathname) === '/campaigns' || normalize(pathname) === '/templates' || normalize(pathname) === '/groups' ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                    cursor: 'pointer',
                  }}
                  title="General Controls"
                >
                  <Link
                    href="/whatsapp"
                    onClick={() => setGeneralControlsExpanded(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                  >
                    <Sliders size={17} color={normalize(pathname) === '/whatsapp' || normalize(pathname) === '/campaigns' || normalize(pathname) === '/templates' || normalize(pathname) === '/groups' ? 'var(--accent)' : 'currentColor'} />
                    {!isCollapsed && <span style={{ fontWeight: 600 }}>General Controls</span>}
                  </Link>
                  {!isCollapsed && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setGeneralControlsExpanded(!generalControlsExpanded);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <ChevronDown
                        size={14}
                        style={{
                          transform: generalControlsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                          transition: 'transform 0.2s',
                          color: 'var(--text-muted)',
                        }}
                      />
                    </button>
                  )}
                </div>

                {/* Sub-items for General Controls */}
                {!isCollapsed && generalControlsExpanded && (
                  <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                    <Link
                      href="/whatsapp"
                      className={`sidebar-nav-link ${normalize(pathname) === '/whatsapp' ? 'active' : ''}`}
                      style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}
                    >
                      <span>WhatsApp Hub</span>
                    </Link>
                    <Link
                      href="/campaigns"
                      className={`sidebar-nav-link ${normalize(pathname) === '/campaigns' ? 'active' : ''}`}
                      style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}
                    >
                      <span>Broadcast</span>
                    </Link>
                    <Link
                      href="/templates"
                      className={`sidebar-nav-link ${normalize(pathname) === '/templates' ? 'active' : ''}`}
                      style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}
                    >
                      <span>Message Templates</span>
                    </Link>
                    <Link
                      href="/groups"
                      className={`sidebar-nav-link ${normalize(pathname) === '/groups' ? 'active' : ''}`}
                      style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}
                    >
                      <span>Audience Groups</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* 10. NOTIFICATIONS */}
              <Link
                href="/notifications"
                className={`sidebar-nav-link ${isLinkActive('notifications', '/notifications') ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                }}
                title="Notifications"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bell size={17} color={isLinkActive('notifications', '/notifications') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Notifications</span>}
                </div>
                {!isCollapsed && unreadCount > 0 && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: '#ef4444',
                    color: '#fff',
                  }}>
                    {unreadCount}
                  </span>
                )}
              </Link>

              {/* 11. PROFILE */}
              <Link
                href="/profile"
                className={`sidebar-nav-link ${isLinkActive('profile', '/profile') ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                }}
                title="Profile"
              >
                <User size={17} color={isLinkActive('profile', '/profile') ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span>Profile</span>}
              </Link>
            </>
          ) : isTenantManager ? (
            /* REAL ESTATE MANAGER COMMAND CENTER (FOR MANAGERS ONLY) */
            isRealEstate ? (
              <>
                {/* 1. DASHBOARD */}
                <Link
                  href="/dashboard"
                  className={`sidebar-nav-link ${isLinkActive('dashboard', '/dashboard') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Dashboard"
                >
                  <Home size={17} color={isLinkActive('dashboard', '/dashboard') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span style={{ fontWeight: 600 }}>Dashboard</span>}
                </Link>

                {/* 2. LEADS */}
                <Link
                  href="/leads"
                  className={`sidebar-nav-link ${isLinkActive('leads', '/leads') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Leads Pipeline"
                >
                  <Users size={17} color={isLinkActive('leads', '/leads') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Leads</span>}
                </Link>

                {/* 3. MY TEAM */}
                <Link
                  href="/agency"
                  className={`sidebar-nav-link ${isLinkActive('agency', '/agency') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="My Team"
                >
                  <Shield size={17} color={isLinkActive('agency', '/agency') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>My Team</span>}
                </Link>

                {/* 4. REQUIREMENTS */}
                <Link
                  href="/requirements"
                  className={`sidebar-nav-link ${isLinkActive('requirements', '/requirements') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Buyer Requirements"
                >
                  <CheckSquare size={17} color={isLinkActive('requirements', '/requirements') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Requirements</span>}
                </Link>

                {/* 5. SITE VISITS */}
                <Link
                  href="/site-visits"
                  className={`sidebar-nav-link ${isLinkActive('site-visits', '/site-visits') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Site Visits"
                >
                  <MapPin size={17} color={isLinkActive('site-visits', '/site-visits') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Site Visits</span>}
                </Link>

                {/* 6. PIPELINE */}
                <Link
                  href="/pipeline"
                  className={`sidebar-nav-link ${isLinkActive('pipeline', '/pipeline') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Sales Pipeline"
                >
                  <TrendingUp size={17} color={isLinkActive('pipeline', '/pipeline') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Pipeline</span>}
                </Link>

                {/* 7. PROJECTS & INVENTORY */}
                <Link
                  href="/projects"
                  className={`sidebar-nav-link ${isLinkActive('projects', '/projects') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Projects & Inventory"
                >
                  <Building2 size={17} color={isLinkActive('projects', '/projects') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Projects</span>}
                </Link>

                {/* 8. EOI */}
                <Link
                  href="/eoi"
                  className={`sidebar-nav-link ${isLinkActive('eoi', '/eoi') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Expressions of Interest"
                >
                  <FileText size={17} color={isLinkActive('eoi', '/eoi') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>EOI Tokens</span>}
                </Link>

                {/* 9. BOOKINGS */}
                <Link
                  href="/bookings"
                  className={`sidebar-nav-link ${isLinkActive('bookings', '/bookings') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Bookings"
                >
                  <Award size={17} color={isLinkActive('bookings', '/bookings') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Bookings</span>}
                </Link>

                {/* 10. PAYMENTS */}
                <Link
                  href="/payments"
                  className={`sidebar-nav-link ${isLinkActive('payments', '/payments') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Payment Milestones"
                >
                  <DollarSign size={17} color={isLinkActive('payments', '/payments') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Payments</span>}
                </Link>

                {/* 11. COMMISSION */}
                <Link
                  href="/commission"
                  className={`sidebar-nav-link ${isLinkActive('commission', '/commission') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Commissions"
                >
                  <Percent size={17} color={isLinkActive('commission', '/commission') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Commission</span>}
                </Link>

                {/* 12. ANALYTICS */}
                <Link
                  href="/analytics"
                  className={`sidebar-nav-link ${isLinkActive('analytics', '/analytics') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Analytics & Conversion"
                >
                  <BarChart2 size={17} color={isLinkActive('analytics', '/analytics') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Analytics</span>}
                </Link>

                {/* 13. GENERAL SETTINGS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className={`sidebar-nav-link ${normalize(pathname) === '/whatsapp' || normalize(pathname) === '/campaigns' || normalize(pathname) === '/templates' || normalize(pathname) === '/groups' ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '9px 0' : '9px 12px',
                      cursor: 'pointer',
                    }}
                    title="General Settings"
                  >
                    <Link
                      href="/whatsapp"
                      onClick={() => setGeneralControlsExpanded(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                    >
                      <Sliders size={17} color={normalize(pathname) === '/whatsapp' || normalize(pathname) === '/campaigns' || normalize(pathname) === '/templates' || normalize(pathname) === '/groups' ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span style={{ fontWeight: 600 }}>General Settings</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setGeneralControlsExpanded(!generalControlsExpanded);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)'
                        }}
                      >
                        <ChevronDown
                          size={14}
                          style={{
                            transform: generalControlsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && generalControlsExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/whatsapp" className={`sidebar-nav-link ${normalize(pathname) === '/whatsapp' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>WhatsApp Hub</span>
                      </Link>
                      <Link href="/campaigns" className={`sidebar-nav-link ${normalize(pathname) === '/campaigns' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Broadcast Campaigns</span>
                      </Link>
                      <Link href="/templates" className={`sidebar-nav-link ${normalize(pathname) === '/templates' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Message Templates</span>
                      </Link>
                      <Link href="/groups" className={`sidebar-nav-link ${normalize(pathname) === '/groups' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Audience Groups</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 14. NOTIFICATIONS */}
                <Link
                  href="/notifications"
                  className={`sidebar-nav-link ${isLinkActive('notifications', '/notifications') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Notifications"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Bell size={17} color={isLinkActive('notifications', '/notifications') ? 'var(--accent)' : 'currentColor'} />
                    {!isCollapsed && <span>Notifications</span>}
                  </div>
                  {!isCollapsed && unreadCount > 0 && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 10,
                      background: '#ef4444',
                      color: '#fff',
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </Link>

                {/* 15. PROFILE */}
                <Link
                  href="/profile"
                  className={`sidebar-nav-link ${isLinkActive('profile', '/profile') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Profile"
                >
                  <User size={17} color={isLinkActive('profile', '/profile') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Profile</span>}
                </Link>
              </>
            ) : (
              /* Generic Non-Real-Estate Manager Navigation */
              genericManagerDesktopItems.map(({ href, label, icon: Icon, key, badge }) => {
                const activeState = isLinkActive(key, href);
                return (
                  <Link
                    key={key}
                    href={href}
                    className={`sidebar-nav-link ${activeState ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '10px 0' : '10px 14px',
                    }}
                    title={label}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon size={18} color={activeState ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span>{label}</span>}
                    </div>
                    {!isCollapsed && badge > 0 && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: 10,
                        background: '#ef4444',
                        color: '#fff',
                      }}>
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })
            )
          ) : isTenantOwner ? (
            /* OWNER / SUPERADMIN NAVIGATION (FULL OWNER CONTROLS) */
            ownerDesktopItems.map(({ href, label, icon: Icon, key, badge }) => {
              const activeState = isLinkActive(key, href);
              return (
                <Link
                  key={key}
                  href={href}
                  className={`sidebar-nav-link ${activeState ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    padding: isCollapsed ? '10px 0' : '10px 14px',
                  }}
                  title={label}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={18} color={activeState ? 'var(--accent)' : 'currentColor'} />
                    {!isCollapsed && <span>{label}</span>}
                  </div>
                  {!isCollapsed && badge > 0 && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 10,
                      background: '#ef4444',
                      color: '#fff',
                    }}>
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })
          ) : (
            /* DEFAULT / AGENT FALLBACK */
            /* Non-Real-Estate Navigation (Owner & Manager) */
            <>
              <Link
                href="/dashboard"
                className={`sidebar-nav-link ${isLinkActive('dashboard', '/dashboard') ? 'active' : ''}`}
                style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '9px 0' : '9px 12px' }}
                title="Dashboard"
              >
                <Home size={17} color={isLinkActive('dashboard', '/dashboard') ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span style={{ fontWeight: 600 }}>Dashboard</span>}
              </Link>

              <Link
                href="/leads"
                className={`sidebar-nav-link ${isLinkActive('leads', '/leads') ? 'active' : ''}`}
                style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '9px 0' : '9px 12px' }}
                title="Leads Pipeline"
              >
                <Users size={17} color={isLinkActive('leads', '/leads') ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span>Leads Pipeline</span>}
              </Link>

              {isEducation ? (
                <Link
                  href="/catalogue"
                  className={`sidebar-nav-link ${isLinkActive('catalogue', '/catalogue') ? 'active' : ''}`}
                  style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '9px 0' : '9px 12px' }}
                  title="Colleges & Courses"
                >
                  <GraduationCap size={17} color={isLinkActive('catalogue', '/catalogue') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Colleges & Courses</span>}
                </Link>
              ) : (
                <Link
                  href="/projects"
                  className={`sidebar-nav-link ${isLinkActive('projects', '/projects') ? 'active' : ''}`}
                  style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '9px 0' : '9px 12px' }}
                  title="Products & Packages"
                >
                  <Package size={17} color={isLinkActive('projects', '/projects') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Products & Packages</span>}
                </Link>
              )}

              {isTenantOwner && (
                <Link
                  href="/integrations"
                  className={`sidebar-nav-link ${isLinkActive('integrations', '/integrations') ? 'active' : ''}`}
                  style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '9px 0' : '9px 12px' }}
                  title="Ads & Lead Integrations"
                >
                  <Zap size={17} color={isLinkActive('integrations', '/integrations') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Ads & Integrations</span>}
                </Link>
              )}

              <Link
                href="/analytics"
                className={`sidebar-nav-link ${isLinkActive('analytics', '/analytics') ? 'active' : ''}`}
                style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '9px 0' : '9px 12px' }}
                title="Sales Analytics"
              >
                <BarChart2 size={17} color={isLinkActive('analytics', '/analytics') ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span>Sales Analytics</span>}
              </Link>

              {/* GENERAL SETTINGS / WHATSAPP HUB (COLLAPSIBLE GROUP) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div
                  className={`sidebar-nav-link ${normalize(pathname) === '/whatsapp' || normalize(pathname) === '/campaigns' || normalize(pathname) === '/templates' || normalize(pathname) === '/groups' ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                    cursor: 'pointer',
                  }}
                  title="General Settings"
                >
                  <Link
                    href="/whatsapp"
                    onClick={() => setGeneralControlsExpanded(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                  >
                    <Sliders size={17} color={normalize(pathname) === '/whatsapp' || normalize(pathname) === '/campaigns' || normalize(pathname) === '/templates' || normalize(pathname) === '/groups' ? 'var(--accent)' : 'currentColor'} />
                    {!isCollapsed && <span style={{ fontWeight: 600 }}>General Settings</span>}
                  </Link>
                  {!isCollapsed && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setGeneralControlsExpanded(!generalControlsExpanded);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <ChevronDown
                        size={14}
                        style={{
                          transform: generalControlsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </button>
                  )}
                </div>
                {!isCollapsed && generalControlsExpanded && (
                  <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                    <Link href="/whatsapp" className={`sidebar-nav-link ${normalize(pathname) === '/whatsapp' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                      <span>WhatsApp Hub</span>
                    </Link>
                    <Link href="/campaigns" className={`sidebar-nav-link ${normalize(pathname) === '/campaigns' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                      <span>Broadcast Campaigns</span>
                    </Link>
                    <Link href="/templates" className={`sidebar-nav-link ${normalize(pathname) === '/templates' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                      <span>Message Templates</span>
                    </Link>
                    <Link href="/groups" className={`sidebar-nav-link ${normalize(pathname) === '/groups' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                      <span>Audience Groups</span>
                    </Link>
                  </div>
                )}
              </div>

              <Link
                href="/notifications"
                className={`sidebar-nav-link ${isLinkActive('notifications', '/notifications') ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                }}
                title="Notifications"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bell size={17} color={isLinkActive('notifications', '/notifications') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>Notifications</span>}
                </div>
                {!isCollapsed && unreadCount > 0 && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: '#ef4444',
                    color: '#fff',
                  }}>
                    {unreadCount}
                  </span>
                )}
              </Link>

              <Link
                href={profileHref}
                className={`sidebar-nav-link ${isLinkActive('profile', profileHref) ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                }}
                title="Profile"
              >
                <User size={17} color={isLinkActive('profile', profileHref) ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span>Organization & Profile</span>}
              </Link>
            </>
          )}
        </div>

        {/* Universal Logout Button for All Users */}
        <div style={{ padding: isCollapsed ? '8px 0 4px' : '8px 2px 4px', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <button
            type="button"
            onClick={handleLogout}
            className="sidebar-nav-link"
            style={{
              width: '100%',
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: 10,
              padding: isCollapsed ? '10px 0' : '10px 12px',
              borderRadius: 8,
              color: '#ef4444',
              fontSize: 13,
              fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
            title="Log Out"
          >
            <LogOut size={17} color="#ef4444" />
            {!isCollapsed && <span>Log Out</span>}
          </button>
        </div>

        {/* Legal links in sidebar */}
        {!isCollapsed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '6px 8px 4px',
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            <Link
              href="/privacy"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}
              className="hover:text-slate-900"
            >
              Privacy Policy
            </Link>
            <span>•</span>
            <Link
              href="/terms"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}
              className="hover:text-slate-900"
            >
              Terms
            </Link>
          </div>
        )}

        {/* Footer version badge */}
        {!isCollapsed && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              padding: '8px 8px 0',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>v2.2.0 • SaaS Edition</span>
            <span
              style={{
                fontSize: 9,
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--green)',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 700,
              }}
            >
              PRO
            </span>
          </div>
        )}
      </aside>
    </>
  );
}

export default function BottomNav(props) {
  return (
    <Suspense fallback={null}>
      <BottomNavContent {...props} />
    </Suspense>
  );
}
