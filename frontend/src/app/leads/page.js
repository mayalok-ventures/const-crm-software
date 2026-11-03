'use client';

import { Suspense } from 'react';
import LeadsContent from '@/components/leads/LeadsContent';

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsContent />
    </Suspense>
  );
}
