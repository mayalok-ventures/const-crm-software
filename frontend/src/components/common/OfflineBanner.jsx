'use client';
import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateStatus = () => {
      setIsOffline(navigator.onLine === false);
    };

    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 shadow-md z-[60] w-full"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>You are offline. Changes are saved locally and will sync once reconnected.</span>
    </div>
  );
}
