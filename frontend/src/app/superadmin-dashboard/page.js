'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser, clearAuth } from '@/lib/auth';

// Super Admin Components
import SuperAdminSidebar from '@/components/superadmin/SuperAdminSidebar';
import SuperAdminHeader from '@/components/superadmin/SuperAdminHeader';
import SuperAdminGlobalSearch from '@/components/superadmin/SuperAdminGlobalSearch';
import SupportModeBanner from '@/components/superadmin/SupportModeBanner';
import TenantDetailModal from '@/components/superadmin/TenantDetailModal';

// Super Admin Modules
import SuperAdminOverviewModule from '@/components/superadmin/modules/SuperAdminOverviewModule';
import SuperAdminOrganisationsModule from '@/components/superadmin/modules/SuperAdminOrganisationsModule';
import SuperAdminUsersModule from '@/components/superadmin/modules/SuperAdminUsersModule';
import SuperAdminRevenueModule from '@/components/superadmin/modules/SuperAdminRevenueModule';
import SuperAdminGlobalLeadsModule from '@/components/superadmin/modules/SuperAdminGlobalLeadsModule';
import SuperAdminIntegrationsModule from '@/components/superadmin/modules/SuperAdminIntegrationsModule';
import SuperAdminSystemHealthModule from '@/components/superadmin/modules/SuperAdminSystemHealthModule';
import SuperAdminErrorLogsModule from '@/components/superadmin/modules/SuperAdminErrorLogsModule';
import SuperAdminAuditModule from '@/components/superadmin/modules/SuperAdminAuditModule';
import SuperAdminFeatureFlagsModule from '@/components/superadmin/modules/SuperAdminFeatureFlagsModule';
import SuperAdminBroadcastModule from '@/components/superadmin/modules/SuperAdminBroadcastModule';

function SuperAdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation & UI States
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Data States
  const [overviewData, setOverviewData] = useState(null);
  const [organisations, setOrganisations] = useState([]);
  const [orgPagination, setOrgPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [orgSearch, setOrgSearch] = useState('');
  const [orgStatusFilter, setOrgStatusFilter] = useState('all');

  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  const [revenueData, setRevenueData] = useState(null);
  const [globalLeads, setGlobalLeads] = useState([]);
  const [leadsPagination, setLeadsPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStageFilter, setLeadStageFilter] = useState('all');
  const [leadSourceFilter, setLeadSourceFilter] = useState('all');

  const [integrationsTelemetry, setIntegrationsTelemetry] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [errorLogs, setErrorLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [featureFlags, setFeatureFlags] = useState([]);

  // Inspection & Impersonation Modal States
  const [selectedTenantData, setSelectedTenantData] = useState(null);
  const [impersonationSession, setImpersonationSession] = useState(null);

  // Keyboard shortcut for search (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auth & Permissions check
  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'superadmin') {
      toast.error('Access restricted to Platform SuperAdmins');
      router.replace('/admin');
      return;
    }
    setCurrentUser(user);
    setLoading(false);
  }, [router]);

  // Sync tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Data Fetching Router
  const fetchTabData = useCallback(async (tabToFetch = activeTab) => {
    setRefreshing(true);
    try {
      if (tabToFetch === 'overview') {
        const { data } = await api.get('/super-admin/overview');
        if (data.success) setOverviewData(data);
      } else if (tabToFetch === 'organisations') {
        const { data } = await api.get(
          `/super-admin/organisations?page=${orgPagination.page}&search=${encodeURIComponent(orgSearch)}&status=${orgStatusFilter}`
        );
        if (data.success) {
          setOrganisations(data.organisations || []);
          setOrgPagination(data.pagination || { page: 1, total: 0, pages: 1 });
        }
      } else if (tabToFetch === 'users') {
        const { data } = await api.get(
          `/super-admin/users?page=${usersPagination.page}&search=${encodeURIComponent(userSearch)}&role=${userRoleFilter}`
        );
        if (data.success) {
          setUsers(data.users || []);
          setUsersPagination(data.pagination || { page: 1, total: 0, pages: 1 });
        }
      } else if (tabToFetch === 'revenue') {
        const { data } = await api.get('/super-admin/revenue');
        if (data.success) setRevenueData(data);
      } else if (tabToFetch === 'leads') {
        const { data } = await api.get(
          `/super-admin/leads?page=${leadsPagination.page}&search=${encodeURIComponent(leadSearch)}&stage=${leadStageFilter}&source=${leadSourceFilter}`
        );
        if (data.success) {
          setGlobalLeads(data.leads || []);
          setLeadsPagination(data.pagination || { page: 1, total: 0, pages: 1 });
        }
      } else if (tabToFetch === 'integrations') {
        const { data } = await api.get('/super-admin/integrations');
        if (data.success) setIntegrationsTelemetry(data);
      } else if (tabToFetch === 'health') {
        const { data } = await api.get('/super-admin/health');
        if (data.success) setSystemHealth(data);
      } else if (tabToFetch === 'errors') {
        const { data } = await api.get('/super-admin/error-logs');
        if (data.success) setErrorLogs(data.logs || []);
      } else if (tabToFetch === 'audit') {
        const { data } = await api.get(`/super-admin/audit-logs?search=${encodeURIComponent(auditSearch)}`);
        if (data.success) setAuditLogs(data.logs || []);
      } else if (tabToFetch === 'feature_flags') {
        const { data } = await api.get('/super-admin/feature-flags');
        if (data.success) setFeatureFlags(data.flags || []);
      }
    } catch (err) {
      console.error('SuperAdmin data fetch error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [
    activeTab,
    orgPagination.page,
    orgSearch,
    orgStatusFilter,
    usersPagination.page,
    userSearch,
    userRoleFilter,
    leadsPagination.page,
    leadSearch,
    leadStageFilter,
    leadSourceFilter,
    auditSearch,
  ]);

  useEffect(() => {
    if (!loading && currentUser) {
      fetchTabData(activeTab);
    }
  }, [activeTab, loading, currentUser, fetchTabData]);

  // Deep inspect single tenant
  const handleInspectTenant = async (tenantId) => {
    try {
      const { data } = await api.get(`/super-admin/organisations/${tenantId}`);
      if (data.success) {
        setSelectedTenantData(data.data);
      }
    } catch (err) {
      toast.error('Failed to load organisation details');
    }
  };

  // Support Mode Impersonation
  const handleStartImpersonation = async (targetUserId) => {
    const reason = prompt('Enter mandatory support reason for entering this tenant account:');
    if (!reason || reason.trim().length < 5) {
      return toast.error('Impersonation cancelled. A detailed reason (min 5 chars) is required for platform security audit.');
    }

    try {
      const { data } = await api.post('/super-admin/impersonate', { targetUserId, reason });
      if (data.success) {
        setImpersonationSession(data);
        toast.success(`Support session active for ${data.targetUser?.name}! 🚀`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to enter support mode');
    }
  };

  // Status update (Block / Unblock)
  const handleTenantStatusUpdate = async (tenantId, newStatus) => {
    const reason = prompt(`Reason for setting status to ${newStatus}:`) || 'Administrative action';
    try {
      const { data } = await api.patch(`/super-admin/organisations/${tenantId}/status`, {
        status: newStatus,
        reason,
      });
      if (data.success) {
        toast.success(data.message);
        fetchTabData('organisations');
      }
    } catch (err) {
      toast.error('Failed to update tenant status');
    }
  };

  // Toggle Feature Flag
  const handleToggleFeatureFlag = async (flagId, enabled) => {
    try {
      const { data } = await api.patch(`/super-admin/feature-flags/${flagId}`, { enabled });
      if (data.success) {
        toast.success(data.message);
        fetchTabData('feature_flags');
      }
    } catch (err) {
      toast.error('Failed to update feature flag');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#070b14] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <div className="text-xs font-mono text-slate-400">Loading Super Admin Command Center...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans select-none antialiased">
      {/* 1. SUPPORT MODE BANNER */}
      <SupportModeBanner
        session={impersonationSession}
        onExit={() => {
          setImpersonationSession(null);
          toast.success('Exited support mode.');
        }}
      />

      {/* 2. SUPER ADMIN SIDEBAR */}
      <div className="hidden md:flex w-64 shrink-0 flex-col h-full z-20">
        <SuperAdminSidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            router.push(`/superadmin-dashboard?tab=${tab}`);
          }}
          onRefresh={() => fetchTabData(activeTab)}
          refreshing={refreshing}
          currentUser={currentUser}
        />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-950/80 backdrop-blur-sm">
          <div className="w-72 h-full">
            <SuperAdminSidebar
              activeTab={activeTab}
              onSelectTab={(tab) => {
                setActiveTab(tab);
                setMobileMenuOpen(false);
                router.push(`/superadmin-dashboard?tab=${tab}`);
              }}
              onCloseMobile={() => setMobileMenuOpen(false)}
              onRefresh={() => fetchTabData(activeTab)}
              refreshing={refreshing}
              currentUser={currentUser}
            />
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0a0f1d]">
        <SuperAdminHeader
          activeTab={activeTab}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onRefresh={() => fetchTabData(activeTab)}
          refreshing={refreshing}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {activeTab === 'overview' && (
            <SuperAdminOverviewModule
              overview={overviewData}
              loading={refreshing && !overviewData}
              onSelectTab={(tab) => {
                setActiveTab(tab);
                router.push(`/superadmin-dashboard?tab=${tab}`);
              }}
            />
          )}

          {activeTab === 'organisations' && (
            <SuperAdminOrganisationsModule
              organisations={organisations}
              pagination={orgPagination}
              loading={refreshing && organisations.length === 0}
              search={orgSearch}
              onSearchChange={setOrgSearch}
              statusFilter={orgStatusFilter}
              onStatusFilterChange={setOrgStatusFilter}
              onInspectTenant={handleInspectTenant}
              onImpersonate={handleStartImpersonation}
              onStatusUpdate={handleTenantStatusUpdate}
              onPageChange={(page) => setOrgPagination((p) => ({ ...p, page }))}
            />
          )}

          {activeTab === 'users' && (
            <SuperAdminUsersModule
              users={users}
              pagination={usersPagination}
              loading={refreshing && users.length === 0}
              search={userSearch}
              onSearchChange={setUserSearch}
              roleFilter={userRoleFilter}
              onRoleFilterChange={setUserRoleFilter}
              onPageChange={(page) => setUsersPagination((p) => ({ ...p, page }))}
            />
          )}

          {activeTab === 'revenue' && (
            <SuperAdminRevenueModule
              revenueData={revenueData}
              loading={refreshing && !revenueData}
            />
          )}

          {activeTab === 'leads' && (
            <SuperAdminGlobalLeadsModule
              leads={globalLeads}
              pagination={leadsPagination}
              loading={refreshing && globalLeads.length === 0}
              search={leadSearch}
              onSearchChange={setLeadSearch}
              stageFilter={leadStageFilter}
              onStageFilterChange={setLeadStageFilter}
              sourceFilter={leadSourceFilter}
              onSourceFilterChange={setLeadSourceFilter}
              onPageChange={(page) => setLeadsPagination((p) => ({ ...p, page }))}
            />
          )}

          {activeTab === 'integrations' && (
            <SuperAdminIntegrationsModule
              telemetry={integrationsTelemetry}
              loading={refreshing && !integrationsTelemetry}
            />
          )}

          {activeTab === 'health' && (
            <SuperAdminSystemHealthModule
              health={systemHealth}
              loading={refreshing && !systemHealth}
            />
          )}

          {activeTab === 'errors' && (
            <SuperAdminErrorLogsModule
              logs={errorLogs}
              loading={refreshing && errorLogs.length === 0}
            />
          )}

          {activeTab === 'audit' && (
            <SuperAdminAuditModule
              logs={auditLogs}
              loading={refreshing && auditLogs.length === 0}
              search={auditSearch}
              onSearchChange={setAuditSearch}
            />
          )}

          {activeTab === 'feature_flags' && (
            <SuperAdminFeatureFlagsModule
              flags={featureFlags}
              loading={refreshing && featureFlags.length === 0}
              onToggleFlag={handleToggleFeatureFlag}
            />
          )}

          {activeTab === 'broadcast' && (
            <SuperAdminBroadcastModule />
          )}
        </main>
      </div>

      {/* 4. GLOBAL SEARCH MODAL */}
      <SuperAdminGlobalSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectResult={(item) => {
          if (item.type === 'ORGANISATION') {
            setActiveTab('organisations');
            handleInspectTenant(item.id);
          } else if (item.type === 'USER') {
            setActiveTab('users');
            setUserSearch(item.title);
          } else if (item.type === 'LEAD') {
            setActiveTab('leads');
            setLeadSearch(item.title);
          }
        }}
      />

      {/* 5. TENANT DETAIL MODAL */}
      <TenantDetailModal
        isOpen={Boolean(selectedTenantData)}
        onClose={() => setSelectedTenantData(null)}
        tenantData={selectedTenantData}
        onImpersonate={(userId) => {
          setSelectedTenantData(null);
          handleStartImpersonation(userId);
        }}
      />
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-[#070b14] text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <div className="text-xs font-mono text-slate-400">Loading SuperAdmin Workspace...</div>
          </div>
        </div>
      }
    >
      <SuperAdminDashboardContent />
    </Suspense>
  );
}
