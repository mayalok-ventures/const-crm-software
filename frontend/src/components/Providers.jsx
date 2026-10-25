'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let globalQueryClient = null;

export function getQueryClient() {
  if (!globalQueryClient) {
    globalQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 45000, // 45 seconds stale-while-revalidate
          gcTime: 1000 * 60 * 15, // 15 minutes in garbage collection cache
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
}

export default function Providers({ children }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
