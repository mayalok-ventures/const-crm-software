'use client';

import React from 'react';
import { AlertTriangle, Search, Filter } from 'lucide-react';

export default function SuperAdminErrorLogsModule({
  logs = [],
  loading = false,
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm flex items-center justify-between">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Platform Diagnostic & Security Error Logs</span>
        </h3>
        <span className="text-xs text-slate-400 font-mono">{logs.length} logged events</span>
      </div>

      <div className="rounded-2xl bg-[#0d1424] border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0a0f1d] text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">Actor / IP</th>
                <th className="px-4 py-3">Tenant Context</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-slate-500">
                    No critical platform errors recorded. Systems operating cleanly.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-mono font-bold text-amber-400 text-[11px]">{log.action}</td>
                    <td className="px-4 py-3 text-slate-300">{log.actorEmail || log.ip || 'Anonymous'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{log.organizationId || 'Global'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
