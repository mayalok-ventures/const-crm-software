'use client';

import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

/**
 * PwaInstallPrompt Component
 * Captures browser's beforeinstallprompt event and provides a native 1-click
 * install button for Standalone Desktop (Windows/Mac) and Mobile (Android) PWA.
 */
export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect if already installed & running in standalone display mode
    const isApp = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isApp) {
      setIsStandalone(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (isStandalone || isDismissed || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 z-50 p-4 bg-indigo-600 text-white rounded-2xl shadow-xl flex items-center justify-between gap-3 border border-indigo-500 animate-in fade-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-white/10 rounded-xl shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">Install Sahyak App</p>
          <p className="text-xs text-indigo-100 leading-tight mt-0.5">0ms offline access & instant alerts</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 bg-white text-indigo-600 hover:bg-indigo-50 font-bold text-xs rounded-xl shadow-xs transition-colors"
        >
          Install
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1.5 text-white/70 hover:text-white transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
