'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  FileSpreadsheet, Clock, CheckCircle2, AlertTriangle, AlertCircle,
  RefreshCw, X, FileText, ChevronRight, Activity, ShieldCheck
} from 'lucide-react';
import { formatDisplayDateTime } from '@/lib/dateUtils';

export default function SheetStatusDrawer({ integration, isOpen = true, onClose, onViewSnippet }) {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);

  const fetchStatus = async () => {
    if (!integration) return;
    setLoading(true);
    try {
      const res = await api.get(`/integrations/${integration._id}/sheets-status`);
      setStatusData(res.data?.status || null);
    } catch (err) {
      toast.error('Failed to load sheet sync metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen !== false && integration) {
      fetchStatus();
    }
  }, [isOpen, integration]);

  if (isOpen === false || !integration) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full p-6 sm:p-8 flex flex-col justify-between overflow-y-auto text-white shadow-2xl">

        <div>
          {/* Top Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {integration.accountName || 'Google Sheet Status'}
                </h3>
                <p className="text-xs text-slate-400">Real-time sync performance and error diagnosis</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
              <span className="text-sm">Fetching sheet sync telemetry...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">Rows Synced</span>
                  <span className="text-xl font-bold text-emerald-400">
                    {statusData?.totalSynced || 0}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">Needs Review</span>
                  <span className="text-xl font-bold text-amber-400">
                    {statusData?.totalNeedsReview || 0}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">Pending</span>
                  <span className="text-xl font-bold text-blue-400">
                    {statusData?.pendingCount || 0}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">Failed</span>
                  <span className="text-xl font-bold text-rose-400">
                    {statusData?.failedCount || 0}
                  </span>
                </div>
              </div>

              {/* Last Sync & Health Information */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Last Webhook Sync:
                  </span>
                  <span className="text-white font-medium">
                    {statusData?.lastSyncAt ? formatDisplayDateTime(statusData.lastSyncAt) : 'No events yet'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Connection Health:
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    integration.status === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {integration.status?.toUpperCase() || 'CONNECTED'}
                  </span>
                </div>

                {statusData?.lastError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    <span className="font-semibold block mb-0.5">Last Error Recorded:</span>
                    <p className="font-mono text-[11px] text-rose-200/90">{statusData.lastError}</p>
                  </div>
                )}
              </div>

              {/* Recent Failures / Error Diagnoses */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-slate-400" /> Recent Errors & Retry Status
                </h4>
                {statusData?.recentFailures?.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">
                    No failed rows or processing errors recorded. All rows synced cleanly!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {statusData?.recentFailures?.map((fail, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="font-mono text-[11px] text-rose-400">Lead ID: {fail.leadId}</span>
                          <span className="text-[10px]">{formatDisplayDateTime(fail.timestamp)}</span>
                        </div>
                        <p className="text-slate-300 text-[11px]">{fail.error}</p>
                        <span className="text-[10px] text-slate-500 block">Attempts: {fail.attempts}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-slate-800 pt-4 mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={fetchStatus}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Telemetry
          </button>
          {onViewSnippet && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewSnippet(integration);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1.5 transition"
            >
              <FileText className="w-3.5 h-3.5" /> View Apps Script Code
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
