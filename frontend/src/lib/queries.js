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
      const res = await api.get('/admin/dashboard-stats', { signal }).catch(async () => {
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
      return res.data?.followUps || [];
    },
    staleTime: 30000,
  });
}
