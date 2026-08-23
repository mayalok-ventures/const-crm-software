'use client';

import React from 'react';
import { Flag, CheckCircle2, XCircle } from 'lucide-react';

export default function SuperAdminFeatureFlagsModule({
  flags = [],
  loading = false,
  onToggleFlag = null,
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Flag className="w-4 h-4 text-amber-400" />
            <span>Platform Feature Flags & Progressive Rollout</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Toggle platform capabilities globally without code deployments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {flags.map((flag) => (
          <div key={flag.id} className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{flag.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {flag.category}
                </span>
              </div>
              <p className="text-xs text-slate-400">{flag.description}</p>
            </div>

            <button
              onClick={() => onToggleFlag && onToggleFlag(flag.id, !flag.enabled)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                flag.enabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-500 border border-slate-800'
              }`}
            >
              {flag.enabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
