'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';

function ProfileRedirectContent() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin?tab=profile');
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#070b14] text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        <div className="text-xs font-mono text-slate-400">Loading CoreSetu OS Organization & Profile...</div>
      </div>
    </div>
  );
}

export default function ProfileRedirect() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-[#070b14] text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <div className="text-xs font-mono text-slate-400">Redirecting to Control Center...</div>
          </div>
        </div>
      }
    >
      <ProfileRedirectContent />
    </Suspense>
  );
}
