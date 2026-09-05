'use client';

import React from 'react';
import { ShieldAlert, LogOut, ExternalLink } from 'lucide-react';

export default function SupportModeBanner({
  session = null,
  onExit = null,
}) {
  if (!session) return null;

  return (
    <div className="w-full shrink-0 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md z-50 select-none border-b border-amber-700/40">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-4 h-4 text-slate-950 shrink-0 animate-bounce" />
        <span className="truncate">
          ⚠️ SUPPORT MODE ACTIVE: You are viewing tenant account{' '}
          <span className="underline decoration-slate-950 font-extrabold">{session.targetUser?.companyInfo?.companyName || session.targetUser?.name}</span>{' '}
          as Super Admin.
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-3">
        <a
          href="/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/15 hover:bg-slate-950/25 text-slate-950 border border-slate-950/30 text-[11px] font-bold transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open Client CRM</span>
        </a>
        {onExit && (
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 text-amber-300 hover:bg-slate-900 text-[11px] font-bold shadow-sm transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Support Mode</span>
          </button>
        )}
      </div>
    </div>
  );
}
