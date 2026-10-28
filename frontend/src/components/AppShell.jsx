'use client';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BottomNav, { AppShellContext } from '@/components/BottomNav';
import MobileTopHeader from '@/components/MobileTopHeader';
import TopProgressBar from '@/components/common/TopProgressBar';
import { bootstrapOptions } from '@/lib/queries';

const STANDALONE_ROUTES = [
  '/login',
  '/signup',
  '/privacy',
  '/terms',
  '/data-deletion',
  '/share',
  '/superadmin-dashboard',
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const isStandalone = STANDALONE_ROUTES.some(r => pathname === r || pathname?.startsWith(r + '/'));

  // Pre-seed all CRM startup data with a single consolidated request
  useQuery({
    ...bootstrapOptions(queryClient),
    enabled: !isStandalone && typeof window !== 'undefined' && Boolean(localStorage.getItem('token')),
  });

  if (isStandalone) {
    return (
      <>
        <TopProgressBar />
        {children}
      </>
    );
  }

  // Derive active module from pathname
  let activeModule = 'dashboard';
  if (pathname?.startsWith('/leads')) activeModule = 'leads';
  else if (pathname?.startsWith('/pipeline')) activeModule = 'pipeline';
  else if (pathname?.startsWith('/deals')) activeModule = 'deals';
  else if (pathname?.startsWith('/follow-ups')) activeModule = 'follow_ups';
  else if (pathname?.startsWith('/catalogue') || pathname?.startsWith('/colleges')) activeModule = 'catalogue';
  else if (pathname?.startsWith('/analytics')) activeModule = 'analytics';
  else if (pathname?.startsWith('/campaigns')) activeModule = 'campaigns';
  else if (pathname?.startsWith('/forms')) activeModule = 'forms';
  else if (pathname?.startsWith('/integrations')) activeModule = 'integrations';
  else if (pathname?.startsWith('/plans')) activeModule = 'plans';
  else if (pathname?.startsWith('/profile')) activeModule = 'profile';
  else if (pathname?.startsWith('/templates')) activeModule = 'templates';
  else if (pathname?.startsWith('/whatsapp')) activeModule = 'whatsapp';
  else if (pathname?.startsWith('/email')) activeModule = 'email';
  else if (pathname?.startsWith('/automations')) activeModule = 'automations';
  else if (pathname?.startsWith('/workspace')) activeModule = 'workspace';
  else if (pathname?.startsWith('/commission')) activeModule = 'commission';
  else if (pathname?.startsWith('/groups')) activeModule = 'groups';
  else if (pathname?.startsWith('/notifications')) activeModule = 'notifications';

  return (
    <AppShellContext.Provider value={true}>
      <TopProgressBar />
      <div className="app-container app-shell-root">
        <MobileTopHeader />
        <BottomNav active={activeModule} isRootShell={true} />
        {children}
      </div>
    </AppShellContext.Provider>
  );
}
