'use client';

import React from 'react';

export default function LoadingSkeleton({ type = 'card', count = 4 }) {
  if (type === 'table') {
    return (
      <div className="w-full bg-[#0d1424] border border-slate-800/80 rounded-xl p-4 space-y-3 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/4 mb-4"></div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-2 border-b border-slate-800/40">
            <div className="h-4 bg-slate-800/60 rounded flex-1"></div>
            <div className="h-4 bg-slate-800/60 rounded flex-1"></div>
            <div className="h-4 bg-slate-800/60 rounded flex-1"></div>
            <div className="h-4 bg-slate-800/60 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'kanban') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-[#0b101d] rounded-xl border border-slate-800/80 p-3 min-h-[400px] space-y-3">
            <div className="h-5 bg-slate-800 rounded w-1/2 mb-4"></div>
            <div className="h-24 bg-slate-800/50 rounded-lg"></div>
            <div className="h-24 bg-slate-800/50 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  // Default card grid skeleton
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 space-y-3">
          <div className="h-4 bg-slate-800 rounded w-1/3"></div>
          <div className="h-8 bg-slate-800/70 rounded w-1/2"></div>
          <div className="h-3 bg-slate-800/50 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );
}
