import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import BottomNav from '../../src/components/BottomNav';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/leads',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    prefetchQuery: vi.fn(),
  }),
}));

vi.mock('@/lib/auth', () => ({
  getUser: () => ({
    _id: 'user_1',
    name: 'Rahul Agent',
    role: 'counsellor',
    workspaceRole: 'agent',
    companyInfo: { companyName: 'Global Edu' },
  }),
  isSuperAdmin: () => false,
  isOwner: () => false,
  isManager: () => false,
  isAgent: () => true,
  getUserRole: () => 'counsellor',
  clearAuth: vi.fn(),
  canAccessRoute: (user, href) => {
    // Standard counsellor routes
    return ['/dashboard', '/leads', '/pipeline', '/follow-ups', '/catalogue'].includes(href);
  },
  hasPermission: () => true,
}));

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { count: 0 } }),
  },
  cachedGet: vi.fn().mockResolvedValue({ count: 0 }),
}));

vi.mock('@/components/PlanStatusWidget', () => ({
  default: () => <div data-testid="plan-status-widget">Plan Widget</div>,
}));

describe('BottomNav Component Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders mobile navigation container with accessible role and label', () => {
    render(<BottomNav isRootShell={true} />);

    const nav = screen.getByRole('navigation', { name: /Mobile Navigation/i });
    expect(nav).toBeDefined();
    expect(nav.classList.contains('bottom-nav')).toBe(true);
  });

  it('highlights current active route (/leads) with active styling', () => {
    render(<BottomNav isRootShell={true} />);

    const leadsLinks = screen.getAllByRole('link', { name: /Leads/i });
    const mobileLeadsLink = leadsLinks.find(link => link.classList.contains('bottom-nav-link'));

    expect(mobileLeadsLink).toBeDefined();
    expect(mobileLeadsLink.classList.contains('active')).toBe(true);
  });

  it('limits mobile quick items to top accessible routes for counsellors', () => {
    render(<BottomNav isRootShell={true} />);

    // Quick accessible items in mobile bottom nav: Home, Leads, Pipeline, Follow-ups
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Leads').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pipeline').length).toBeGreaterThan(0);
  });
});
