'use client';

import React from 'react';
import { BarChart3, TrendingUp, DollarSign, Award, Users, Target } from 'lucide-react';
import MetricCard from '../ui/MetricCard';
import DataTable from '../ui/DataTable';
import ErrorState from '../ui/ErrorState';
import LoadingSkeleton from '../ui/LoadingSkeleton';

export default function AnalyticsModule({
  analytics = null,
  loading = false,
  error = null,
  onRetry,
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton type="card" count={3} />
        <LoadingSkeleton type="table" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const {
    campaignStats = { totalBudget: 0, totalAdSpend: 0, totalLeadsReported: 0 },
    revenueStats = { totalRevenue: 0, totalWonDeals: 0 },
    repPerformance = [],
    stageFunnel = [],
    sourceAttribution = [],
  } = analytics || {};

  const totalRevenue = revenueStats.totalRevenue || 0;
  const totalAdSpend = campaignStats.totalAdSpend || 0;
  const roas = totalAdSpend > 0 ? (totalRevenue / totalAdSpend).toFixed(2) : '0';

  const repColumns = [
    {
      header: 'Sales Representative',
      accessor: 'repName',
      render: (row) => (
        <div>
          <div className="font-bold text-white text-xs flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{row.repName || 'Sales Rep'}</span>
          </div>
          {row.managerName && (
            <div className="text-[10px] text-slate-400">Mgr: {row.managerName}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Assigned Leads',
      accessor: 'totalAssigned',
      render: (row) => <span className="font-semibold text-slate-200 text-xs">{row.totalAssigned || 0}</span>,
    },
    {
      header: 'Won Deals',
      accessor: 'convertedCount',
      render: (row) => <span className="font-bold text-emerald-400 text-xs">{row.convertedCount || 0}</span>,
    },
    {
      header: 'Conversion Rate',
      accessor: 'conversionRate',
      render: (row) => (
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold text-xs border border-emerald-500/20">
          {row.conversionRate || 0}%
        </span>
      ),
    },
    {
      header: 'Total Revenue Generated',
      accessor: 'totalRevenue',
      render: (row) => (
        <span className="font-bold text-white text-xs">
          ₹{Number(row.totalRevenue || 0).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top ROI KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Pipeline Revenue"
          value={`₹${totalRevenue.toLocaleString()}`}
          subtitle={`${revenueStats.totalWonDeals || 0} verified won deals`}
          icon={DollarSign}
          iconColor="text-emerald-400"
        />

        <MetricCard
          title="Total Paid Ad Spend"
          value={`₹${totalAdSpend.toLocaleString()}`}
          subtitle={`Budget: ₹${Number(campaignStats.totalBudget || 0).toLocaleString()}`}
          icon={Target}
          iconColor="text-blue-400"
        />

        <MetricCard
          title="Blended ROAS Return"
          value={`${roas}x`}
          subtitle="Return On Ad Spend (ROAS)"
          icon={TrendingUp}
          iconColor="text-amber-400"
        />
      </div>

      {/* Representative Performance Leaderboard */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Sales Representative Performance Leaderboard
          </h3>
          <span className="text-[11px] text-slate-400">Ranked by revenue realized</span>
        </div>

        <DataTable
          columns={repColumns}
          data={repPerformance}
          emptyTitle="No rep performance data"
          emptyDescription="As representatives close leads, their conversion rates and deal values will rank here."
        />
      </div>

      {/* Source Performance & Deal Size */}
      {sourceAttribution.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Lead Source Conversion & Revenue Attribution
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sourceAttribution.map((src, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#0d1424] border border-slate-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase">{src.sourceName || 'Direct'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {src.platformName}
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xl font-bold text-white">₹{Number(src.totalRevenue || 0).toLocaleString()}</span>
                  <span className="text-xs text-emerald-400 font-semibold">{src.conversionRate || 0}% conv</span>
                </div>
                <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-800/60">
                  <span>Inbound: {src.inboundLeads || 0}</span>
                  <span>Won: {src.conversions || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
