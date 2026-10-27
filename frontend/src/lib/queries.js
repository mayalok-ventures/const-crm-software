import { queryOptions } from '@tanstack/react-query';
import api from '@/lib/api';

/**
 * Standardized TanStack Query Options for CRM Endpoints
 * All pages, components, and prefetchers consume these identical helpers.
 */

export function leadsListOptions(filters = {}) {
  return queryOptions({
    queryKey: ['leads', 'list', filters],
    queryFn: async ({ signal }) => {
      const res = await api.get('/leads', { params: filters, signal });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });
}

export function pipelineOptions(filters = {}) {
  return queryOptions({
    queryKey: ['pipeline', 'leads', filters],
    queryFn: async ({ signal }) => {
      const [leadsRes, pipelinesRes] = await Promise.all([
        api.get('/leads', { params: { limit: 250, ...filters }, signal }),
        api.get('/pipelines', { signal }).catch(() => ({ data: { success: false, data: [] } })),
      ]);
      return {
        leads: leadsRes.data?.leads || [],
        pipelines: pipelinesRes.data?.data || [],
        total: leadsRes.data?.total || 0,
      };
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });
}

export function dashboardStatsOptions() {
  return queryOptions({
    queryKey: ['dashboard', 'stats'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/analytics', { signal }).catch(async () => {
        return await api.get('/leads?limit=1', { signal });
      });
      return res.data;
    },
    staleTime: 45000,
  });
}

export function membersOptions() {
  return queryOptions({
    queryKey: ['workspace', 'members'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/workspace/members', { signal });
      return res.data?.members || [];
    },
    staleTime: 60000,
  });
}

export function inboundCampaignsOptions() {
  return queryOptions({
    queryKey: ['campaigns', 'inbound'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/campaigns/inbound', { signal });
      return res.data?.campaigns || [];
    },
    staleTime: 60000,
  });
}

export function integrationsOptions() {
  return queryOptions({
    queryKey: ['integrations', 'list'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/integrations', { signal });
      return res.data?.integrations || res.data?.data || (Array.isArray(res.data) ? res.data : []);
    },
    staleTime: 60000,
  });
}

export function dueFollowUpsOptions() {
  return queryOptions({
    queryKey: ['leads', 'follow-ups', 'due'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/leads/follow-ups/due', {
        signal,
        _silentAuth: true,
        _isBackground: true,
      });
      return Array.isArray(res.data) ? res.data : (res.data?.followUps || []);
    },
    staleTime: 30000,
  });
}

export function todayFollowUpsOptions() {
  return queryOptions({
    queryKey: ['leads', 'follow-ups', 'today'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/leads/follow-ups/today', { signal });
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 30000,
  });
}

export function authMeOptions() {
  return queryOptions({
    queryKey: ['auth', 'me'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/auth/me', { signal });
      return res.data;
    },
    staleTime: 60000,
  });
}

export function workspaceCurrentOptions() {
  return queryOptions({
    queryKey: ['workspace', 'current'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/workspace/current', { signal });
      return res.data?.data || res.data;
    },
    staleTime: 60000,
  });
}

export function workspaceMembersOptions() {
  return queryOptions({
    queryKey: ['workspace', 'members'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/workspace/members', { signal });
      return res.data?.data || [];
    },
    staleTime: 60000,
  });
}

export function dealsOptions(filters = {}) {
  return queryOptions({
    queryKey: ['deals', 'list', filters],
    queryFn: async ({ signal }) => {
      const res = await api.get('/deals', { params: { limit: 100, ...filters }, signal });
      return res.data?.data || res.data || [];
    },
    staleTime: 30000,
  });
}

export function dealsSummaryOptions() {
  return queryOptions({
    queryKey: ['deals', 'summary'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/deals/summary/commission', { signal });
      return res.data?.data || null;
    },
    staleTime: 30000,
  });
}

export function notificationsOptions() {
  return queryOptions({
    queryKey: ['notifications', 'list'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/notifications', { signal });
      return {
        notifications: res.data?.notifications || (Array.isArray(res.data) ? res.data : []),
        unreadCount: res.data?.unreadCount || 0,
      };
    },
    staleTime: 20000,
  });
}

export function bootstrapOptions(queryClient) {
  return queryOptions({
    queryKey: ['bootstrap'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/bootstrap', { signal });
      const data = res.data;
      if (data) {
        if (data.user) {
          const effectivePermissions = data.effectivePermissions || data.user.effectivePermissions || [];
          const updatedUser = {
            ...data.user,
            effectivePermissions,
          };
          if (typeof window !== 'undefined') {
            try {
              const currentU = localStorage.getItem('user');
              const parsed = currentU ? JSON.parse(currentU) : {};
              localStorage.setItem('user', JSON.stringify({ ...parsed, ...updatedUser }));
              window.dispatchEvent(new CustomEvent('user-updated', { detail: { ...parsed, ...updatedUser } }));
            } catch (_) {}
          }
          if (queryClient) {
            queryClient.setQueryData(['auth', 'me'], updatedUser);
          }
        }
        if (queryClient) {
          if (data.workspace) queryClient.setQueryData(['workspace', 'current'], data.workspace);
          if (data.members) queryClient.setQueryData(['workspace', 'members'], data.members);
          if (data.counts) {
            queryClient.setQueryData(['notifications', 'unread-count'], data.counts.unreadNotifications);
            queryClient.setQueryData(['leads', 'follow-ups', 'due-count'], data.counts.dueFollowUps);
          }
          if (data.integrations) queryClient.setQueryData(['integrations', 'list'], data.integrations);
        }
      }
      return data;
    },
    staleTime: 60000,
  });
}
