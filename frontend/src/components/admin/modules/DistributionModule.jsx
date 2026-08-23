'use client';

import React from 'react';
import { Plus, Trash2, GitFork, CheckCircle2, ShieldCheck, Users } from 'lucide-react';
import DataTable from '../ui/DataTable';
import ErrorState from '../ui/ErrorState';

export default function DistributionModule({
  rules = [],
  loading = false,
  error = null,
  onRetry,
  onAddRule,
  onDeleteRule,
  onReassignLeads,
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const columns = [
    {
      header: 'Rule Name',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-white">{row.name}</span>
        </div>
      ),
    },
    {
      header: 'Routing Strategy',
      accessor: 'strategy',
      render: (row) => (
        <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[11px]">
          {row.strategy || 'ROUND_ROBIN'}
        </span>
      ),
    },
    {
      header: 'Priority',
      accessor: 'priority',
      render: (row) => <span className="font-semibold text-slate-300">{row.priority || 1}</span>,
    },
    {
      header: 'Source Scope',
      accessor: 'conditions',
      render: (row) => (
        <span className="text-slate-400 text-xs">{row.conditions?.sourceType || 'ALL'}</span>
      ),
    },
    {
      header: 'Assigned Pool Size',
      accessor: 'assignees',
      render: (row) => (
        <div className="flex items-center gap-1 text-slate-300 text-xs">
          <Users className="w-3.5 h-3.5 text-purple-400" />
          <span>{row.assignees?.length || 0} Reps</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'isActive',
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            row.isActive !== false ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
          }`}
        >
          {row.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (row) => (
        <button
          onClick={() => onDeleteRule && onDeleteRule(row._id)}
          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
          title="Delete Rule"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Automated Lead Distribution Engine
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Configure round-robin, least-loaded, and source-targeted lead assignment algorithms
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onReassignLeads && (
            <button
              onClick={onReassignLeads}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              Reassign Leads
            </button>
          )}
          {onAddRule && (
            <button
              onClick={onAddRule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-amber-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Rule</span>
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rules}
        loading={loading}
        emptyTitle="No distribution rules defined"
        emptyDescription="Create your first automated distribution rule to route incoming leads among your reps."
        emptyActionLabel="Create First Rule"
        onEmptyAction={onAddRule}
      />
    </div>
  );
}
