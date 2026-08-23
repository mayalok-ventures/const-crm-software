'use client';

import React from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, Users, GitFork, Workflow, UserCheck, Bell,
  FileText, MessageSquare, Target, ShoppingBag, DollarSign, Ticket,
  BarChart3, History, Radio, Shield, Activity, RefreshCw, ArrowUpRight,
  X, Building2, User
} from 'lucide-react';

export const NAV_CATEGORIES = [
  {
    name: 'CORE',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    name: 'LEADS',
    items: [
      { id: 'leads', label: 'Leads & Sources', icon: Users },
      { id: 'distribution', label: 'Lead Distribution', icon: GitFork },
      { id: 'pipelines', label: 'Pipelines & SLAs', icon: Workflow },
    ],
  },
  {
    name: 'ORGANIZATION',
    items: [
      { id: 'hierarchy', label: 'Hierarchy & Teams', icon: UserCheck },
      { id: 'broadcasts', label: 'Broadcast Centre', icon: Bell },
    ],
  },
  {
    name: 'GROWTH',
    items: [
      { id: 'forms', label: 'Forms Centre', icon: FileText },
      { id: 'templates', label: 'Template Centre', icon: MessageSquare },
      { id: 'campaigns', label: 'Campaigns & Ads', icon: Target },
    ],
  },
  {
    name: 'COMMERCE',
    items: [
      { id: 'plans', label: 'Plans Centre', icon: ShoppingBag },
      { id: 'catalogue', label: 'Catalogue Centre', icon: ShoppingBag },
      { id: 'commissions', label: 'Commission Engine', icon: DollarSign },
      { id: 'coupons', label: 'Coupon Engine', icon: Ticket },
    ],
  },
  {
    name: 'INTELLIGENCE',
    items: [
      { id: 'analytics', label: 'Universal Analytics', icon: BarChart3 },
      { id: 'activity', label: 'Activity & Audit Logs', icon: History },
    ],
  },
  {
    name: 'SYSTEM',
    items: [
      { id: 'profile', label: 'Organization & Profile', icon: Building2 },
      { id: 'integrations', label: 'Integration Centre', icon: Radio },
      { id: 'security', label: 'Security & Access', icon: Shield },
      { id: 'health', label: 'System Health', icon: Activity },
    ],
  },
];

export default function AdminSidebar({
  activeTab,
  onSelectTab,
  onRefresh,
  refreshing = false,
  currentUser,
  onCloseMobile,
}) {
  return (
    <div className="flex flex-col h-full w-full bg-[#0a0f1d] overflow-hidden border-r border-slate-800/80 select-none">
      {/* Logo & Workspace Title */}
      <div className="p-4 border-b border-slate-800/60 flex items-center justify-between bg-[#070b14]/70 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center font-bold text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
            ⚡
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm text-white tracking-tight leading-none truncate">CoreSetu OS</h1>
            <span className="text-[10px] font-medium text-amber-400/90 tracking-wide uppercase">Admin Control</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
            title="Refresh Workspace"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 md:hidden transition-colors"
              title="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Category Groups (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
        {NAV_CATEGORIES.map((cat) => (
          <div key={cat.name} className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 tracking-wider">
              {cat.name}
            </div>
            {cat.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-800/60 bg-[#070b14]/70 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
              {currentUser?.name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{currentUser?.name || 'Administrator'}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser?.email || currentUser?.phone || 'admin@crm.com'}</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors shrink-0"
            title="Return to CRM"
          >
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
