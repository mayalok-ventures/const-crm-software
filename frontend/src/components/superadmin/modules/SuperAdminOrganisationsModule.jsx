'use client';

import React, { useState } from 'react';
import {
  Building2, Search, Filter, ShieldAlert, Eye,
  Shield, CheckCircle2, XCircle, ArrowRight, Loader2
} from 'lucide-react';

export default function SuperAdminOrganisationsModule({
  organisations = [],
  pagination = {},
  loading = false,
  search = '',
  onSearchChange = null,
  statusFilter = 'all',
  onStatusFilterChange = null,
  onInspectTenant = null,
  onImpersonate = null,
  onStatusUpdate = null,
  onPageChange = null,
}) {
  return (
    <div className="space-y-4">
      {/* Control Bar: Search & Status Filters */}
      <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="Search by organization name, owner, phone..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange && onStatusFilterChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing {organisations.length} of {pagination.total || 0} organisations
        </div>
      </div>

      {/* Organisations Table */}
      <div className="rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0a0f1d] text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Organisation & Owner</th>
                <th className="px-4 py-3">License Plan</th>
                <th className="px-4 py-3">Team Size</th>
                <th className="px-4 py-3">CRM Leads</th>
                <th className="px-4 py-3">Est. MRR</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && organisations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin mx-auto mb-2" />
                    Loading multi-tenant roster...
                  </td>
                </tr>
              )}

              {!loading && organisations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No organisations match your search criteria.
                  </td>
                </tr>
              )}

              {organisations.map((org) => {
                const isBlocked = org.status === 'BLOCKED';
                return (
                  <tr key={org._id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{org.organisationName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {org.ownerName} • <span className="font-mono">{org.ownerEmail || org.ownerPhone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 capitalize">
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {org.usersCount} users ({org.agentsCount} agents)
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {org.leadsCount} leads
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                      ₹{(org.mrr || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono border ${
                          org.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : org.status === 'TRIAL'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {org.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Deep Inspect */}
                        <button
                          onClick={() => onInspectTenant && onInspectTenant(org._id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3 h-3 text-blue-400" />
                          <span>Inspect</span>
                        </button>

                        {/* Impersonate / Support Mode */}
                        <button
                          onClick={() => onImpersonate && onImpersonate(org._id)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Enter Support Mode for this tenant"
                        >
                          <ShieldAlert className="w-3 h-3 text-amber-400" />
                          <span className="hidden sm:inline">Support</span>
                        </button>

                        {/* Status Toggle (Block/Unblock) */}
                        <button
                          onClick={() => onStatusUpdate && onStatusUpdate(org._id, isBlocked ? 'ACTIVE' : 'BLOCKED')}
                          className={`p-1.5 rounded-lg border text-[11px] transition-colors ${
                            isBlocked
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                          }`}
                          title={isBlocked ? 'Unblock Organisation' : 'Block Organisation'}
                        >
                          {isBlocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.pages > 1 && (
          <div className="p-3 border-t border-slate-800 bg-[#0a0f1d] flex items-center justify-between text-xs text-slate-400">
            <span>Page {pagination.page} of {pagination.pages}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => onPageChange && onPageChange(pagination.page - 1)}
                className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => onPageChange && onPageChange(pagination.page + 1)}
                className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
