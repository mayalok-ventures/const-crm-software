'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function PermissionGate({
  requiredRole = 'Organization Admin',
  message = 'Your account does not have sufficient administrative privileges to access this operational module.',
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-amber-500/20 bg-amber-500/5 my-6">
      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3.5 shadow-lg shadow-amber-500/10">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-white mb-1.5">Access Restricted</h3>
      <p className="text-xs text-slate-300 max-w-md mb-2">{message}</p>
      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/30 mb-6">
        Required Permission: {requiredRole}
      </span>
      <Link
        href="/dashboard"
        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
      >
        Return to User Dashboard
      </Link>
    </div>
  );
}
