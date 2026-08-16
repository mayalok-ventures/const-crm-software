'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { getUser } from '@/lib/auth';
import {
  Home, FileText, Users, BarChart2, User, MessageCircle,
  Package, Send, Zap, Shield, Crown, ChevronRight
} from 'lucide-react';
import PlanStatusWidget from '@/components/PlanStatusWidget';

const MOBILE_ITEMS = [
  { href: '/dashboard', label: 'Leads', icon: Home, key: 'dashboard' },
  { href: '/projects', label: 'Catalog', icon: Package, key: 'projects' },
  { href: '/whatsapp', label: 'Inbox', icon: MessageCircle, key: 'whatsapp' },
  { href: '/templates', label: 'Templates', icon: FileText, key: 'templates' },
  { href: '/profile', label: 'Profile', icon: User, key: 'profile' },
];

const DESKTOP_ITEMS = [
  { href: '/dashboard', label: 'Leads Pipeline', icon: Home, key: 'dashboard' },
  { href: '/projects', label: 'Products & Packages', icon: Package, key: 'projects' },
  { href: '/whatsapp', label: 'WhatsApp Hub', icon: MessageCircle, key: 'whatsapp' },
  { href: '/campaigns', label: 'Broadcast Campaigns', icon: Send, key: 'campaigns' },
  { href: '/templates', label: 'Message Templates', icon: FileText, key: 'templates' },
  { href: '/groups', label: 'Audience Groups', icon: Users, key: 'groups' },
  { href: '/analytics', label: 'Sales Analytics', icon: BarChart2, key: 'analytics' },
  { href: '/profile', label: 'Organization & Profile', icon: User, key: 'profile' },
];

export default function BottomNav({ active }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (user && (user.role === 'superadmin' || user.isAdmin)) {
      setIsSuperAdmin(true);
    }
  }, []);

  const handleMobileNav = (e, href) => {
    // Proactively route on touch/click to prevent any link-hijacking or event capture bugs
    if (pathname !== href) {
      router.push(href);
    }
  };

  return (
    <>
      {/* Mobile Bottom Navigation (Visible only on mobile screens < 768px) */}
      <nav
        className="bottom-nav md:hidden"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: '62px',
          zIndex: 99999,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-around',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.06)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxSizing: 'border-box',
          touchAction: 'manipulation',
        }}
      >
        {MOBILE_ITEMS.map(({ href, label, icon: Icon, key }) => {
          const isActive = active === key || pathname === href;
          return (
            <Link
              key={key}
              href={href}
              prefetch={true}
              onClick={(e) => handleMobileNav(e, href)}
              className={`nav-item ${isActive ? 'active' : ''}`}
              style={{
                flex: '1 1 0%',
                height: '100%',
                width: '100%',
                minHeight: '54px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                cursor: 'pointer',
                pointerEvents: 'auto',
                padding: '6px 2px',
                gap: '3px',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '11px',
                minWidth: 0,
                touchAction: 'manipulation',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                boxSizing: 'border-box',
              }}
            >
              <Icon size={20} style={{ pointerEvents: 'none', flexShrink: 0 }} />
              <span style={{ pointerEvents: 'none', lineHeight: 1, whiteSpace: 'nowrap' }}>{label}</span>
            </Link>
          );
        })}
        {isSuperAdmin && (
          <Link
            href="/superadmin-dashboard"
            prefetch={true}
            onClick={(e) => handleMobileNav(e, '/superadmin-dashboard')}
            className={`nav-item ${active === 'superadmin' || pathname === '/superadmin-dashboard' ? 'active' : ''}`}
            style={{
              flex: '1 1 0%',
              height: '100%',
              width: '100%',
              minHeight: '54px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto',
              padding: '6px 2px',
              gap: '3px',
              color: '#f59e0b',
              fontWeight: 700,
              fontSize: '11px',
              minWidth: 0,
              touchAction: 'manipulation',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              boxSizing: 'border-box',
            }}
          >
            <Crown size={20} style={{ pointerEvents: 'none', flexShrink: 0 }} />
            <span style={{ pointerEvents: 'none', lineHeight: 1, whiteSpace: 'nowrap' }}>Admin</span>
          </Link>
        )}
      </nav>

      {/* Desktop Sidebar Navigation (Visible only on desktop screens >= 768px) */}
      <aside className="sidebar-nav hidden md:flex">
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingLeft: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Image
              src="/logo.png"
              alt="SalesCRM Logo"
              width={38}
              height={38}
              style={{ borderRadius: 10, objectFit: 'contain', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}
              priority
            />
            <div>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', display: 'block', lineHeight: 1.15 }}>
                SalesCRM
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>Universal Sales Engine</span>
            </div>
          </div>
        </div>

        {/* Dynamic Plan / Upgrade Widget in Sidebar */}
        <div style={{ marginBottom: 16, padding: '0 4px' }}>
          <PlanStatusWidget style={{ width: '100%', justifyContent: 'center' }} />
        </div>

        {/* Menu Navigation Links */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {isSuperAdmin && (
            <Link
              href="/superadmin-dashboard"
              prefetch={true}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                textDecoration: 'none',
                marginBottom: 8,
              }}
            >
              <Crown size={18} color="#f59e0b" />
              <span>SuperAdmin Panel</span>
            </Link>
          )}

          {DESKTOP_ITEMS.map(({ href, label, icon: Icon, key }) => {
            const isActive = active === key || pathname === href;
            return (
              <Link
                key={key}
                href={href}
                prefetch={true}
                className={`nav-item ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  background: isActive ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={18} color={isActive ? 'var(--accent)' : 'currentColor'} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer version badge */}
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          padding: '10px 8px 0',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>v2.2.0 • SaaS Edition</span>
          <span style={{ fontSize: 9, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--green)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>PRO</span>
        </div>
      </aside>
    </>
  );
}
