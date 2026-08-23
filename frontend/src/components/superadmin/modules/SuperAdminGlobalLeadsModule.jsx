'use client';

import React from 'react';
import { Layers, Search, Filter } from 'lucide-react';

export default function SuperAdminGlobalLeadsModule({
  leads = [],
  pagination = {},
  loading = false,
  search = '',
  onSearchChange = null,
  stageFilter = 'all',
  onStageFilterChange = null,
  sourceFilter = 'all',
  onSourceFilterChange = null,
  onPageChange = null,
}) {
  return (
    <div className="space-y-4">
      {/* Search & Canonical Filters */}
      <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="Search leads across all organizations..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>

          <select
            value={stageFilter}
            onChange={(e) => onStageFilterChange && onStageFilterChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Canonical Stages</option>
            <option value="new_lead">New Lead</option>
            <option value="contacted">Contacted</option>
            <option value="not_interested">Not Interested</option>
            <option value="converted">Converted</option>
            <option value="payment_done">Payment Done</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => onSourceFilterChange && onSourceFilterChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Sources</option>
            <option value="MANUAL">Manual Inbound</option>
            <option value="USER_SIGNUP">Platform Signup</option>
            <option value="ADS">Ads / Webhook</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Global CRM Volume: {pagination.total || leads.length} leads
        </div>
      </div>

      {/* Global Leads Table */}
      <div className="rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0a0f1d] text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Prospect & Contact</th>
                <th className="px-4 py-3">Tenant Organisation</th>
                <th className="px-4 py-3">Canonical Stage</th>
                <th className="px-4 py-3">Origin Source</th>
                <th className="px-4 py-3">Assigned Agent</th>
                <th className="px-4 py-3">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {leads.map((l) => (
                <tr key={l._id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{l.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{l.phone} {l.email ? `• ${l.email}` : ''}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-300">
                    {l.companyId?.companyInfo?.companyName || l.companyId?.name || 'Main Tenant'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                      {l.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-[11px]">
                    {l.assignedTo?.name || 'Unassigned'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                    {new Date(l.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
