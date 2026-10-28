import { queryOptions } from '@tanstack/react-query';
import api from '@/lib/api';

/**
 * Standardized TanStack Query Options for CRM Endpoints
 * All pages, components, and prefetchers consume these identical helpers.
 */

/**
 * Synchronous Frame-0 Local Snapshot Cache
 * Enables instantaneous first-frame renders on cold reloads,
 * eliminating empty white states, flashes, and loading spinners.
 */
export function getTenantScope() {
  if (typeof window === 'undefined') return { wsId: 'solo', userId: 'anon' };
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return { wsId: 'solo', userId: 'anon' };
    const u = JSON.parse(raw);
    const userId = u._id || 'anon';
    const wsId = u.currentWorkspace?._id || u.currentWorkspace || u.workspaceId || u.companyId || u._id || 'solo';
    return { wsId, userId };
  } catch (_) {
    return { wsId: 'solo', userId: 'anon' };
  }
}

export function getLocalSnapshotRecord(key) {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(`crm_snap_${key}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data && (Date.now() - parsed.ts < 1000 * 60 * 60 * 24)) {
      return parsed;
    }
  } catch (_) {}
  return undefined;
}

export function getLocalSnapshot(key) {
  const rec = getLocalSnapshotRecord(key);
  return rec ? rec.data : undefined;
}

export function setLocalSnapshot(key, data) {
  if (typeof window === 'undefined' || !data) return;
  try {
    localStorage.setItem(`crm_snap_${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}

export function invalidateAllLeadViews(queryClient, tenantId) {
  if (!queryClient) return;
  const wsId = tenantId || getTenantScope().wsId;
  queryClient.invalidateQueries({ queryKey: ['leads', wsId] });
  queryClient.invalidateQueries({ queryKey: ['pipeline', wsId] });
  queryClient.invalidateQueries({ queryKey: ['dashboard', wsId] });
  queryClient.invalidateQueries({ queryKey: ['follow-ups', wsId] });
  queryClient.invalidateQueries({ queryKey: ['leads'] });
  queryClient.invalidateQueries({ queryKey: ['pipeline'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

export function leadsListOptions(filters = {}, tenantId) {
  const { wsId, userId } = getTenantScope();
  const targetWs = tenantId || wsId;
  const isDefault = Object.keys(filters).length === 0 || (Object.keys(filters).length === 1 && filters.limit);
  const snapKey = `${userId}_${targetWs}_leads_list_default`;
  const snapshotRec = isDefault ? getLocalSnapshotRecord(snapKey) : null;

  return queryOptions({
    queryKey: ['leads', targetWs, 'list', filters],
    queryFn: async ({ signal }) => {
      const res = await api.get('/leads', { params: filters, signal });
      if (isDefault && res.data) {
        setLocalSnapshot(snapKey, res.data);
      }
      return res.data;
    },
    initialData: snapshotRec?.data,
    initialDataUpdatedAt: snapshotRec?.ts || 0,
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 10,
  });
}

export function pipelineOptions(filters = {}, tenantId) {
  const { wsId, userId } = getTenantScope();
  const targetWs = tenantId || wsId;
  const isDefault = Object.keys(filters).length === 0;
  const snapKey = `${userId}_${targetWs}_pipeline_default`;
  const snapshotRec = isDefault ? getLocalSnapshotRecord(snapKey) : null;

  return queryOptions({
    queryKey: ['pipeline', targetWs, 'leads', filters],
    queryFn: async ({ signal }) => {
      const [leadsRes, pipelinesRes] = await Promise.all([
        api.get('/leads', { params: { limit: 250, view: 'pipeline', ...filters }, signal }),
        api.get('/pipelines', { signal }).catch(() => ({ data: { success: false, data: [] } })),
      ]);
      const data = {
        leads: leadsRes.data?.leads || [],
        pipelines: pipelinesRes.data?.data || [],
        total: leadsRes.data?.total || 0,
      };
      if (isDefault) {
        setLocalSnapshot(snapKey, data);
      }
      return data;
    },
    initialData: snapshotRec?.data,
    initialDataUpdatedAt: snapshotRec?.ts || 0,
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 10,
  });
}

export function dashboardStatsOptions(tenantId) {
  const wsId = tenantId || getTenantScope().wsId;
  const snapKey = `${wsId}_dashboard_stats`;
  return queryOptions({
    queryKey: ['dashboard', wsId, 'stats'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/analytics', { signal }).catch(async () => {
        return await api.get('/leads?limit=1', { signal });
      });
      if (res.data) {
        setLocalSnapshot(snapKey, res.data);
      }
      return res.data;
    },
    initialData: () => getLocalSnapshot(snapKey),
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 10,
  });
}

export function membersOptions() {
  return queryOptions({
    queryKey: ['workspace', 'members'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/workspace/members', { signal });
      return res.data?.members || [];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function inboundCampaignsOptions() {
  return queryOptions({
    queryKey: ['campaigns', 'inbound'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/campaigns/inbound', { signal });
      return res.data?.campaigns || [];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function integrationsOptions() {
  return queryOptions({
    queryKey: ['integrations', 'list'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/integrations', { signal });
      return res.data?.integrations || res.data?.data || (Array.isArray(res.data) ? res.data : []);
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
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
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

export function todayFollowUpsOptions(tenantId) {
  const wsId = tenantId || getTenantScope().wsId;
  return queryOptions({
    queryKey: ['leads', wsId, 'follow-ups', 'today'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/leads/follow-ups/today', { signal });
      return Array.isArray(res.data) ? res.data : [];
    },
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function authMeOptions() {
  return queryOptions({
    queryKey: ['auth', 'me'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/auth/me', { signal });
      return res.data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function workspaceCurrentOptions() {
  return queryOptions({
    queryKey: ['workspace', 'current'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/workspace/current', { signal });
      return res.data?.data || res.data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function workspaceMembersOptions() {
  return queryOptions({
    queryKey: ['workspace', 'members'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/workspace/members', { signal });
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function dealsOptions(filters = {}, tenantId) {
  const wsId = tenantId || getTenantScope().wsId;
  return queryOptions({
    queryKey: ['deals', wsId, 'list', filters],
    queryFn: async ({ signal }) => {
      const res = await api.get('/deals', { params: { limit: 100, ...filters }, signal });
      return res.data?.data || res.data || [];
    },
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function dealsSummaryOptions(tenantId) {
  const wsId = tenantId || getTenantScope().wsId;
  return queryOptions({
    queryKey: ['deals', wsId, 'summary'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/deals/summary/commission', { signal });
      return res.data?.data || null;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 10, // 10 minutes
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
    staleTime: 1000 * 60 * 1, // 1 minute
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
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
