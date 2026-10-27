'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Trash2,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Plus
} from 'lucide-react';

export default function SubscriptionsList() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/integrations/subscriptions');
      if (res.data?.success) {
        setSubscriptions(res.data.subscriptions || []);
      }
    } catch (err) {
      console.error('Failed to load lead source subscriptions:', err);
      toast.error('Failed to load lead source subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleToggle = async (sub) => {
    try {
      setTogglingId(sub._id);
      const res = await api.patch(`/integrations/subscriptions/${sub._id}/toggle`);
      if (res.data?.success) {
        toast.success(res.data.message);
        setSubscriptions((prev) =>
          prev.map((s) => (s._id === sub._id ? { ...s, status: res.data.status } : s))
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle subscription');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (sub) => {
    if (!window.confirm(`Are you sure you want to remove routing for "${sub.sourceName}"? Incoming leads will no longer route to this Campaign Group.`)) {
      return;
    }
    try {
      setDeletingId(sub._id);
      const res = await api.delete(`/integrations/subscriptions/${sub._id}`);
      if (res.data?.success) {
        toast.success('Lead source subscription removed');
        setSubscriptions((prev) => prev.filter((s) => s._id !== sub._id));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete subscription');
    } finally {
      setDeletingId(null);
    }
  };

  const getProviderBadge = (provider) => {
    switch (String(provider).toLowerCase()) {
      case 'meta':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Meta Ads</span>;
      case 'google':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Google Ads</span>;
      case 'sheets':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Google Sheet</span>;
      case 'website':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Website Form</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">{provider}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-[var(--text)] m-0 flex items-center gap-2">
            <Layers size={16} className="text-indigo-600" />
            Lead Source Subscriptions & Multi-Form Routing ({subscriptions.length})
          </h3>
          <p className="text-xs text-[var(--text-muted)] m-0.5 0 0">
            Route multiple forms from one advertising account to different Campaign Groups, or aggregate multiple sources into one group.
          </p>
        </div>

        <button
          onClick={fetchSubscriptions}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--card)] transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-indigo-600' : ''} />
          Refresh
        </button>
      </div>

      {/* Subscriptions Table / Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl">
          <RefreshCw size={24} className="animate-spin text-indigo-600" />
          <p className="text-xs text-[var(--text-muted)] font-medium">Loading configured source subscriptions...</p>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="p-8 text-center bg-[var(--card)] border border-[var(--border)] rounded-2xl">
          <Layers size={36} className="mx-auto text-[var(--text-muted)] mb-3 opacity-60" />
          <h4 className="text-sm font-bold text-[var(--text)]">No Form Subscriptions Configured Yet</h4>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
            Connect your Meta or Google Ads account in the Channels tab, then select which Facebook Pages and Lead Forms should route into each Campaign Group.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  <th className="py-3 px-4">Source & Form</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Destination Group</th>
                  <th className="py-3 px-4">Assignment</th>
                  <th className="py-3 px-4">Leads</th>
                  <th className="py-3 px-4">Health</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-xs">
                {subscriptions.map((sub) => {
                  const isPaused = sub.status === 'paused';
                  return (
                    <tr key={sub._id} className="hover:bg-[var(--bg)]/50 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[var(--text)]">{sub.sourceName}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">
                          ID: {sub.externalFormId}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getProviderBadge(sub.provider)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-indigo-600 flex items-center gap-1.5">
                          <ArrowRight size={12} className="text-[var(--text-muted)]" />
                          {sub.campaignGroupId?.displayName || sub.campaignGroupId?.name || 'Default Campaign'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">
                        {sub.assignmentRule?.type === 'specific_counselor' ? (
                          <span className="text-purple-600 font-medium">
                            Dedicated: {sub.assignmentRule.specificCounselorId?.name || 'Assigned'}
                          </span>
                        ) : sub.assignmentRule?.type === 'round_robin' ? (
                          <span>Round Robin</span>
                        ) : (
                          <span className="text-slate-500">Inherit Campaign</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-[var(--text)]">
                        {sub.totalLeadsCount || 0}
                      </td>
                      <td className="py-3 px-4">
                        {sub.healthStatus === 'healthy' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={10} /> Healthy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle size={10} /> Warning
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggle(sub)}
                            disabled={togglingId === sub._id}
                            className={`p-1.5 rounded-lg border text-xs font-semibold transition ${
                              isPaused
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                            }`}
                            title={isPaused ? 'Resume lead routing' : 'Pause lead routing'}
                          >
                            {isPaused ? <Play size={12} /> : <Pause size={12} />}
                          </button>

                          <button
                            onClick={() => handleDelete(sub)}
                            disabled={deletingId === sub._id}
                            className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                            title="Delete subscription"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
