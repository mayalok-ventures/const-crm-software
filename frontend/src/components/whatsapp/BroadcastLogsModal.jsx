'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  X, CheckCircle2, XCircle, Clock, Search, RefreshCw,
  FileText, Phone, AlertCircle, ArrowLeft, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';

export default function BroadcastLogsModal({ isOpen, onClose, campaign }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'sent' | 'failed'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = async (pageNum = 1) => {
    if (!campaign?._id) return;
    setLoading(true);
    try {
      const res = await api.get(`/campaigns/${campaign._id}/logs?page=${pageNum}&limit=50`);
      setLogs(res.data.logs || []);
      setTotalPages(res.data.pages || 1);
      setTotalCount(res.data.total || 0);
      setPage(res.data.page || 1);
    } catch (err) {
      toast.error('Failed to load campaign logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && campaign?._id) {
      fetchLogs(1);
    }
  }, [isOpen, campaign?._id]);

  if (!isOpen || !campaign) return null;

  // Filter logs locally by search and status
  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      !search ||
      (log.phone && log.phone.includes(search)) ||
      (log.error && log.error.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'sent' && log.status === 'sent') ||
      (statusFilter === 'failed' && log.status === 'failed');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl my-auto max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Broadcast Delivery Logs
              </h2>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                campaign.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : campaign.status === 'running'
                  ? 'bg-indigo-100 text-indigo-800 animate-pulse'
                  : campaign.status === 'paused'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {campaign.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
              {campaign.name || campaign.campaignName} &bull; Channel: {campaign.channel || 'baileys'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs(page)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Campaign Metrics Bar */}
        <div className="grid grid-cols-3 gap-2 px-6 py-3 bg-white border-b border-slate-100 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-center">
            <span className="text-slate-400 text-[10px] font-medium block">Total Leads</span>
            <span className="text-base font-bold text-slate-800">{campaign.totalLeads || 0}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-center">
            <span className="text-emerald-600 text-[10px] font-medium block">Delivered</span>
            <span className="text-base font-bold text-emerald-700">{campaign.sentCount || 0}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200/60 text-center">
            <span className="text-rose-600 text-[10px] font-medium block">Failed</span>
            <span className="text-base font-bold text-rose-700">{campaign.failedCount || 0}</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search phone or error..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setStatusFilter('sent')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'sent'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Sent ({logs.filter(l => l.status === 'sent').length})
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === 'failed'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Failed ({logs.filter(l => l.status === 'failed').length})
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
              <p>Fetching recipient logs from database...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <Clock className="w-6 h-6 mx-auto text-slate-300" />
              <p>No delivery records match the current filter.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <th className="px-6 py-2.5">Recipient</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-6 py-2.5">Notes / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log, i) => (
                  <tr key={log._id || i} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-3 font-mono font-semibold text-slate-800 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {log.phone || 'Unknown Phone'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        log.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {log.status === 'sent' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3 h-3 text-rose-600" />
                        )}
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                      {log.timestamp ? format(new Date(log.timestamp), 'PPp') : '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-600 text-[11px] max-w-xs truncate">
                      {log.error ? (
                        <span className="text-rose-600 font-medium">{log.error}</span>
                      ) : (
                        <span className="text-slate-400">Delivered successfully</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer with Pagination */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 shrink-0">
          <span>
            Showing {filteredLogs.length} of {totalCount} records
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs(page - 1)}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-semibold text-slate-700">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => fetchLogs(page + 1)}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
