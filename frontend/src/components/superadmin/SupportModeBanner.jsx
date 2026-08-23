'use client';

import React from 'react';
import { ShieldAlert, LogOut, ExternalLink } from 'lucide-react';

export default function SupportModeBanner({
  session = null,
  onExit = null,
}) {
  if (!session) return null;

  return (
    <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md z-50 select-none">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-slate-950 animate-bounce" />
        <span>
          ⚠️ SUPPORT MODE ACTIVE: You are viewing tenant account{' '}
          <span className="underline decoration-slate-950">{session.targetUser?.companyInfo?.companyName || session.targetUser?.name}</span>{' '}
          as Super Admin.
        </span>
      </div>

      <div className="flex items-center gap-3">
        {onExit && (
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 text-amber-300 hover:bg-slate-900 text-[11px] font-bold shadow-sm transition-all"
          >
            <LogOut className="w-3 h-3" />
            <span>Exit Support Mode</span>
          </button>
        )}
      </div>
    </div>
  );
}
