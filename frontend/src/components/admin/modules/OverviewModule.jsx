'use client';

import React from 'react';
import { Users, TrendingUp, DollarSign, UserCheck, ArrowRight, ShieldAlert } from 'lucide-react';
import MetricCard from '../ui/MetricCard';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ErrorState from '../ui/ErrorState';

const KANBAN_STAGES = [
  { id: 'new_lead', label: 'New Lead', color: 'border-slate-700 bg-slate-500/10 text-slate-300', dot: 'bg-slate-400' },
  { id: 'contacted', label: 'Contacted', color: 'border-blue-700/40 bg-blue-500/10 text-blue-300', dot: 'bg-blue-400' },
  { id: 'not_interested', label: 'Not Interested', color: 'border-rose-700/40 bg-rose-500/10 text-rose-300', dot: 'bg-rose-400' },
  { id: 'converted', label: 'Converted', color: 'border-emerald-700/40 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
  { id: 'payment_done', label: 'Payment Done', color: 'border-purple-700/40 bg-purple-500/10 text-purple-300', dot: 'bg-purple-400' },
];

export default function OverviewModule({
  metrics,
  loading = false,
  error = null,
  onRetry,
  onNavigateToLeads,
  onNavigateToHierarchy,
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={4} />
        <div className="h-32 bg-[#0d1424] border border-slate-800 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 bg-[#0d1424] border border-slate-800 rounded-xl animate-pulse" />
          <div className="h-28 bg-[#0d1424] border border-slate-800 rounded-xl animate-pulse" />
          <div className="h-28 bg-[#0d1424] border border-slate-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. EXECUTIVE KPI GRID (4 CORE CARDS)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Leads Inbound"
          value={metrics?.totalLeads ?? 0}
          subtitle={`+${metrics?.todayLeads || 0} today`}
          icon={Users}
          iconColor="text-blue-400"
          onClick={() => onNavigateToLeads && onNavigateToLeads()}
        />

        <MetricCard
          title="Conversion Rate"
          value={metrics?.conversionRate || '0%'}
          subtitle={`${metrics?.convertedLeads || 0} closed deals`}
          icon={TrendingUp}
          iconColor="text-emerald-400"
          onClick={() => onNavigateToLeads && onNavigateToLeads({ stage: 'converted' })}
        />

        <MetricCard
          title="Total Sales Revenue"
          value={`₹${(metrics?.totalRevenue || 0).toLocaleString()}`}
          subtitle="Across all closed pipelines"
          icon={DollarSign}
          iconColor="text-amber-400"
          onClick={() => onNavigateToLeads && onNavigateToLeads({ stage: 'payment_done' })}
        />

        <MetricCard
          title="Active Hierarchy"
          value={`${metrics?.activeAgents || 0} Agents`}
          subtitle={`Under ${metrics?.activeManagers || 0} Managers`}
          icon={UserCheck}
          iconColor="text-purple-400"
          onClick={() => onNavigateToHierarchy && onNavigateToHierarchy()}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. CANONICAL 5-STAGE SALES FUNNEL
      ────────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-xl bg-[#0d1424] border border-slate-800/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Canonical 5-Stage Sales Funnel
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Real-time multi-tenant lead movement across canonical stages
            </p>
          </div>
          <button
            onClick={() => onNavigateToLeads && onNavigateToLeads()}
            className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 transition-colors"
          >
            <span>Open Kanban</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {KANBAN_STAGES.map((stage) => {
            const count = metrics?.stageCounts?.[stage.id] || 0;
            const pct = metrics?.totalLeads > 0 ? ((count / metrics.totalLeads) * 100).toFixed(1) : '0';

            return (
              <div
                key={stage.id}
                onClick={() => onNavigateToLeads && onNavigateToLeads({ stage: stage.id })}
                className={`p-3.5 rounded-lg border ${stage.color} flex flex-col justify-between hover:scale-[1.02] cursor-pointer transition-all shadow-sm`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold">{stage.label}</span>
                  <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <div className="text-2xl font-bold text-white">{count}</div>
                  <span className="text-[10px] text-slate-400 font-medium">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. 3-TIER LEAD SOURCE BREAKDOWN
      ────────────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Lead Source Distribution
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Verified attribution across manual entries, user signups, and ad webhooks
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => onNavigateToLeads && onNavigateToLeads({ primarySource: 'SOURCE_A_MANUAL' })}
            className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 hover:border-amber-500/40 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase">SOURCE A — MANUAL</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Direct</span>
            </div>
            <div className="text-2xl font-bold text-white mt-2 group-hover:text-amber-300 transition-colors">
              {metrics?.sourceBreakdown?.manual || 0} Leads
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Direct admin & rep entry</p>
          </div>

          <div
            onClick={() => onNavigateToLeads && onNavigateToLeads({ primarySource: 'SOURCE_B_SIGNUP' })}
            className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 hover:border-amber-500/40 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase">SOURCE B — USER SIGNUP</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 font-mono">Organic</span>
            </div>
            <div className="text-2xl font-bold text-white mt-2 group-hover:text-amber-300 transition-colors">
              {metrics?.sourceBreakdown?.signup || 0} Leads
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Platform user registrations</p>
          </div>

          <div
            onClick={() => onNavigateToLeads && onNavigateToLeads({ primarySource: 'SOURCE_C_ADS' })}
            className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 hover:border-amber-500/40 cursor-pointer transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase">SOURCE C — ADS & WEBHOOKS</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 font-mono">Paid</span>
            </div>
            <div className="text-2xl font-bold text-white mt-2 group-hover:text-amber-300 transition-colors">
              {metrics?.sourceBreakdown?.ads || 0} Leads
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Meta, Google & API Ingestion</p>
          </div>
        </div>
      </div>
    </div>
  );
}
