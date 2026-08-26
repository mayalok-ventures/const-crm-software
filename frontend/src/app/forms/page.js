'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FormCenterRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Form Center is managed directly inside Agency Control Center
    router.replace('/agency?tab=forms');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  );
}
