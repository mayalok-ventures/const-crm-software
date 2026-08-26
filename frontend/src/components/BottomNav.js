'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  getUser,
  isSuperAdmin,
  isOwner,
  isManager,
  isAgent,
  getUserRole,
} from '@/lib/auth';
import {
  Home, FileText, Users, BarChart2, User, MessageCircle,
  Package, Send, Zap, Shield, Crown, GraduationCap,
  ChevronLeft, ChevronRight, Building2
} from 'lucide-react';
import PlanStatusWidget from '@/components/PlanStatusWidget';

export default function BottomNav({ active }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [isSuper, setIsSuper] = useState(false);
  const [isTenantOwner, setIsTenantOwner] = useState(false);
  const [isTenantManager, setIsTenantManager] = useState(false);
  const [isTenantAgent, setIsTenantAgent] = useState(false);
  const [isEducation, setIsEducation] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [profileHref, setProfileHref] = useState('/profile');

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

    setIsSuper(superAdminCheck);
    setIsTenantOwner(ownerCheck);
    setIsTenantManager(managerCheck);
    setIsTenantAgent(agentCheck);

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
    const normHref = normalize(href?.split('?')[0]);
    return normPath === normHref;
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

  // Navigation Items for Agents (Clean: No Ads/Integrations, WhatsApp under General Controls, Profile single entry)
  const agentMobileItems = [
    { href: '/dashboard', label: 'Leads', icon: Home, key: 'dashboard' },
    isEducation
      ? { href: '/catalogue', label: 'Colleges', icon: GraduationCap, key: 'catalogue' }
      : { href: '/projects', label: 'Catalogue', icon: Package, key: 'projects' },
    { href: '/whatsapp', label: 'Inbox', icon: MessageCircle, key: 'whatsapp' },
    { href: '/profile', label: 'Profile', icon: User, key: 'profile' },
  ];

  const agentDesktopSections = [
    {
      title: null,
      items: [
        { href: '/dashboard', label: 'Leads Pipeline', icon: Home, key: 'dashboard' },
        ...(isEducation
          ? [{ href: '/catalogue', label: 'Colleges & Courses', icon: GraduationCap, key: 'catalogue' }]
          : [{ href: '/projects', label: 'Products & Packages', icon: Package, key: 'projects' }]),
      ],
    },
    {
      title: 'General Controls',
      items: [
        { href: '/whatsapp', label: 'WhatsApp Hub', icon: MessageCircle, key: 'whatsapp' },
      ],
    },
    {
      title: null,
      items: [
        { href: '/profile', label: 'Profile', icon: User, key: 'profile' },
      ],
    },
  ];

  // Navigation Items for Managers (Staff oversight, broadcast templates, analytics, profile)
  const managerMobileItems = [
    { href: '/dashboard', label: 'Leads', icon: Home, key: 'dashboard' },
    { href: '/whatsapp', label: 'Inbox', icon: MessageCircle, key: 'whatsapp' },
    isEducation
      ? { href: '/catalogue', label: 'Colleges', icon: GraduationCap, key: 'catalogue' }
      : { href: '/projects', label: 'Catalogue', icon: Package, key: 'projects' },
    { href: '/analytics', label: 'Analytics', icon: BarChart2, key: 'analytics' },
    { href: '/profile', label: 'Profile', icon: User, key: 'profile' },
  ];

  const managerDesktopItems = [
    { href: '/dashboard', label: 'Leads Pipeline', icon: Home, key: 'dashboard' },
    ...(isEducation
      ? [{ href: '/catalogue', label: 'Colleges & Courses', icon: GraduationCap, key: 'catalogue' }]
      : [{ href: '/projects', label: 'Products & Packages', icon: Package, key: 'projects' }]),
    { href: '/whatsapp', label: 'WhatsApp Hub', icon: MessageCircle, key: 'whatsapp' },
    { href: '/campaigns', label: 'Broadcast Campaigns', icon: Send, key: 'campaigns' },
    { href: '/templates', label: 'Message Templates', icon: FileText, key: 'templates' },
    { href: '/groups', label: 'Audience Groups', icon: Users, key: 'groups' },
    { href: '/analytics', label: 'Sales Analytics', icon: BarChart2, key: 'analytics' },
    { href: '/profile', label: 'Profile', icon: User, key: 'profile' },
  ];

  // Navigation Items for Owners / SuperAdmins (Full suite)
  const ownerMobileItems = [
    { href: '/dashboard', label: 'Leads', icon: Home, key: 'dashboard' },
    { href: '/integrations', label: 'Ads & APIs', icon: Zap, key: 'integrations' },
    isEducation
      ? { href: '/catalogue', label: 'Colleges', icon: GraduationCap, key: 'catalogue' }
      : { href: '/projects', label: 'Catalogue', icon: Package, key: 'projects' },
    { href: '/whatsapp', label: 'Inbox', icon: MessageCircle, key: 'whatsapp' },
    { href: profileHref, label: 'Profile', icon: User, key: 'profile' },
  ];

  const ownerDesktopItems = [
    { href: '/dashboard', label: 'Leads Pipeline', icon: Home, key: 'dashboard' },
    ...(isEducation
      ? [{ href: '/catalogue', label: 'Colleges & Courses', icon: GraduationCap, key: 'catalogue' }]
      : [{ href: '/projects', label: 'Products & Packages', icon: Package, key: 'projects' }]),
    { href: '/integrations', label: 'Ads & Lead Integrations', icon: Zap, key: 'integrations' },
    { href: '/whatsapp', label: 'WhatsApp Hub', icon: MessageCircle, key: 'whatsapp' },
    { href: '/campaigns', label: 'Broadcast Campaigns', icon: Send, key: 'campaigns' },
    { href: '/templates', label: 'Message Templates', icon: FileText, key: 'templates' },
    { href: '/groups', label: 'Audience Groups', icon: Users, key: 'groups' },
    { href: '/analytics', label: 'Sales Analytics', icon: BarChart2, key: 'analytics' },
    { href: profileHref, label: 'Organization & Profile', icon: User, key: 'profile' },
  ];

  const mobileItems = isTenantAgent
    ? agentMobileItems
    : isTenantManager
    ? managerMobileItems
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
            marginBottom: 16,
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
                {isTenantAgent ? 'Sales Workspace' : isTenantManager ? 'Management Workspace' : 'Organization Workspace'}
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
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

          {/* Render Agent Structured Navigation */}
          {isTenantAgent ? (
            agentDesktopSections.map((section, sIdx) => (
              <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {section.title && !isCollapsed && (
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '10px 12px 4px',
                    }}
                  >
                    {section.title}
                  </div>
                )}
                {section.items.map(({ href, label, icon: Icon, key }) => {
                  const activeState = isLinkActive(key, href);
                  return (
                    <Link
                      key={key}
                      href={href}
                      className={`sidebar-nav-link ${activeState ? 'active' : ''}`}
                      style={{
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        padding: isCollapsed ? '10px 0' : '10px 14px',
                      }}
                      title={label}
                    >
                      <Icon size={18} color={activeState ? 'var(--accent)' : 'currentColor'} />
                      {!isCollapsed && <span>{label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))
          ) : isTenantManager ? (
            /* Render Manager Structured Navigation */
            managerDesktopItems.map(({ href, label, icon: Icon, key }) => {
              const activeState = isLinkActive(key, href);
              return (
                <Link
                  key={key}
                  href={href}
                  className={`sidebar-nav-link ${activeState ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '10px 0' : '10px 14px',
                  }}
                  title={label}
                >
                  <Icon size={18} color={activeState ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>{label}</span>}
                </Link>
              );
            })
          ) : (
            /* Render Owner / SuperAdmin Navigation */
            ownerDesktopItems.map(({ href, label, icon: Icon, key }) => {
              const activeState = isLinkActive(key, href);
              return (
                <Link
                  key={key}
                  href={href}
                  className={`sidebar-nav-link ${activeState ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '10px 0' : '10px 14px',
                  }}
                  title={label}
                >
                  <Icon size={18} color={activeState ? 'var(--accent)' : 'currentColor'} />
                  {!isCollapsed && <span>{label}</span>}
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
