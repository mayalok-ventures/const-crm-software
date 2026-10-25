'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

let globalQueryClient = null;

const APP_BUILD_VERSION = 'crm-v2-round2-2026';

export function getQueryClient() {
  if (!globalQueryClient) {
    globalQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 45000, // 45 seconds stale-while-revalidate
          gcTime: 1000 * 60 * 60 * 24, // 24 hours retained for client persistence
          retry: 1,
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
        },
      },
    });
  }
  return globalQueryClient;
}

export function clearAllQueryCache() {
  if (globalQueryClient) {
    globalQueryClient.clear();
  }
  if (typeof window !== 'undefined') {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('crm_query_cache_')) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}
  }
}

export default function Providers({ children }) {
  const [queryClient] = useState(() => getQueryClient());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user?._id || user?.id || 'anonymous';
      const storageKey = `crm_query_cache_${userId}`;

      const localStoragePersister = createSyncStoragePersister({
        storage: window.localStorage,
        key: storageKey,
        throttleTime: 1000,
      });

      persistQueryClient({
        queryClient,
        persister: localStoragePersister,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        buster: APP_BUILD_VERSION,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            if (query.state.status !== 'success') return false;
            const qKey = Array.isArray(query.queryKey) ? query.queryKey.join('.') : String(query.queryKey);
            // Exclude sensitive queries or one-time mutation tokens
            if (qKey.includes('token') || qKey.includes('password') || qKey.includes('secret')) {
              return false;
            }
            return true;
          },
        },
      });
    } catch (e) {
      console.warn('[Cache Persistence Notice]:', e.message);
    }
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
