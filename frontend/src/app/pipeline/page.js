'use client';

import { Suspense } from 'react';
import { RefreshCw } from 'lucide-react';
import PipelineContent from '@/components/pipeline/PipelineContent';
import { usePersistentTab } from '@/components/common/PersistentTabContext';

export default function PipelinePage() {
  const { isPersistentTabsEnabled } = usePersistentTab();
  if (isPersistentTabsEnabled) {
    return null;
  }
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-slate-400">
        <RefreshCw className="animate-spin mx-auto mb-2 text-indigo-500" size={24} />
        <p className="text-xs">Loading admission pipeline...</p>
      </div>
    }>
      <PipelineContent />
    </Suspense>
  );
}
