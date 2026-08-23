'use client';

import React, { useState } from 'react';
import { Plus, DollarSign, Trash2, CheckCircle2, Clock, Percent } from 'lucide-react';
import DataTable from '../ui/DataTable';
import ErrorState from '../ui/ErrorState';

export default function CommissionsModule({
  rules = [],
  payouts = [],
  loading = false,
  error = null,
  onRetry,
  onAddRule,
  onDeleteRule,
}) {
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'payouts'

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const ruleColumns = [
    {
      header: 'Rule Name',
      accessor: 'ruleName',
      render: (row) => (
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold text-white text-xs">{row.ruleName}</span>
        </div>
      ),
    },
    {
      header: 'Target Role',
      accessor: 'targetRole',
      render: (row) => (
        <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-mono text-[10px]">
          {row.targetRole || 'AGENT'}
        </span>
      ),
    },
    {
      header: 'Incentive Calculation',
      accessor: 'value',
      render: (row) => (
        <span className="font-bold text-emerald-400 text-xs">
          {row.commissionType === 'PERCENTAGE' ? `${row.value}% of Deal` : `₹${row.value} Flat`}
        </span>
      ),
    },
    {
      header: 'Stage Threshold',
      accessor: 'stageThreshold',
      render: (row) => (
        <span className="text-slate-300 text-xs">{row.stageThreshold || 'Payment Done'}</span>
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

  const payoutColumns = [
    {
      header: 'Sales Representative',
      accessor: 'agent',
      render: (row) => (
        <span className="font-bold text-white text-xs">{row.agent?.name || row.agentName || 'Agent'}</span>
      ),
    },
    {
      header: 'Deal / Lead',
      accessor: 'lead',
      render: (row) => (
        <span className="text-slate-300 text-xs">{row.lead?.name || 'Lead Deal'}</span>
      ),
    },
    {
      header: 'Deal Value',
      accessor: 'dealAmount',
      render: (row) => (
        <span className="text-slate-300 text-xs font-mono">
          ₹{Number(row.dealAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Commission Amount',
      accessor: 'commissionAmount',
      render: (row) => (
        <span className="font-bold text-emerald-400 text-xs font-mono">
          ₹{Number(row.commissionAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Payout Status',
      accessor: 'status',
      render: (row) => {
        const s = String(row.status || 'PENDING').toUpperCase();
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              s === 'PAID'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : s === 'APPROVED'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
            }`}
          >
            {s}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-[#0d1424] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Sales Commission & Payout Engine
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Configure automated rep incentive percentages, performance tiers, and payout settlements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border border-slate-700 rounded-lg overflow-hidden shrink-0">
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'rules' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              Incentive Rules
            </button>
            <button
              onClick={() => setActiveTab('payouts')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'payouts' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              Payout Ledger
            </button>
          </div>

          {onAddRule && (
            <button
              onClick={onAddRule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-amber-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Rule</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'rules' ? (
        <DataTable
          columns={ruleColumns}
          data={rules}
          loading={loading}
          emptyTitle="No commission rules created"
          emptyDescription="Set up percentage or flat bonus rules triggered on closed sales deals."
          emptyActionLabel="Create First Rule"
          onEmptyAction={onAddRule}
        />
      ) : (
        <DataTable
          columns={payoutColumns}
          data={payouts}
          loading={loading}
          emptyTitle="No commission payouts recorded"
          emptyDescription="Payouts are generated automatically when reps close deals matching your active incentive rules."
        />
      )}
    </div>
  );
}
