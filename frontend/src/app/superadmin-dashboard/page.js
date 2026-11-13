'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SuperAdminRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams?.get('tab');
    const target = tab ? `/admin?tab=${encodeURIComponent(tab)}` : '/admin';
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#070b14] text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        <p className="text-xs font-mono text-slate-400">Directing to Unified Admin Command Center...</p>
      </div>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-[#070b14] text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-xs font-mono text-slate-400">Loading...</p>
          </div>
        </div>
      }
    >
      <SuperAdminRedirect />
    </Suspense>
  );
}
