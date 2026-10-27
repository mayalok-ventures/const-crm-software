'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Search,
  MessageCircle,
  Mail,
  User,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function AutomationLogsModal({ isOpen, onClose, ruleId = null, ruleName = null }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [retryingId, setRetryingId] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 20,
        ...(ruleId ? { ruleId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      };
      const endpoint = ruleId ? `/automations/${ruleId}/logs` : '/automations/logs';
      const { data } = await api.get(endpoint, { params });
      setLogs(data.logs || []);
      setTotalPages(data.pagination?.pages || data.pages || 1);
    } catch (err) {
      console.error('Failed to fetch automation logs:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [page, ruleId, statusFilter]);

  const handleRetry = async (logId) => {
    setRetryingId(logId);
    try {
      await api.post(`/automations/logs/${logId}/retry`);
      fetchLogs();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to retry automation execution');
    } finally {
      setRetryingId(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const rName = (log.ruleId?.name || log.ruleName || '').toLowerCase();
    const lName = (log.leadId?.name || log.leadName || '').toLowerCase();
    const lPhone = (log.leadId?.phone || log.recipientPhone || '').toLowerCase();
    return rName.includes(term) || lName.includes(term) || lPhone.includes(term);
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Success
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold uppercase">
            <XCircle size={12} className="text-rose-600" />
            Failed
          </span>
        );
      case 'skipped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase">
            <AlertTriangle size={12} className="text-amber-600" />
            Skipped
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold uppercase">
            <Clock size={12} className="text-blue-600 animate-pulse" />
            Scheduled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl my-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Clock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">
                  {ruleName ? `Audit Logs: ${ruleName}` : 'Global Automation Execution Logs'}
                </h3>
              </div>
              <p className="text-xs text-slate-300">
                Live delivery trace, trigger timestamps, and dispatch diagnostics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by rule, lead name, or phone..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-slate-700"
            >
              <option value="">All Statuses</option>
              <option value="success">Success Only</option>
              <option value="failed">Failed Only</option>
              <option value="skipped">Skipped Only</option>
            </select>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 rounded-lg border border-slate-300 hover:bg-white text-slate-600 transition"
              title="Refresh logs"
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              Loading execution logs...
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No automation execution logs found. Once automated rules trigger, delivery audits will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log._id}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {log.ruleId?.name || log.ruleName || 'Automation Rule'}
                      </span>
                      {getStatusBadge(log.status)}
                      {log.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => handleRetry(log._id)}
                          disabled={retryingId === log._id}
                          className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-1 transition"
                          title="Retry failed automation action"
                        >
                          <RotateCw size={10} className={retryingId === log._id ? 'animate-spin' : ''} />
                          {retryingId === log._id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(log.executedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 text-[11px]">
                    <span className="flex items-center gap-1 font-medium">
                      Trigger: <strong className="text-slate-800">{log.triggerType}</strong>
                    </span>

                    <span className="flex items-center gap-1 font-medium">
                      Action:{' '}
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        {log.actionType?.includes('whatsapp') ? (
                          <MessageCircle size={12} className="text-emerald-600" />
                        ) : (
                          <Mail size={12} className="text-indigo-600" />
                        )}
                        {log.actionType}
                      </span>
                    </span>

                    {(log.leadId?.name || log.leadName || log.recipientPhone || log.recipientEmail) && (
                      <span className="flex items-center gap-1 font-medium">
                        Recipient:{' '}
                        <strong className="text-slate-800">
                          {log.leadId?.name || log.leadName || log.recipientPhone || log.recipientEmail}
                        </strong>
                      </span>
                    )}

                    {log.durationMs !== undefined && (
                      <span className="text-slate-400">({log.durationMs}ms)</span>
                    )}
                  </div>

                  {/* Render payload preview if available */}
                  {log.actionPayload?.preview && (
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700 whitespace-pre-wrap">
                      {log.actionPayload.preview}
                    </div>
                  )}

                  {/* Error diagnosis */}
                  {log.errorMessage && (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 font-medium">
                      Error: {log.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs">
          <span className="text-slate-500 font-medium">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40 text-slate-700 hover:bg-white font-semibold"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40 text-slate-700 hover:bg-white font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
