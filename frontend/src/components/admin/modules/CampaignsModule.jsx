'use client';

import React from 'react';
import { Plus, Target, Trash2, TrendingUp, DollarSign, Radio, AlertCircle } from 'lucide-react';
import DataTable from '../ui/DataTable';
import ErrorState from '../ui/ErrorState';

export default function CampaignsModule({
  campaigns = [],
  loading = false,
  error = null,
  isIntegrationConnected = true,
  onRetry,
  onAddCampaign,
  onDeleteCampaign,
  onNavigateToIntegrations,
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const columns = [
    {
      header: 'Campaign Name',
      accessor: 'campaignName',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="font-bold text-white text-xs">{row.campaignName}</div>
            <div className="text-[10px] text-slate-400 font-mono">ID: {row.campaignId || 'MANUAL'}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Platform',
      accessor: 'platform',
      render: (row) => {
        const p = String(row.platform || 'META').toUpperCase();
        return (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              p === 'META'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : p === 'GOOGLE'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {p}
          </span>
        );
      },
    },
    {
      header: 'Budget / Spent',
      accessor: 'budget',
      render: (row) => (
        <div className="text-xs">
          <span className="font-bold text-white">₹{Number(row.amountSpent || 0).toLocaleString()}</span>
          <span className="text-slate-400 text-[11px]"> / ₹{Number(row.budget || 0).toLocaleString()}</span>
        </div>
      ),
    },
    {
      header: 'Leads Generated',
      accessor: 'leadsGenerated',
      render: (row) => (
        <span className="font-bold text-slate-200 text-xs">{row.leadsGenerated || 0}</span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            row.status === 'ACTIVE'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {row.status || 'ACTIVE'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (row) => (
        <button
          onClick={() => onDeleteCampaign && onDeleteCampaign(row._id)}
          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
          title="Delete Campaign"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Campaigns & Paid Ads Attribution
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Track Meta and Google Ad spend against converted lead pipeline revenue
          </p>
        </div>

        {onAddCampaign && (
          <button
            onClick={onAddCampaign}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-amber-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Campaign</span>
          </button>
        )}
      </div>

      {!isIntegrationConnected && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 text-amber-300">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Ad Connector is currently disconnected. Live ad sync is paused.</span>
          </div>
          {onNavigateToIntegrations && (
            <button
              onClick={onNavigateToIntegrations}
              className="text-xs underline font-semibold text-amber-400 hover:text-amber-300"
            >
              Configure Integration
            </button>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={campaigns}
        loading={loading}
        emptyTitle="No ad campaigns tracked"
        emptyDescription="Create your first campaign tracker or connect your Meta/Google ads account."
        emptyActionLabel="Create Campaign Tracker"
        onEmptyAction={onAddCampaign}
      />
    </div>
  );
}
