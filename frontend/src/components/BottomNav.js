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
} from '@/lib/auth';
import api from '@/lib/api';
import {
  Home, FileText, Users, BarChart2, User, MessageCircle,
  Package, Send, Zap, Shield, Crown, GraduationCap,
  ChevronLeft, ChevronRight, Building2, Calendar, TrendingUp,
  Award, MapPin, ChevronDown, Sliders, Bell, DollarSign,
  Percent, CheckSquare, Layers
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
  const [profileHref, setProfileHref] = useState('/profile');

  // Accordion states for sub-items
  const [leadsExpanded, setLeadsExpanded] = useState(true);
  const [teamExpanded, setTeamExpanded] = useState(false);
  const [requirementsExpanded, setRequirementsExpanded] = useState(false);
  const [siteVisitsExpanded, setSiteVisitsExpanded] = useState(false);
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [eoiExpanded, setEoiExpanded] = useState(false);
  const [bookingsExpanded, setBookingsExpanded] = useState(false);
  const [paymentsExpanded, setPaymentsExpanded] = useState(false);
  const [commissionExpanded, setCommissionExpanded] = useState(false);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  const [generalControlsExpanded, setGeneralControlsExpanded] = useState(false);

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
      {/* Mobile Bottom Navigation (Visible only on small screens < 768px) */}
      <nav className="bottom-nav flex md:hidden">
        {mobileItems.map(({ href, label, icon: Icon, key }) => {
          const activeState = isLinkActive(key, href);
          return (
            <Link
              key={key}
              href={href}
              className={`bottom-nav-link ${activeState ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
        {isSuper && (
          <Link
            href="/admin"
            className={`bottom-nav-link ${isLinkActive('admin', '/admin') ? 'active' : ''}`}
            style={{ color: '#f59e0b' }}
          >
            <Crown size={20} />
            <span>Admin</span>
          </Link>
        )}
      </nav>

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
            isRealEstate ? (
              /* REAL ESTATE MANAGER COMPLETE STRUCTURED NAVIGATION */
              <>
                {/* 1. DASHBOARD */}
                <Link
                  href="/dashboard"
                  className={`sidebar-nav-link ${isLinkActive('dashboard', '/dashboard') ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '9px 0' : '9px 12px',
                  }}
                  title="Manager Dashboard"
                >
                  <Home size={17} color={isLinkActive('dashboard', '/dashboard') ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span style={{ fontWeight: 600 }}>Dashboard</span>}
                </Link>

                {/* 2. LEADS (WITH SUB-ITEMS: TEAM LEADS, UNASSIGNED, HOT, FOLLOW-UPS, DISTRIBUTION) */}
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
                      href="/leads?tab=team_leads"
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
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && leadsExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/leads?tab=team_leads" className={`sidebar-nav-link ${normalize(pathname) === '/leads' && (currentTab === 'team_leads' || !currentTab) ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Team Leads</span>
                      </Link>
                      <Link href="/leads?tab=unassigned" className={`sidebar-nav-link ${normalize(pathname) === '/leads' && currentTab === 'unassigned' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Unassigned Leads</span>
                      </Link>
                      <Link href="/leads?tab=hot" className={`sidebar-nav-link ${normalize(pathname) === '/leads' && currentTab === 'hot' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Hot Leads</span>
                      </Link>
                      <Link href="/follow-ups" className={`sidebar-nav-link ${normalize(pathname) === '/follow-ups' || (normalize(pathname) === '/leads' && currentTab === 'followups') ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Follow-ups</span>
                      </Link>
                      <Link href="/leads?tab=distribution" className={`sidebar-nav-link ${normalize(pathname) === '/leads' && currentTab === 'distribution' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Lead Distribution</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 3. MY TEAM (WITH SUB-ITEMS: MEMBERS, PERFORMANCE, WORKLOAD, ATTENDANCE/ACTIVITY) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className={`sidebar-nav-link ${normalize(pathname) === '/agency' ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '9px 0' : '9px 12px',
                      cursor: 'pointer',
                    }}
                    title="My Team"
                  >
                    <Link
                      href="/agency?tab=members"
                      onClick={() => setTeamExpanded(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                    >
                      <Shield size={17} color={normalize(pathname) === '/agency' ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span style={{ fontWeight: 600 }}>My Team</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTeamExpanded(!teamExpanded);
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
                            transform: teamExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && teamExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/agency?tab=members" className={`sidebar-nav-link ${normalize(pathname) === '/agency' && (currentTab === 'members' || !currentTab) ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Team Members</span>
                      </Link>
                      <Link href="/agency?tab=performance" className={`sidebar-nav-link ${normalize(pathname) === '/agency' && currentTab === 'performance' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Agent Performance</span>
                      </Link>
                      <Link href="/agency?tab=workload" className={`sidebar-nav-link ${normalize(pathname) === '/agency' && currentTab === 'workload' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Agent Workload</span>
                      </Link>
                      <Link href="/agency?tab=activity" className={`sidebar-nav-link ${normalize(pathname) === '/agency' && currentTab === 'activity' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Attendance / Activity</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 4. REQUIREMENTS (WITH SUB-ITEMS: ACTIVE, HIGH PRIORITY, MATCHING) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className={`sidebar-nav-link ${normalize(pathname) === '/requirements' ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '9px 0' : '9px 12px',
                      cursor: 'pointer',
                    }}
                    title="Requirements"
                  >
                    <Link
                      href="/requirements?tab=active"
                      onClick={() => setRequirementsExpanded(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                    >
                      <CheckSquare size={17} color={normalize(pathname) === '/requirements' ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span style={{ fontWeight: 600 }}>Requirements</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setRequirementsExpanded(!requirementsExpanded);
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
                            transform: requirementsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && requirementsExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/requirements?tab=active" className={`sidebar-nav-link ${normalize(pathname) === '/requirements' && (currentTab === 'active' || !currentTab) ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Active Requirements</span>
                      </Link>
                      <Link href="/requirements?tab=high_priority" className={`sidebar-nav-link ${normalize(pathname) === '/requirements' && currentTab === 'high_priority' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>High Priority</span>
                      </Link>
                      <Link href="/requirements?tab=matching" className={`sidebar-nav-link ${normalize(pathname) === '/requirements' && currentTab === 'matching' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Property Matching</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 5. SITE VISITS (WITH SUB-ITEMS: TODAY, UPCOMING, COMPLETED, NO SHOW, CONVERSION) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className={`sidebar-nav-link ${normalize(pathname) === '/site-visits' ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '9px 0' : '9px 12px',
                      cursor: 'pointer',
                    }}
                    title="Site Visits"
                  >
                    <Link
                      href="/site-visits?tab=today"
                      onClick={() => setSiteVisitsExpanded(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                    >
                      <MapPin size={17} color={normalize(pathname) === '/site-visits' ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span style={{ fontWeight: 600 }}>Site Visits</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSiteVisitsExpanded(!siteVisitsExpanded);
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
                            transform: siteVisitsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && siteVisitsExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/site-visits?tab=today" className={`sidebar-nav-link ${normalize(pathname) === '/site-visits' && (currentTab === 'today' || !currentTab) ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Today's Visits</span>
                      </Link>
                      <Link href="/site-visits?tab=upcoming" className={`sidebar-nav-link ${normalize(pathname) === '/site-visits' && currentTab === 'upcoming' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Upcoming</span>
                      </Link>
                      <Link href="/site-visits?tab=completed" className={`sidebar-nav-link ${normalize(pathname) === '/site-visits' && currentTab === 'completed' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Completed</span>
                      </Link>
                      <Link href="/site-visits?tab=no_show" className={`sidebar-nav-link ${normalize(pathname) === '/site-visits' && currentTab === 'no_show' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>No Show</span>
                      </Link>
                      <Link href="/site-visits?tab=conversion" className={`sidebar-nav-link ${normalize(pathname) === '/site-visits' && currentTab === 'conversion' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Conversion</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 6. PIPELINE (WITH SUB-ITEMS: KANBAN, TEAM PIPELINE, DEAL FORECAST) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className={`sidebar-nav-link ${normalize(pathname) === '/pipeline' ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '9px 0' : '9px 12px',
                      cursor: 'pointer',
                    }}
                    title="Pipeline"
                  >
                    <Link
                      href="/pipeline?tab=kanban"
                      onClick={() => setPipelineExpanded(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                    >
                      <TrendingUp size={17} color={normalize(pathname) === '/pipeline' ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span style={{ fontWeight: 600 }}>Pipeline</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPipelineExpanded(!pipelineExpanded);
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
                            transform: pipelineExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && pipelineExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/pipeline?tab=kanban" className={`sidebar-nav-link ${normalize(pathname) === '/pipeline' && (currentTab === 'kanban' || !currentTab) ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Kanban</span>
                      </Link>
                      <Link href="/pipeline?tab=team_pipeline" className={`sidebar-nav-link ${normalize(pathname) === '/pipeline' && currentTab === 'team_pipeline' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>My Team Pipeline</span>
                      </Link>
                      <Link href="/pipeline?tab=forecast" className={`sidebar-nav-link ${normalize(pathname) === '/pipeline' && currentTab === 'forecast' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Deal Forecast</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 7. PROJECTS & INVENTORY (WITH SUB-ITEMS: PROJECTS, INVENTORY, AVAILABILITY) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className={`sidebar-nav-link ${normalize(pathname) === '/projects' ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '9px 0' : '9px 12px',
                      cursor: 'pointer',
                    }}
                    title="Projects"
                  >
                    <Link
                      href="/projects?tab=projects"
                      onClick={() => setProjectsExpanded(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                    >
                      <Building2 size={17} color={normalize(pathname) === '/projects' ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span style={{ fontWeight: 600 }}>Projects</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setProjectsExpanded(!projectsExpanded);
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
                            transform: projectsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && projectsExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/projects?tab=projects" className={`sidebar-nav-link ${normalize(pathname) === '/projects' && (currentTab === 'projects' || !currentTab) ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Projects</span>
                      </Link>
                      <Link href="/projects?tab=inventory" className={`sidebar-nav-link ${normalize(pathname) === '/projects' && currentTab === 'inventory' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Inventory</span>
                      </Link>
                      <Link href="/projects?tab=availability" className={`sidebar-nav-link ${normalize(pathname) === '/projects' && currentTab === 'availability' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Availability</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 8. EOI (WITH SUB-ITEMS: ALL, PENDING, CONFIRMED, EXPIRING) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className={`sidebar-nav-link ${normalize(pathname) === '/eoi' ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '9px 0' : '9px 12px',
                      cursor: 'pointer',
                    }}
                    title="EOI"
                  >
                    <Link
                      href="/eoi?tab=all"
                      onClick={() => setEoiExpanded(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                    >
                      <FileText size={17} color={normalize(pathname) === '/eoi' ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span style={{ fontWeight: 600 }}>EOI</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEoiExpanded(!eoiExpanded);
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
                            transform: eoiExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && eoiExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/eoi?tab=all" className={`sidebar-nav-link ${normalize(pathname) === '/eoi' && (currentTab === 'all' || !currentTab) ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>All EOI</span>
                      </Link>
                      <Link href="/eoi?tab=pending" className={`sidebar-nav-link ${normalize(pathname) === '/eoi' && currentTab === 'pending' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Pending</span>
                      </Link>
                      <Link href="/eoi?tab=confirmed" className={`sidebar-nav-link ${normalize(pathname) === '/eoi' && currentTab === 'confirmed' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Confirmed</span>
                      </Link>
                      <Link href="/eoi?tab=expiring" className={`sidebar-nav-link ${normalize(pathname) === '/eoi' && currentTab === 'expiring' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Expiring</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 9. BOOKINGS (WITH SUB-ITEMS: TEAM BOOKINGS, PENDING, CONFIRMED, CANCELLED) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className={`sidebar-nav-link ${normalize(pathname) === '/bookings' ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '9px 0' : '9px 12px',
                      cursor: 'pointer',
                    }}
                    title="Bookings"
                  >
                    <Link
                      href="/bookings?tab=team"
                      onClick={() => setBookingsExpanded(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                    >
                      <Award size={17} color={normalize(pathname) === '/bookings' ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span style={{ fontWeight: 600 }}>Bookings</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBookingsExpanded(!bookingsExpanded);
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
                            transform: bookingsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && bookingsExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/bookings?tab=team" className={`sidebar-nav-link ${normalize(pathname) === '/bookings' && (currentTab === 'team' || !currentTab) ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Team Bookings</span>
                      </Link>
                      <Link href="/bookings?tab=pending" className={`sidebar-nav-link ${normalize(pathname) === '/bookings' && currentTab === 'pending' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Pending</span>
                      </Link>
                      <Link href="/bookings?tab=confirmed" className={`sidebar-nav-link ${normalize(pathname) === '/bookings' && currentTab === 'confirmed' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Confirmed</span>
                      </Link>
                      <Link href="/bookings?tab=cancelled" className={`sidebar-nav-link ${normalize(pathname) === '/bookings' && currentTab === 'cancelled' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Cancelled</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 10. PAYMENTS (WITH SUB-ITEMS: DUE, OVERDUE, COLLECTIONS) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className={`sidebar-nav-link ${normalize(pathname) === '/payments' ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '9px 0' : '9px 12px',
                      cursor: 'pointer',
                    }}
                    title="Payments"
                  >
                    <Link
                      href="/payments?tab=due"
                      onClick={() => setPaymentsExpanded(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                    >
                      <DollarSign size={17} color={normalize(pathname) === '/payments' ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span style={{ fontWeight: 600 }}>Payments</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPaymentsExpanded(!paymentsExpanded);
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
                            transform: paymentsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && paymentsExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/payments?tab=due" className={`sidebar-nav-link ${normalize(pathname) === '/payments' && (currentTab === 'due' || !currentTab) ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Due</span>
                      </Link>
                      <Link href="/payments?tab=overdue" className={`sidebar-nav-link ${normalize(pathname) === '/payments' && currentTab === 'overdue' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Overdue</span>
                      </Link>
                      <Link href="/payments?tab=collections" className={`sidebar-nav-link ${normalize(pathname) === '/payments' && currentTab === 'collections' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Collections</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 11. COMMISSION (WITH SUB-ITEMS: TEAM COMMISSION, PAYOUT STATUS) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className={`sidebar-nav-link ${normalize(pathname) === '/commission' ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '9px 0' : '9px 12px',
                      cursor: 'pointer',
                    }}
                    title="Commission"
                  >
                    <Link
                      href="/commission?tab=team"
                      onClick={() => setCommissionExpanded(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                    >
                      <Percent size={17} color={normalize(pathname) === '/commission' ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span style={{ fontWeight: 600 }}>Commission</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCommissionExpanded(!commissionExpanded);
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
                            transform: commissionExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && commissionExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/commission?tab=team" className={`sidebar-nav-link ${normalize(pathname) === '/commission' && (currentTab === 'team' || !currentTab) ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Team Commission</span>
                      </Link>
                      <Link href="/commission?tab=payouts" className={`sidebar-nav-link ${normalize(pathname) === '/commission' && currentTab === 'payouts' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Payout Status</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 12. ANALYTICS (WITH SUB-ITEMS: TEAM PERFORMANCE, LEAD CONVERSION, SITE VISIT CONVERSION, EOI CONVERSION, BOOKING CONVERSION) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    className={`sidebar-nav-link ${normalize(pathname) === '/analytics' ? 'active' : ''}`}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '9px 0' : '9px 12px',
                      cursor: 'pointer',
                    }}
                    title="Analytics"
                  >
                    <Link
                      href="/analytics?tab=performance"
                      onClick={() => setAnalyticsExpanded(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1 }}
                    >
                      <BarChart2 size={17} color={normalize(pathname) === '/analytics' ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span style={{ fontWeight: 600 }}>Analytics</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setAnalyticsExpanded(!analyticsExpanded);
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
                            transform: analyticsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>
                  {!isCollapsed && analyticsExpanded && (
                    <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 16 }}>
                      <Link href="/analytics?tab=performance" className={`sidebar-nav-link ${normalize(pathname) === '/analytics' && (currentTab === 'performance' || !currentTab) ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Team Performance</span>
                      </Link>
                      <Link href="/analytics?tab=leads" className={`sidebar-nav-link ${normalize(pathname) === '/analytics' && currentTab === 'leads' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Lead Conversion</span>
                      </Link>
                      <Link href="/analytics?tab=site_visits" className={`sidebar-nav-link ${normalize(pathname) === '/analytics' && currentTab === 'site_visits' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Site Visit Conversion</span>
                      </Link>
                      <Link href="/analytics?tab=eoi" className={`sidebar-nav-link ${normalize(pathname) === '/analytics' && currentTab === 'eoi' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>EOI Conversion</span>
                      </Link>
                      <Link href="/analytics?tab=bookings" className={`sidebar-nav-link ${normalize(pathname) === '/analytics' && currentTab === 'bookings' ? 'active' : ''}`} style={{ padding: '6px 10px', fontSize: 12, minHeight: 28 }}>
                        <span>Booking Conversion</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 13. GENERAL SETTINGS / WHATSAPP HUB (WITH SUB-ITEMS: WHATSAPP HUB, BROADCAST, TEMPLATES, AUDIENCE GROUPS) */}
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
                        <span>Broadcast</span>
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
          ) : (
            /* Render Owner / SuperAdmin Navigation */
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
          )}
        </div>

        {/* Legal links in sidebar */}
        {!isCollapsed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 8px 4px',
              fontSize: 11,
              color: 'var(--text-muted)',
              marginTop: 'auto',
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
