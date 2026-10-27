'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  Activity, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, Play, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';

export default function AuditLogTable({
  events = [],
  loading = false,
  total = 0,
  page = 1,
  totalPages = 1,
  onPageChange,
  eventFilter = 'all',
  onFilterChange,
  onRefresh
}) {
  const [retryingId, setRetryingId] = useState(null);

  const handleRetry = async (eventId) => {
    setRetryingId(eventId);
    try {
      await api.post(`/integrations/events/${eventId}/retry`);
      toast.success('Event re-queued for execution!');
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to re-drive event');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {['all', 'completed', 'failed', 'dead_letter'].map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                eventFilter === f
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 self-end sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Log
        </button>
      </div>

      {/* Events Table */}
      <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Channel / Provider</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">External ID</th>
                <th className="px-4 py-3 font-medium">Lead Result</th>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                    Loading webhook audit logs...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No webhook events recorded matching this filter.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev._id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                      <span className="capitalize px-2 py-0.5 rounded bg-slate-800 text-[11px]">
                        {ev.provider}
                      </span>
                      <span className="text-slate-400 text-[11px] truncate max-w-[140px]">
                        {ev.integrationId?.accountName || 'Inbound'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        ev.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : ev.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {ev.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                      {ev.externalLeadId || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {ev.processedLeadId ? (
                        <span className="text-emerald-400 font-medium text-[11px]">
                          {ev.processedLeadId.name || 'Lead Ingested'}
                        </span>
                      ) : ev.lastError?.message ? (
                        <span className="text-rose-400 text-[11px] truncate max-w-[180px] block" title={ev.lastError.message}>
                          {ev.lastError.message}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {formatDisplayDateTime(ev.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(ev.status === 'failed' || ev.status === 'dead_letter') && (
                        <button
                          type="button"
                          disabled={retryingId === ev._id}
                          onClick={() => handleRetry(ev._id)}
                          className="px-2.5 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[11px] font-medium transition inline-flex items-center gap-1"
                        >
                          {retryingId === ev._id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                          Re-drive
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Page {page} of {totalPages} ({total} events)</span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="p-1 rounded hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="p-1 rounded hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
