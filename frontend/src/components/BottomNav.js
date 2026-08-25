'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getUser } from '@/lib/auth';
import {
  Home, FileText, Users, BarChart2, User, MessageCircle,
  Package, Send, Zap, Shield, Crown, GraduationCap,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import PlanStatusWidget from '@/components/PlanStatusWidget';

const MOBILE_ITEMS = [
  { href: '/dashboard', label: 'Leads', icon: Home, key: 'dashboard' },
  { href: '/integrations', label: 'Ads & APIs', icon: Zap, key: 'integrations' },
  { href: '/catalogue', label: 'Colleges', icon: GraduationCap, key: 'catalogue' },
  { href: '/whatsapp', label: 'Inbox', icon: MessageCircle, key: 'whatsapp' },
  { href: '/admin?tab=profile', label: 'Profile', icon: User, key: 'profile' },
];

const DESKTOP_ITEMS = [
  { href: '/dashboard', label: 'Leads Pipeline', icon: Home, key: 'dashboard' },
  { href: '/catalogue', label: 'Colleges & Courses', icon: GraduationCap, key: 'catalogue' },
  { href: '/integrations', label: 'Ads & Lead Integrations', icon: Zap, key: 'integrations' },
  { href: '/projects', label: 'Products & Packages', icon: Package, key: 'projects' },
  { href: '/whatsapp', label: 'WhatsApp Hub', icon: MessageCircle, key: 'whatsapp' },
  { href: '/campaigns', label: 'Broadcast Campaigns', icon: Send, key: 'campaigns' },
  { href: '/templates', label: 'Message Templates', icon: FileText, key: 'templates' },
  { href: '/groups', label: 'Audience Groups', icon: Users, key: 'groups' },
  { href: '/analytics', label: 'Sales Analytics', icon: BarChart2, key: 'analytics' },
  { href: '/admin?tab=profile', label: 'Organization & Profile', icon: User, key: 'profile' },
];

export default function BottomNav({ active }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isAgencyAdmin, setIsAgencyAdmin] = useState(false);
  const [isEducation, setIsEducation] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [profileHref, setProfileHref] = useState('/admin?tab=profile');

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
    const user = getUser();
    if (user?.role === 'superadmin') {
      setProfileHref('/superadmin-dashboard');
    } else if (user?.companyRole === 'owner' || user?.workStatus === 'company_owner' || user?.role === 'admin') {
      setProfileHref('/admin?tab=profile');
    } else {
      setProfileHref('/profile');
    }
    if (user && (user.role === 'admin' || user.role === 'superadmin' || user.companyRole === 'owner' || user.workStatus === 'company_owner')) {
      setIsAdminUser(true);
    }
    if (user && (user.role === 'admin' || user.role === 'superadmin' || user.companyRole === 'owner' || user.companyRole === 'manager' || user.workStatus === 'company_owner')) {
      setIsAgencyAdmin(true);
    }
    if (String(user?.industryType || '').trim().toLowerCase() === 'education') {
      setIsEducation(true);
    }
  }, []);

  const normalize = (p) => (p || '').replace(/\/$/, '').toLowerCase();
  
  const isLinkActive = (key, href) => {
    if (active === key) return true;
    if (!pathname) return false;
    const normPath = normalize(pathname);
    const normHref = normalize(href?.split('?')[0]);
    if (key === 'profile') {
      if (href?.includes('tab=profile')) {
        return normPath === '/admin' && (typeof window !== 'undefined' && window.location.search.includes('tab=profile'));
      }
      return normPath === normHref;
    }
    if (key === 'admin') {
      return normPath === '/admin' && (typeof window === 'undefined' || !window.location.search.includes('tab=profile'));
    }
    return normPath === normHref;
  };

  // Dynamically filter navigation items based on tenant vertical
  const mobileItems = [
    { href: '/dashboard', label: 'Leads', icon: Home, key: 'dashboard' },
    { href: '/integrations', label: 'Ads & APIs', icon: Zap, key: 'integrations' },
    isEducation
      ? { href: '/catalogue', label: 'Colleges', icon: GraduationCap, key: 'catalogue' }
      : { href: '/projects', label: 'Catalogue', icon: Package, key: 'projects' },
    { href: '/whatsapp', label: 'Inbox', icon: MessageCircle, key: 'whatsapp' },
    { href: profileHref, label: 'Profile', icon: User, key: 'profile' },
  ];

  const desktopItems = [
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
        {isAdminUser && (
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
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', marginBottom: 20, paddingLeft: isCollapsed ? 0 : 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Image
              src="/logo.png"
              alt="SalesCRM Logo"
              width={38}
              height={38}
              style={{ borderRadius: 10, objectFit: 'contain', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}
              priority
            />
            {!isCollapsed && (
              <div>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', display: 'block', lineHeight: 1.15 }}>
                  SalesCRM
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>Universal Sales Engine</span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={toggleCollapse}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              title="Collapse Sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {isCollapsed && (
          <button
            onClick={toggleCollapse}
            style={{ display: 'flex', justifyContent: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '8px 0', marginBottom: 16 }}
            title="Expand Sidebar"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Dynamic Plan / Upgrade Widget in Sidebar */}
        {!isCollapsed && (
          <div style={{ marginBottom: 16, padding: '0 4px' }}>
            <PlanStatusWidget style={{ width: '100%', justifyContent: 'center' }} />
          </div>
        )}

        {/* Menu Navigation Links */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isAdminUser && (
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
                padding: isCollapsed ? '10px 0' : '10px 14px'
              }}
              title="Admin Panel"
            >
              <Crown size={18} color="#f59e0b" />
              {!isCollapsed && <span>Admin Panel</span>}
            </Link>
          )}

          {isAgencyAdmin && (
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
                padding: isCollapsed ? '10px 0' : '10px 14px'
              }}
              title="Agency Control"
            >
              <Shield size={18} color="var(--accent)" />
              {!isCollapsed && <span>Agency Control</span>}
            </Link>
          )}

          {desktopItems.map(({ href, label, icon: Icon, key }) => {
            const activeState = isLinkActive(key, href);
            return (
              <Link
                key={key}
                href={href}
                className={`sidebar-nav-link ${activeState ? 'active' : ''}`}
                style={{
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '10px 0' : '10px 14px'
                }}
                title={label}
              >
                <Icon size={18} color={activeState ? 'var(--accent)' : 'currentColor'} />
                {!isCollapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Legal links in sidebar */}
        {!isCollapsed && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 8px 4px',
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 'auto'
          }}>
            <Link href="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }} className="hover:text-white">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }} className="hover:text-white">
              Terms
            </Link>
          </div>
        )}

        {/* Footer version badge */}
        {!isCollapsed && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            padding: '8px 8px 0',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>v2.2.0 • SaaS Edition</span>
            <span style={{ fontSize: 9, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--green)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>PRO</span>
          </div>
        )}
      </aside>
    </>
  );
}
