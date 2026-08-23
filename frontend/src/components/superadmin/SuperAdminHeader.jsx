'use client';

import React from 'react';
import { Menu, RefreshCw, Search, Bell, Shield, Radio } from 'lucide-react';
import { SUPERADMIN_NAV_CATEGORIES } from './SuperAdminSidebar';

export default function SuperAdminHeader({
  activeTab,
  onOpenMobileMenu,
  onOpenSearch,
  onRefresh,
  refreshing = false,
}) {
  let currentLabel = 'SaaS Command Center';
  for (const cat of SUPERADMIN_NAV_CATEGORIES) {
    const found = cat.items.find((i) => i.id === activeTab);
    if (found) {
      currentLabel = found.label;
      break;
    }
  }

  return (
    <header className="h-14 border-b border-slate-800/80 bg-[#070b14]/80 px-4 md:px-6 flex items-center justify-between shrink-0 backdrop-blur-md z-10 select-none">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 md:hidden transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
            <span>{currentLabel}</span>
          </h2>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Platform Operational
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs transition-colors shadow-inner"
        >
          <Search className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Search platform...</span>
          <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
            ⌘K
          </kbd>
        </button>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900/90 border border-slate-800 hover:bg-slate-800 transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>
    </header>
  );
}
