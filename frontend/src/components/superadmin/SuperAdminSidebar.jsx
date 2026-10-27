'use client';

import React from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, Users, UserCheck, CreditCard,
  Receipt, ShoppingBag, Ticket, Workflow, FileText,
  MessageSquare, Target, Radio, Activity, AlertTriangle,
  History, Shield, Flag, Bell, RefreshCw, X, LogOut, Search,
  ArrowUpRight, Sparkles, Layers
} from 'lucide-react';

export const SUPERADMIN_NAV_CATEGORIES = [
  {
    name: 'COMMAND CENTER',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    name: 'TENANTS',
    items: [
      { id: 'organisations', label: 'Organisations', icon: Building2 },
      { id: 'users', label: 'Users & Roles', icon: Users },
    ],
  },
  {
    name: 'REVENUE',
    items: [
      { id: 'revenue', label: 'Subscriptions & MRR', icon: CreditCard },
    ],
  },
  {
    name: 'CRM PLATFORM',
    items: [
      { id: 'leads', label: 'Global Leads', icon: Layers },
    ],
  },
  {
    name: 'INTEGRATIONS',
    items: [
      { id: 'integrations', label: 'Meta, Google & Webhooks', icon: Radio },
    ],
  },
  {
    name: 'SYSTEM',
    items: [
      { id: 'health', label: 'System Health', icon: Activity },
      { id: 'errors', label: 'Error Logs', icon: AlertTriangle },
      { id: 'audit', label: 'Activity & Audit Logs', icon: History },
    ],
  },
  {
    name: 'PLATFORM',
    items: [
      { id: 'feature_flags', label: 'Feature Flags', icon: Flag },
      { id: 'broadcast', label: 'Platform Broadcast', icon: Bell },
    ],
  },
];

export default function SuperAdminSidebar({
  activeTab,
  onSelectTab,
  onRefresh,
  refreshing = false,
  currentUser,
  onCloseMobile,
}) {
  return (
    <div className="flex flex-col h-full w-full bg-[#070b14] overflow-hidden border-r border-slate-800/80 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-[#050811] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black text-sm shadow-md shadow-amber-500/20 shrink-0">
            ⚡
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-white tracking-wider flex items-center gap-1.5 truncate uppercase">
              <span>Sahyak OS</span>
            </h1>
            <span className="text-[10px] text-amber-400 font-semibold tracking-wider block uppercase">
              Super Admin Control
            </span>
          </div>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="p-1 text-slate-400 hover:text-white rounded-lg md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav Items List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 custom-scrollbar">
        {SUPERADMIN_NAV_CATEGORIES.map((category) => (
          <div key={category.name} className="space-y-1">
            <div className="px-2.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
              {category.name}
            </div>
            <div className="space-y-0.5">
              {category.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${isActive
                        ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30 shadow-sm shadow-amber-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Switcher */}
      <div className="p-3 border-t border-slate-800/80 bg-[#050811] shrink-0 space-y-2">
        <Link
          href="/admin"
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-medium transition-colors"
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Org Admin CRM</span>
          </span>
          <ArrowUpRight className="w-3 h-3 text-slate-300 shrink-0" />
        </Link>

        <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-slate-300">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs font-bold shrink-0">
              👑
            </div>
            <div className="truncate">
              <div className="text-white font-semibold truncate text-[11px]">{currentUser?.name || 'Super Admin'}</div>
              <div className="text-[9px] text-slate-300 truncate">Platform Owner</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
