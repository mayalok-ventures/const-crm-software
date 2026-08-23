'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus, Phone, Mail, UserCheck, Calendar, Clock, DollarSign,
  Building2, User, ChevronRight, Eye, MoreHorizontal, Sparkles, XCircle,
  Layers, CheckCircle2, AlertCircle, MessageSquare
} from 'lucide-react';
import FilterBar from '../ui/FilterBar';
import DataTable from '../ui/DataTable';
import Pagination from '../ui/Pagination';
import StatusBadge from '../ui/StatusBadge';
import ErrorState from '../ui/ErrorState';

export const PIPELINE_TABS = [
  { id: 'all', label: 'All Leads' },
  { id: 'new_lead', label: 'New Leads' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'converted', label: 'Converted' },
  { id: 'payment_done', label: 'Payment Done' },
  { id: 'not_interested', label: 'Not Interested' },
];

export default function LeadsModule({
  leads = [],
  pagination = { page: 1, total: 0, pages: 1 },
  loading = false,
  error = null,
  onRetry,
  search = '',
  onSearchChange,
  sourceFilter = 'all',
  onSourceFilterChange,
  stageFilter = 'all',
  onStageFilterChange,
  page = 1,
  onPageChange,
  onStageChange,
  onAddLead,
  onLeadClick,
  onCancelFollowUp,
  onCloseDeal,
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  // Format Origin Tag
  const getOriginBadge = (lead) => {
    const raw = (lead.primarySource || lead.source || '').toLowerCase();
    if (raw.includes('ad') || raw.includes('meta') || raw.includes('google') || raw.includes('webhook')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">ADS</span>;
    }
    if (raw.includes('signup') || raw.includes('auto') || raw.includes('registration')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">SIGNUP</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30">MANUAL</span>;
  };

  const normalizeStage = (status) => {
    if (!status) return 'new_lead';
    const s = String(status).toLowerCase();
    if (s.includes('payment') || s.includes('won') || s === 'closed') return 'payment_done';
    if (s.includes('converted') || s.includes('qualified') || s.includes('documents') || s.includes('negotiation')) return 'converted';
    if (s.includes('not_interested') || s.includes('not interested') || s.includes('lost') || s.includes('rejected')) return 'not_interested';
    if (s.includes('contacted') || s.includes('inquiry') || s.includes('demo') || s.includes('floor') || s.includes('attempted')) return 'contacted';
    return 'new_lead';
  };

  // Calculate count per pipeline tab
  const stageCounts = useMemo(() => {
    const counts = { all: leads.length, new_lead: 0, contacted: 0, converted: 0, payment_done: 0, not_interested: 0 };
    leads.forEach((l) => {
      const st = normalizeStage(l.status);
      if (counts[st] !== undefined) counts[st]++;
    });
    return counts;
  }, [leads]);

  const tableColumns = [
    {
      header: 'Lead Name & Company',
      accessor: 'name',
      render: (row) => {
        const isCompany = Boolean(row.company || row.companyId);
        return (
          <div
            onClick={() => onLeadClick && onLeadClick(row)}
            className="cursor-pointer group flex items-start gap-2 max-w-[200px]"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0 group-hover:border-amber-500/50 transition-colors">
              {row.name?.charAt(0) || 'L'}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white text-xs truncate group-hover:text-amber-300 transition-colors flex items-center gap-1">
                <span className="truncate">{row.name}</span>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-amber-400 shrink-0" />
              </div>
              <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 font-mono">
                {row.phone}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Origin',
      accessor: 'primarySource',
      render: (row) => getOriginBadge(row),
    },
    {
      header: 'Entity Scope',
      accessor: 'type',
      render: (row) => {
        const isOrg = Boolean(row.company || row.companyId);
        return (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${isOrg ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'bg-slate-800 text-slate-400'}`}>
            {isOrg ? (row.company || 'Organization') : 'Solo User'}
          </span>
        );
      },
    },
    {
      header: 'Pipeline Stage',
      accessor: 'status',
      render: (row) => (
        <select
          value={normalizeStage(row.status)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStageChange && onStageChange(row._id, e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500 font-medium"
        >
          {PIPELINE_TABS.filter((t) => t.id !== 'all').map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      header: 'Assigned Agent',
      accessor: 'assignedTo',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-amber-400 shrink-0">
            {row.assignedTo?.name ? row.assignedTo.name.charAt(0) : '?'}
          </div>
          <span className="truncate max-w-[100px] text-[11px] font-medium">
            {row.assignedTo?.name || 'Unassigned'}
          </span>
        </div>
      ),
    },
    {
      header: 'Follow-Up Status',
      accessor: 'followUpDate',
      render: (row) => {
        if (!row.followUpDate) {
          return <span className="text-[10px] text-slate-500 font-mono">No Follow-Up</span>;
        }
        const isPast = new Date(row.followUpDate) < new Date();
        return (
          <div className="space-y-0.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
              isPast ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              ⏰ {new Date(row.followUpDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Deal Value',
      accessor: 'payable_amount',
      render: (row) => {
        const val = row.closedDealAmount || row.payable_amount || row.paid_amount || 0;
        return (
          <span className="font-mono font-bold text-xs text-emerald-400">
            ₹{val.toLocaleString('en-IN')}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onLeadClick && onLeadClick(row)}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
            title="Open Full Profile"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <a
            href={`tel:${row.phone}`}
            className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-md hover:bg-slate-800 transition-colors"
            title="Call"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
          <a
            href={`https://wa.me/${String(row.phone).replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-md hover:bg-slate-800 transition-colors"
            title="WhatsApp Message"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={() => onCloseDeal && onCloseDeal(row)}
            className="p-1.5 text-slate-400 hover:text-amber-300 rounded-md hover:bg-slate-800 transition-colors"
            title="Close Deal"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* 1. PIPELINE TABS BAR */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto custom-scrollbar">
        {PIPELINE_TABS.map((tab) => {
          const isActive = stageFilter === tab.id;
          const count = stageCounts[tab.id] || 0;
          return (
            <button
              key={tab.id}
              onClick={() => onStageFilterChange && onStageFilterChange(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isActive ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Top Filter and Search Bar */}
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search leads by name, phone, email, or company..."
        sourceFilter={sourceFilter}
        onSourceFilterChange={onSourceFilterChange}
        stageFilter={stageFilter}
        onStageFilterChange={onStageFilterChange}
        onAddLead={onAddLead}
      />

      {/* 3. Primary Horizontal Rectangular Table Workspace */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0d1424] overflow-hidden shadow-sm">
        <DataTable
          columns={tableColumns}
          data={leads}
          loading={loading}
          emptyMessage="No leads found matching the selected filters in this workspace."
          onRowClick={(row) => onLeadClick && onLeadClick(row)}
        />
      </div>

      {/* 4. Pagination */}
      {pagination && pagination.pages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
