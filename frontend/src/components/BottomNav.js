'use client';
import { useState, useEffect, Suspense, createContext, useContext } from 'react';

export const AppShellContext = createContext(false);
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  getUser,
  isSuperAdmin,
  isOwner,
  isManager,
  isAgent,
  getUserRole,
  clearAuth,
} from '@/lib/auth';
import api, { cachedGet } from '@/lib/api';
import {
  Home, FileText, Users, BarChart2, User, MessageCircle, MoreHorizontal, Grid, X as CloseIcon,
  Package, Send, Zap, Shield, Crown, GraduationCap,
  ChevronLeft, ChevronRight, Building2, Calendar, TrendingUp,
  Award, MapPin, ChevronDown, Sliders, Bell, IndianRupee,
  Percent, CheckSquare, Layers, LogOut, Settings, ShieldCheck
} from 'lucide-react';
import PlanStatusWidget from '@/components/PlanStatusWidget';
import { useQueryClient } from '@tanstack/react-query';
import {
  leadsListOptions,
  pipelineOptions,
  dashboardStatsOptions,
  membersOptions,
  integrationsOptions,
} from '@/lib/queries';

function BottomNavContent({ active }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams?.get('tab') || null;
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSuper, setIsSuper] = useState(false);
  const [isEducation, setIsEducation] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const [profileHref, setProfileHref] = useState('/profile');
  const [generalControlsExpanded, setGeneralControlsExpanded] = useState(false);
  const [leadsExpanded, setLeadsExpanded] = useState(false);

  const handlePrefetch = (key, href) => {
    if (router?.prefetch && href) {
      router.prefetch(href);
    }
    if (!queryClient) return;
    try {
      if (key === 'leads') {
        queryClient.prefetchQuery(leadsListOptions({ page: 1, limit: 25 }));
        queryClient.prefetchQuery(membersOptions());
      } else if (key === 'pipeline') {
        queryClient.prefetchQuery(pipelineOptions());
      } else if (key === 'dashboard') {
        queryClient.prefetchQuery(dashboardStatsOptions());
      } else if (key === 'integrations') {
        queryClient.prefetchQuery(integrationsOptions());
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token) return;

    if (navigator.connection) {
      if (navigator.connection.saveData) return;
      if (navigator.connection.effectiveType === '2g' || navigator.connection.effectiveType === 'slow-2g') return;
    }

    const prefetchMainTabs = async () => {
      try {
        await queryClient.prefetchQuery(leadsListOptions({ page: 1, limit: 25 }));
        await queryClient.prefetchQuery(pipelineOptions());
        await queryClient.prefetchQuery(dashboardStatsOptions());
      } catch (_) {}
    };

    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(() => prefetchMainTabs(), { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    } else {
      const timeout = setTimeout(prefetchMainTabs, 1500);
      return () => clearTimeout(timeout);
    }
  }, [queryClient]);

  const handleLogout = () => {
    clearAuth();
    router.replace('/login');
  };

  useEffect(() => {
    let mounted = true;
    const fetchOverdueBadge = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await cachedGet('/leads/follow-ups/due', { ttl: 20000, silentAuth: true, _isBackground: true });
        if (mounted && Array.isArray(res.data)) {
          setOverdueCount(res.data.length);
        }
      } catch (e) { }
    };
    fetchOverdueBadge();
    const iv = setInterval(fetchOverdueBadge, 30000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchUnread = async () => {
      try {
        const res = await cachedGet('/notifications', { ttl: 20000 });
        if (mounted) {
          setUnreadCount(res.data?.unreadCount || 0);
        }
      } catch { }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved) setIsCollapsed(JSON.parse(saved));
    } catch { }
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
    } catch { }
  };

  const [isAdminOrOwner, setIsAdminOrOwner] = useState(false);

  useEffect(() => {
    const localUser = getUser();
    setUser(localUser);

    const superAdminCheck = isSuperAdmin(localUser);
    setIsSuper(superAdminCheck);
    setIsEducation(true);
    setProfileHref('/profile');

    const adminCheck = superAdminCheck || localUser?.role === 'admin' || localUser?.role === 'owner' || localUser?.companyRole === 'owner' || localUser?.workStatus === 'company_owner' || (!localUser?.companyRole && localUser?.role !== 'agent' && localUser?.role !== 'staff');
    setIsAdminOrOwner(Boolean(adminCheck));

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
    (user?.name ? `${user.name}'s Consultancy` : 'Admission Consultancy');

  const orgLogo =
    user?.companyInfo?.companyLogo ||
    user?.companyId?.companyInfo?.companyLogo ||
    null;

  const orgInitial = (orgName || 'C').trim().charAt(0).toUpperCase();

  // Mobile Bottom Nav for Single Consultant
  const mobileItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home, key: 'dashboard' },
    { href: '/leads', label: 'Candidates', icon: Users, key: 'leads' },
    { href: '/catalogue', label: 'Colleges', icon: GraduationCap, key: 'catalogue' },
    { href: '/pipeline', label: 'Pipeline', icon: TrendingUp, key: 'pipeline' },
    { href: profileHref, label: 'Profile', icon: User, key: 'profile' },
  ];

  // Desktop Navigation: Strict Target Information Architecture (Admission Consultant CRM)
  // 1. Home, 2. Leads, 3. Pipelines, 4. Follow-ups, 5. Colleges, 6. Communication,
  // 7. Admissions & Finance, 8. Reports, 9. Forms & Automation, 10. Integrations (Admin/Owner), 11. Workspace Settings
  const desktopItems = [
    { href: '/dashboard', label: 'Home', icon: Home, key: 'dashboard' },
    { href: '/leads', label: 'Leads', icon: Users, key: 'leads' },
    { href: '/pipeline', label: 'Pipelines', icon: TrendingUp, key: 'pipeline' },
    { href: '/follow-ups', label: 'Follow-ups', icon: Calendar, key: 'follow_ups', badge: overdueCount },
    { href: '/catalogue', label: 'Colleges', icon: GraduationCap, key: 'catalogue' },
    { href: '/whatsapp', label: 'Communication', icon: MessageCircle, key: 'whatsapp', badge: unreadCount },
    { href: '/deals', label: 'Admissions & Finance', icon: IndianRupee, key: 'deals' },
    { href: '/analytics', label: 'Reports', icon: BarChart2, key: 'analytics' },
    { href: '/forms', label: 'Forms & Automation', icon: Layers, key: 'forms' },
    ...(isAdminOrOwner ? [{ href: '/integrations', label: 'Integrations', icon: Zap, key: 'integrations' }] : []),
    { href: '/workspace', label: 'Workspace Settings', icon: Settings, key: 'workspace' },
  ];

  return (
    <>
      {/* Mobile Bottom Navigation (Responsive across 240px to 712px viewports; strictly hidden on >= 768px desktop) */}
      <nav
        className="bottom-nav md:hidden"
        aria-label="Mobile Navigation"
      >
        {/* 1. Home */}
        <Link
          href="/dashboard"
          prefetch={true}
          onMouseEnter={() => handlePrefetch('dashboard', '/dashboard')}
          onTouchStart={() => handlePrefetch('dashboard', '/dashboard')}
          onFocus={() => handlePrefetch('dashboard', '/dashboard')}
          className={`bottom-nav-link btn-touch ${isLinkActive('dashboard', '/dashboard') ? 'active' : ''}`}
          onClick={() => setIsMoreDrawerOpen(false)}
          style={{ minHeight: 48, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none', position: 'relative', color: isLinkActive('dashboard', '/dashboard') ? '#4f46e5' : '#64748b' }}
        >
          <Home size={19} className={isLinkActive('dashboard', '/dashboard') ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
          <span className="bottom-nav-label" style={{ fontWeight: isLinkActive('dashboard', '/dashboard') ? 800 : 500 }}>Home</span>
          {isLinkActive('dashboard', '/dashboard') && (
            <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 9999, backgroundColor: '#4f46e5' }} />
          )}
        </Link>

        {/* 2. Leads */}
        <Link
          href="/leads"
          prefetch={true}
          onMouseEnter={() => handlePrefetch('leads', '/leads')}
          onTouchStart={() => handlePrefetch('leads', '/leads')}
          onFocus={() => handlePrefetch('leads', '/leads')}
          className={`bottom-nav-link btn-touch ${isLinkActive('leads', '/leads') ? 'active' : ''}`}
          onClick={() => setIsMoreDrawerOpen(false)}
          style={{ minHeight: 48, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none', position: 'relative', color: isLinkActive('leads', '/leads') ? '#4f46e5' : '#64748b' }}
        >
          <Users size={19} className={isLinkActive('leads', '/leads') ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
          <span className="bottom-nav-label" style={{ fontWeight: isLinkActive('leads', '/leads') ? 800 : 500 }}>Leads</span>
          {isLinkActive('leads', '/leads') && (
            <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 9999, backgroundColor: '#4f46e5' }} />
          )}
        </Link>

        {/* 3. Pipeline */}
        <Link
          href="/pipeline"
          prefetch={true}
          onMouseEnter={() => handlePrefetch('pipeline', '/pipeline')}
          onTouchStart={() => handlePrefetch('pipeline', '/pipeline')}
          onFocus={() => handlePrefetch('pipeline', '/pipeline')}
          className={`bottom-nav-link btn-touch ${isLinkActive('pipeline', '/pipeline') ? 'active' : ''}`}
          onClick={() => setIsMoreDrawerOpen(false)}
          style={{ minHeight: 48, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none', position: 'relative', color: isLinkActive('pipeline', '/pipeline') ? '#4f46e5' : '#64748b' }}
        >
          <TrendingUp size={19} className={isLinkActive('pipeline', '/pipeline') ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
          <span className="bottom-nav-label" style={{ fontWeight: isLinkActive('pipeline', '/pipeline') ? 800 : 500 }}>Pipeline</span>
          {isLinkActive('pipeline', '/pipeline') && (
            <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 9999, backgroundColor: '#4f46e5' }} />
          )}
        </Link>

        {/* 4. Follow-ups (with dynamic overdue alarm badge) */}
        <Link
          href="/follow-ups"
          prefetch={true}
          className={`bottom-nav-link btn-touch ${isLinkActive('follow_ups', '/follow-ups') ? 'active' : ''}`}
          onClick={() => setIsMoreDrawerOpen(false)}
          style={{ minHeight: 48, minWidth: 0, width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none', color: isLinkActive('follow_ups', '/follow-ups') ? '#4f46e5' : '#64748b' }}
        >
          <Calendar size={19} className={isLinkActive('follow_ups', '/follow-ups') ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
          <span className="bottom-nav-label" style={{ fontWeight: isLinkActive('follow_ups', '/follow-ups') ? 800 : 500 }}>Follow-ups</span>
          {overdueCount > 0 && (
            <span style={{
              position: 'absolute',
              top: 3,
              right: '20%',
              background: '#e11d48',
              color: '#ffffff',
              fontSize: 9,
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: 9999,
              lineHeight: 1.2,
              boxShadow: '0 2px 6px rgba(225, 29, 72, 0.4)'
            }}>
              {overdueCount}
            </span>
          )}
          {isLinkActive('follow_ups', '/follow-ups') && (
            <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 9999, backgroundColor: '#4f46e5' }} />
          )}
        </Link>

        {/* 5. More (Workspaces & Settings Sheet Trigger) */}
        <button
          type="button"
          onClick={() => setIsMoreDrawerOpen(!isMoreDrawerOpen)}
          className={`bottom-nav-link btn-touch ${isMoreDrawerOpen ? 'active' : ''}`}
          style={{
            minHeight: 48,
            minWidth: 0,
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            position: 'relative',
            color: isMoreDrawerOpen ? '#4f46e5' : '#64748b',
            padding: 0
          }}
          aria-label="More Workspaces and Settings"
        >
          <MoreHorizontal size={19} className={isMoreDrawerOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
          <span className="bottom-nav-label" style={{ fontWeight: isMoreDrawerOpen ? 800 : 500 }}>More</span>
          {isMoreDrawerOpen && (
            <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 9999, backgroundColor: '#4f46e5' }} />
          )}
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
                  <p className="text-[11px] text-slate-500 m-0">{orgName} • Single Consultant</p>
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
              {/* Category 1: Sales Operations */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Sales Operations
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/catalogue"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <GraduationCap size={16} className="text-indigo-600 shrink-0" />
                    <span>Colleges & Courses</span>
                  </Link>

                  <Link
                    href="/pipeline"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <TrendingUp size={16} className="text-indigo-600 shrink-0" />
                    <span>Admission Pipeline</span>
                  </Link>

                  <Link
                    href="/deals"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <IndianRupee size={16} className="text-emerald-600 shrink-0" />
                    <span>Deals & Commission</span>
                  </Link>

                  <Link
                    href="/forms"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <Layers size={16} className="text-indigo-600 shrink-0" />
                    <span>Form Studio</span>
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
                    href="/whatsapp"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-950 text-xs font-semibold transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageCircle size={16} className="text-emerald-600 shrink-0" />
                      <span>WhatsApp Chat</span>
                    </div>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold">
                        {unreadCount}
                      </span>
                    )}
                  </Link>

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

                  {isAdminOrOwner && (
                    <Link
                      href="/integrations"
                      onClick={() => setIsMoreDrawerOpen(false)}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                    >
                      <Zap size={16} className="text-amber-600 shrink-0" />
                      <span>Ad & Lead Integrations</span>
                    </Link>
                  )}
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

                  {isSuper && (
                    <Link
                      href="/admin"
                      onClick={() => setIsMoreDrawerOpen(false)}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 text-amber-900 text-xs font-bold transition"
                    >
                      <Crown size={16} className="text-amber-600 shrink-0" />
                      <span>Admin Control</span>
                    </Link>
                  )}

                  <Link
                    href="/plans"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition col-span-2"
                  >
                    <Award size={16} className="text-indigo-600 shrink-0" />
                    <span>Subscription Plans & Invoices</span>
                  </Link>
                </div>
              </div>

              {/* Category 4: Workspace Settings */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Workspace Settings & Team
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/workspace"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <Settings size={16} className="text-indigo-600 shrink-0" />
                    <span>Workspace Settings</span>
                  </Link>

                  <Link
                    href="/workspace/team"
                    onClick={() => setIsMoreDrawerOpen(false)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 text-slate-800 text-xs font-semibold transition"
                  >
                    <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
                    <span>Team & Roles</span>
                  </Link>
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
        {/* Modern Brand & Workspace Header */}
        <div
          style={{
            marginBottom: 12,
            padding: isCollapsed ? '0 0 10px' : '0 2px 10px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              width: '100%',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div
                title="Sahyak CRM"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  overflow: 'hidden',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                }}
              >
                <Image
                  src="/logo.png"
                  alt="SalesCRM Logo"
                  width={26}
                  height={26}
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>

              {!isCollapsed && (
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--text)',
                      lineHeight: 1.2,
                      letterSpacing: '-0.02em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Sahyak CRM
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={orgName}
                  >
                    {orgName}
                  </span>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                onClick={toggleCollapse}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className="hover:bg-slate-100 transition-colors"
                title="Collapse Sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </div>
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

        {/* Dynamic Plan / Upgrade Widget in Sidebar */}
        {!isCollapsed && (
          <div className="sidebar-plan-widget" style={{ marginBottom: 14, padding: '0 4px' }}>
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


          {/* Main Desktop Navigation Items for Single Admission Consultant */}
          {desktopItems.map(({ href, label, icon: Icon, key, badge }) => {
            const activeState = isLinkActive(key, href);
            return (
              <Link
                key={key}
                href={href}
                prefetch={true}
                onMouseEnter={() => handlePrefetch(key, href)}
                onTouchStart={() => handlePrefetch(key, href)}
                onFocus={() => handlePrefetch(key, href)}
                className={`sidebar-nav-link ${activeState ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  padding: isCollapsed ? '10px 0' : '10px 14px',
                }}
                title={label}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={18} color={activeState ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span className="sidebar-item-label">{label}</span>}
                </div>
                {!isCollapsed && badge > 0 && (
                  <span className="sidebar-badge" style={{
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
          })}
        </div>

        {/* User Profile & Actions Footer */}
        <div
          style={{
            padding: isCollapsed ? '10px 0 6px' : '10px 4px 6px',
            borderTop: '1px solid var(--border)',
            marginTop: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              gap: 8,
              padding: isCollapsed ? '4px 0' : '6px 8px',
              borderRadius: 10,
              background: 'var(--card-subtle, #f8fafc)',
              border: '1px solid var(--border)',
            }}
          >
            <Link
              href={profileHref}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                minWidth: 0,
                textDecoration: 'none',
                flex: 1,
              }}
              title="View Profile"
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'rgba(79, 70, 229, 0.12)',
                  color: 'var(--accent)',
                  fontWeight: 800,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1px solid rgba(79, 70, 229, 0.2)',
                }}
              >
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </div>

              {!isCollapsed && (
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text)',
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user?.name || 'Counsellor'}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      textTransform: 'capitalize',
                      lineHeight: 1.2,
                    }}
                  >
                    {user?.workspaceRole || user?.companyRole || 'Consultant'}
                  </span>
                </div>
              )}
            </Link>

            {!isCollapsed && (
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className="hover:bg-rose-50 hover:text-rose-600 transition-colors"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Legal links in sidebar */}
        {!isCollapsed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px 2px',
              fontSize: 10.5,
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link
                href="/privacy"
                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                className="hover:text-slate-900"
              >
                Privacy
              </Link>
              <span>•</span>
              <Link
                href="/terms"
                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                className="hover:text-slate-900"
              >
                Terms
              </Link>
            </div>
            <span style={{ fontSize: 9.5, opacity: 0.7 }}>v2.2</span>
          </div>
        )}
      </aside>
    </>
  );
}

export default function BottomNav(props) {
  const inShell = useContext(AppShellContext);
  if (inShell && !props.isRootShell) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <BottomNavContent {...props} />
    </Suspense>
  );
}
