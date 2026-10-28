'use client';

import { Suspense } from 'react';
import LeadsContent from '@/components/leads/LeadsContent';
import { usePersistentTab } from '@/components/common/PersistentTabContext';

export default function LeadsPage() {
  const { isPersistentTabsEnabled } = usePersistentTab();
  if (isPersistentTabsEnabled) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LeadsContent />
    </Suspense>
  );
}
