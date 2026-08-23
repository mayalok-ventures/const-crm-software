'use client';

import React from 'react';
import { Plus, Bell, Send, CheckCircle2, Radio, Calendar } from 'lucide-react';
import DataTable from '../ui/DataTable';
import ErrorState from '../ui/ErrorState';

export default function BroadcastsModule({
  broadcasts = [],
  loading = false,
  error = null,
  onRetry,
  onNewBroadcast,
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const columns = [
    {
      header: 'Announcement Title',
      accessor: 'title',
      render: (row) => (
        <div>
          <div className="font-bold text-white text-xs flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{row.title}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{row.message}</div>
        </div>
      ),
    },
    {
      header: 'Priority',
      accessor: 'priority',
      render: (row) => {
        const p = String(row.priority || 'NORMAL').toUpperCase();
        return (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              p === 'URGENT'
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                : p === 'HIGH'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {p}
          </span>
        );
      },
    },
    {
      header: 'Target Audience',
      accessor: 'targetAudience',
      render: (row) => (
        <span className="text-slate-300 text-xs">{row.targetAudience || 'All Staff'}</span>
      ),
    },
    {
      header: 'Delivery Channels',
      accessor: 'deliveryChannels',
      render: (row) => (
        <div className="flex gap-1 flex-wrap">
          {(row.deliveryChannels || ['IN_APP']).map((c, i) => (
            <span key={i} className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
              {c}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: 'Dispatched At',
      accessor: 'createdAt',
      render: (row) => (
        <span className="text-[11px] text-slate-400">
          {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'Just now'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Organization Broadcast & Notification Engine
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Dispatch urgent notices, sales targets, and real-time operational alerts across team screens
          </p>
        </div>

        {onNewBroadcast && (
          <button
            onClick={onNewBroadcast}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-amber-500/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Broadcast</span>
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={broadcasts}
        loading={loading}
        emptyTitle="No broadcasts dispatched yet"
        emptyDescription="Send your first company-wide announcement or motivational push to all reps."
        emptyActionLabel="Send First Broadcast"
        onEmptyAction={onNewBroadcast}
      />
    </div>
  );
}
