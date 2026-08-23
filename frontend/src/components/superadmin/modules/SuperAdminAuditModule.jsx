'use client';

import React from 'react';
import { History, Search, Filter } from 'lucide-react';

export default function SuperAdminAuditModule({
  logs = [],
  loading = false,
  search = '',
  onSearchChange = null,
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="Search audit trail by actor, action, resource..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Immutable Audit Feed: {logs.length} entries
        </div>
      </div>

      <div className="rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0a0f1d] text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Action Event</th>
                <th className="px-4 py-3">Actor / SuperAdmin</th>
                <th className="px-4 py-3">Target Resource</th>
                <th className="px-4 py-3">Organization ID</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-mono font-bold text-amber-400 text-[11px]">[{log.action}]</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{log.actorName || 'SuperAdmin'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{log.actorEmail || 'admin@coresetu.com'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{log.resourceName || log.resourceType}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{log.organizationId ? String(log.organizationId).slice(-8) : 'Platform'}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
