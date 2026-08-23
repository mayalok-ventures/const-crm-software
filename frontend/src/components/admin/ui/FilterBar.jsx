'use client';

import React from 'react';
import { Search } from 'lucide-react';

export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  children,
}) {
  return (
    <div className="p-3.5 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
      {onSearchChange !== undefined && (
        <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none w-full"
          />
        </div>
      )}

      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
