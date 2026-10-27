import Dexie from 'dexie';

/**
 * Sahyak CRM Local-First Dexie (IndexedDB) Database
 * Delivers instant 0ms local reads and offline persistence.
 * Replaces synchronous 5MB localStorage with multi-gigabyte asynchronous IndexedDB storage.
 */

export class CrmLocalDatabase extends Dexie {
  constructor() {
    super('SahyakCrmLocalDB');

    this.version(1).stores({
      leads: 'id, workspaceId, status, pipelineStage, assignedTo, name, phoneDigits, temperature, score, updatedAt, _synced',
      followUps: 'id, workspaceId, leadId, scheduledAt, status, _synced',
      pipelines: 'id, workspaceId, isDefault',
      colleges: 'id, name, state, city',
      cachedQueries: 'key, timestamp',
      offlineMutationQueue: '++id, endpoint, method, createdAt, status',
    });
  }
}

export const localDb = typeof window !== 'undefined' ? new CrmLocalDatabase() : null;

/**
 * Custom TanStack Query Async Persister for Dexie (IndexedDB)
 * Asynchronously persists query cache without blocking the main UI thread.
 */
export function createDexiePersister() {
  return {
    persistClient: async (client) => {
      if (!localDb) return;
      try {
        await localDb.cachedQueries.put({
          key: 'tanstack_query_state',
          data: client,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.warn('[Dexie Persist Error]:', err.message);
      }
    },
    restoreClient: async () => {
      if (!localDb) return undefined;
      try {
        const record = await localDb.cachedQueries.get('tanstack_query_state');
        if (record && record.data) {
          return record.data;
        }
      } catch (err) {
        console.warn('[Dexie Restore Error]:', err.message);
      }
      return undefined;
    },
    removeClient: async () => {
      if (!localDb) return;
      try {
        await localDb.cachedQueries.delete('tanstack_query_state');
      } catch (_) { }
    },
  };
}

/**
 * Quick helpers for local-first leads access
 */
export async function getLocalLeads(workspaceId, filter = {}) {
  if (!localDb) return [];
  try {
    let collection = localDb.leads.toCollection();
    if (workspaceId) {
      collection = localDb.leads.where('workspaceId').equals(workspaceId);
    }
    let results = await collection.toArray();
    if (filter.status) {
      results = results.filter(l => l.status === filter.status || l.pipelineStage === filter.status);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      results = results.filter(l => (l.name && l.name.toLowerCase().includes(q)) || (l.phone && l.phone.includes(q)));
    }
    return results;
  } catch (e) {
    return [];
  }
}

export async function upsertLocalLeads(leads) {
  if (!localDb || !Array.isArray(leads) || leads.length === 0) return;
  try {
    const formatted = leads.map(l => ({
      ...l,
      id: l._id || l.id,
      phoneDigits: l.phoneDigits || String(l.phone || '').replace(/\D/g, ''),
      _synced: true,
      updatedAt: l.updatedAt || new Date().toISOString(),
    }));
    await localDb.leads.bulkPut(formatted);
  } catch (err) {
    console.warn('[Dexie Bulk Put Error]:', err.message);
  }
}

export async function patchLocalLeadOptimistic(id, patch) {
  if (!localDb || !id) return;
  try {
    await localDb.leads.update(id, {
      ...patch,
      _synced: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Dexie Optimistic Patch Error]:', err.message);
  }
}
