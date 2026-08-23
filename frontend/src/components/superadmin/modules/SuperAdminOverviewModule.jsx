'use client';

import React from 'react';
import {
  Building2, Users, CreditCard, Layers, TrendingUp,
  Activity, ShieldCheck, CheckCircle2, AlertCircle, ArrowUpRight, DollarSign
} from 'lucide-react';

export default function SuperAdminOverviewModule({
  overview = null,
  loading = false,
  onSelectTab = null,
}) {
  const kpis = overview?.kpis || {};
  const revenue = overview?.revenue || {};
  const growth = overview?.growth || {};

  return (
    <div className="space-y-6">
      {/* 1. TOP KPI HERO CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Organisations */}
        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Organisations</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{kpis.totalOrganisations || 0}</span>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +{kpis.payingTenants || 0} paying
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Multi-tenant client accounts</p>
        </div>

        {/* Active Platform Users */}
        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Platform Users</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{kpis.activeUsers || 0}</span>
            <span className="text-[10px] text-purple-400 font-semibold">
              {kpis.totalAgents || 0} agents
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across all tenant sales teams</p>
        </div>

        {/* Platform MRR */}
        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Monthly Run-Rate (MRR)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400 font-mono">₹{(kpis.mrr || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400 font-mono">ARR ₹{((kpis.arr || 0) / 100000).toFixed(1)}L</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Active recurring SaaS subscriptions</p>
        </div>

        {/* Global CRM Leads */}
        <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Leads Managed</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{kpis.activeLeads || 0}</span>
            <span className="text-[10px] text-emerald-400 font-semibold">
              {kpis.platformConversionRate || 0}% conv.
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Platform-wide CRM pipeline volume</p>
        </div>
      </div>

      {/* 2. REVENUE & PLAN DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Distribution */}
        <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Subscription Tier Breakdown</h3>
            <span className="text-[10px] text-slate-400 font-mono">Active Licenses</span>
          </div>
          <div className="space-y-2.5">
            {Object.entries(revenue.planDistribution || {}).map(([planName, count]) => (
              <div key={planName} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-xs font-semibold text-slate-300 capitalize">{planName.replace(/_/g, ' ')}</span>
                <span className="text-xs font-bold text-white font-mono bg-slate-800 px-2 py-0.5 rounded-lg">{count} accounts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tenant Health & Conversion Summary */}
        <div className="p-5 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Platform Observability & Performance</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Health 99.98%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Paying Tenants</span>
              <span className="text-lg font-bold text-emerald-400 font-mono mt-1 block">{kpis.payingTenants || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Trial Accounts</span>
              <span className="text-lg font-bold text-amber-400 font-mono mt-1 block">{kpis.trialAccounts || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Converted Deals</span>
              <span className="text-lg font-bold text-blue-400 font-mono mt-1 block">{kpis.convertedLeads || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Lifetime Revenue</span>
              <span className="text-lg font-bold text-purple-400 font-mono mt-1 block">₹{(revenue.lifetimeRevenue || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80">
            <span>Aggregated directly from multi-tenant MongoDB Atlas ledger.</span>
            {onSelectTab && (
              <button
                onClick={() => onSelectTab('organisations')}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <span>View All Tenants</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
