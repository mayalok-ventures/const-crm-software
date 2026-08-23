'use client';

import React from 'react';
import { Plus, Bell, Menu, RefreshCw } from 'lucide-react';
import { NAV_CATEGORIES } from './AdminSidebar';

export default function AdminHeader({
  activeTab,
  onOpenMobileMenu,
  onAddLead,
  onBroadcast,
  onRefresh,
  refreshing = false,
}) {
  // Find current label
  let currentLabel = 'Control Center';
  for (const cat of NAV_CATEGORIES) {
    const found = cat.items.find((i) => i.id === activeTab);
    if (found) {
      currentLabel = found.label;
      break;
    }
  }

  return (
    <header className="h-14 border-b border-slate-800/80 bg-[#0a0f1d]/70 px-4 md:px-6 flex items-center justify-between shrink-0 backdrop-blur-md z-10">
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
          <h2 className="text-xs md:text-sm font-bold text-white tracking-wide uppercase">
            {currentLabel}
          </h2>
        </div>
        <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
          System Online
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors md:hidden"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
        </button>

        {onAddLead && (
          <button
            onClick={onAddLead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow-md shadow-amber-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Lead</span>
            <span className="sm:hidden">Lead</span>
          </button>
        )}

        {onBroadcast && (
          <button
            onClick={onBroadcast}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Broadcast</span>
          </button>
        )}
      </div>
    </header>
  );
}
