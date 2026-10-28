'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createDexiePersister, localDb } from '@/lib/db';

let globalQueryClient = null;

const APP_BUILD_VERSION = 'crm-v3-localfirst-2026';

export function getQueryClient() {
  if (!globalQueryClient) {
    globalQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 10, // 10 minutes SWR cache - seamless navigation even after long pauses
          gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days retained in Dexie local cache
          retry: 1,
          refetchOnWindowFocus: false, // Prevent aggressive network requests on tab focus
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
  if (typeof window !== 'undefined' && localDb) {
    localDb.cachedQueries.clear().catch(() => {});
  }
}

export default function Providers({ children }) {
  const [queryClient] = useState(() => getQueryClient());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const dexiePersister = createDexiePersister();

      persistQueryClient({
        queryClient,
        persister: dexiePersister,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days local persistence
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
      console.warn('[Dexie Cache Persistence Notice]:', e.message);
    }
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
