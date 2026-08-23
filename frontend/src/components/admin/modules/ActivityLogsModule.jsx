'use client';

import React from 'react';
import { History, Shield, User, Filter, Search, Clock } from 'lucide-react';
import FilterBar from '../ui/FilterBar';
import DataTable from '../ui/DataTable';
import ErrorState from '../ui/ErrorState';

export default function ActivityLogsModule({
  logs = [],
  loading = false,
  error = null,
  onRetry,
  search = '',
  onSearchChange,
  actionFilter = 'all',
  onActionFilterChange,
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const columns = [
    {
      header: 'Timestamp',
      accessor: 'createdAt',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{row.createdAt ? new Date(row.createdAt).toLocaleString() : 'Just now'}</span>
        </div>
      ),
    },
    {
      header: 'Actor & Role',
      accessor: 'actor',
      render: (row) => (
        <div>
          <div className="font-bold text-white text-xs">
            {row.actor?.name || row.performerName || 'System'}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {row.actorRole || row.role || 'admin'}
          </div>
        </div>
      ),
    },
    {
      header: 'Action',
      accessor: 'action',
      render: (row) => {
        const a = String(row.action || 'UPDATE').toUpperCase();
        return (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              a.includes('CREATE')
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : a.includes('DELETE')
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : a.includes('STATUS') || a.includes('ASSIGN')
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {a}
          </span>
        );
      },
    },
    {
      header: 'Entity Type',
      accessor: 'entityType',
      render: (row) => (
        <span className="text-xs font-semibold text-purple-300 font-mono">
          {row.entityType || row.targetType || 'User'}
        </span>
      ),
    },
    {
      header: 'Details & Changes',
      accessor: 'details',
      render: (row) => (
        <div className="text-xs text-slate-300 max-w-md">
          <span>{row.details || 'Operational modification'}</span>
        </div>
      ),
    },
    {
      header: 'IP Address',
      accessor: 'ipAddress',
      render: (row) => (
        <span className="text-[11px] text-slate-400 font-mono">{row.ipAddress || '127.0.0.1'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search audit events by actor, action, or details..."
      >
        <select
          value={actionFilter}
          onChange={(e) => onActionFilterChange && onActionFilterChange(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Actions</option>
          <option value="CREATE">Creation (CREATE)</option>
          <option value="UPDATE">Modifications (UPDATE)</option>
          <option value="DELETE">Deletions (DELETE)</option>
          <option value="ASSIGN">Assignments (ASSIGN)</option>
          <option value="STATUS_CHANGE">Stage Changes (STATUS)</option>
        </select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        emptyTitle="No activity logs recorded"
        emptyDescription="System modifications and sensitive admin actions will automatically generate immutable audit trails here."
      />
    </div>
  );
}
