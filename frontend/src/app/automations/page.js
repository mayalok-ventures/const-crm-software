'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import {
  Zap,
  Plus,
  Play,
  RotateCw,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Mail,
  Bot,
  GitBranch,
  Layers,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  ArrowUpRight,
  Sparkles,
  TrendingUp,
  AlertCircle,
  ShieldAlert,
  Copy,
  Activity,
  Sliders,
  ChevronRight,
  RefreshCw,
  ArrowRight,
  UserCheck,
  Tag,
  Check,
  Pause,
} from 'lucide-react';
import AutomationRuleModal from '@/components/automations/AutomationRuleModal';
import AutomationLogsModal from '@/components/automations/AutomationLogsModal';

export default function AutomationsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Top-Level Navigation Sub-Views: 'workflows' | 'activity' | 'issues'
  const [activeView, setActiveView] = useState('workflows');

  // Workflows Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'paused', 'draft'
  const [searchQuery, setSearchQuery] = useState('');

  // Activity Logs View State
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsStatusFilter, setLogsStatusFilter] = useState('all');
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [retryingLogId, setRetryingLogId] = useState(null);

  // Modals state
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [selectedRuleForLogs, setSelectedRuleForLogs] = useState(null);

  // Real-time Metrics state
  const [metrics, setMetrics] = useState({
    totalRules: 0,
    activeRules: 0,
    pausedRules: 0,
    draftRules: 0,
    executionsToday: 0,
    successfulToday: 0,
    failedToday: 0,
    issuesCount: 0,
  });

  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/automations');
      const loadedRules = data.rules || [];
      setRules(loadedRules);

      if (data.metrics) {
        setMetrics({
          totalRules: data.metrics.totalCount || loadedRules.length,
          activeRules: data.metrics.activeCount || loadedRules.filter((r) => r.isActive).length,
          pausedRules: data.metrics.pausedCount || 0,
          draftRules: data.metrics.draftCount || 0,
          executionsToday: data.metrics.executionsToday || 0,
          successfulToday: data.metrics.successfulToday || 0,
          failedToday: data.metrics.failedToday || 0,
          issuesCount: data.metrics.issuesCount || data.metrics.failedToday || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch automations:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to load automations');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActivityLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = {
        page: logsPage,
        limit: 30,
      };
      if (logsStatusFilter !== 'all') {
        params.status = logsStatusFilter;
      }
      const { data } = await api.get('/automations/logs', { params });
      setLogs(data.logs || []);
      setLogsTotalPages(data.pagination?.pages || data.pages || 1);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [logsPage, logsStatusFilter]);

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    if (!currentUser) {
      router.push('/login');
      return;
    }
    fetchAutomations();
  }, [router, fetchAutomations]);

  useEffect(() => {
    if (activeView === 'activity' || activeView === 'issues') {
      fetchActivityLogs();
    }
  }, [activeView, fetchActivityLogs]);

  // Toggle active status
  const handleToggleActive = async (rule) => {
    const originalStatus = rule.isActive;
    const newStatus = originalStatus ? 'paused' : 'active';

    // Optimistic update
    setRules((prev) =>
      prev.map((r) =>
        r._id === rule._id ? { ...r, isActive: !originalStatus, status: newStatus } : r
      )
    );

    try {
      await api.patch(`/automations/${rule._id}/status`, { status: newStatus });
      fetchAutomations();
    } catch (err) {
      console.error('Failed to toggle automation status:', err);
      setRules((prev) =>
        prev.map((r) =>
          r._id === rule._id ? { ...r, isActive: originalStatus, status: rule.status } : r
        )
      );
      alert(err?.response?.data?.message || 'Failed to toggle status');
    }
  };

  // Duplicate rule
  const handleDuplicate = async (ruleId) => {
    try {
      await api.post(`/automations/${ruleId}/duplicate`);
      fetchAutomations();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to duplicate rule');
    }
  };

  // Delete rule
  const handleDeleteRule = async (ruleId) => {
    if (!confirm('Are you sure you want to delete this automation workflow?')) return;
    try {
      await api.delete(`/automations/${ruleId}`);
      setRules((prev) => prev.filter((r) => r._id !== ruleId));
      fetchAutomations();
    } catch (err) {
      console.error('Failed to delete automation:', err);
      alert(err?.response?.data?.message || 'Failed to delete automation rule');
    }
  };

  // Retry failed log
  const handleRetryLog = async (logId) => {
    setRetryingLogId(logId);
    try {
      await api.post(`/automations/logs/${logId}/retry`);
      fetchActivityLogs();
      fetchAutomations();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to retry automation');
    } finally {
      setRetryingLogId(null);
    }
  };

  // Filtered rules for Workflows tab
  const filteredRules = rules.filter((r) => {
    if (statusFilter === 'active' && r.status !== 'active' && !r.isActive) return false;
    if (statusFilter === 'paused' && r.status !== 'paused' && r.isActive) return false;
    if (statusFilter === 'draft' && r.status !== 'draft') return false;

    if (categoryFilter === 'lead_lifecycle' && r.category !== 'lead_lifecycle' && r.triggerType !== 'lead_created') return false;
    if (categoryFilter === 'communication' && r.category !== 'communication' && r.channel !== 'whatsapp' && r.channel !== 'email') return false;
    if (categoryFilter === 'pipeline' && r.category !== 'pipeline' && r.triggerType !== 'stage_changed' && r.triggerType !== 'stage_reached') return false;
    if (categoryFilter === 'inactivity' && r.category !== 'inactivity' && r.triggerType !== 'stage_duration') return false;
    if (categoryFilter === 'chatbots' && r.category !== 'chatbots' && r.triggerType !== 'whatsapp_inbound') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (r.name || '').toLowerCase().includes(q);
      const matchSummary = (r.summary || '').toLowerCase().includes(q);
      const matchKeywords = (r.triggerConfig?.keywords || []).some((kw) =>
        kw.toLowerCase().includes(q)
      );
      if (!matchName && !matchSummary && !matchKeywords) return false;
    }

    return true;
  });

  const successRate = metrics.executionsToday > 0
    ? Math.round((metrics.successfulToday / metrics.executionsToday) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20 md:pb-12 text-slate-900">
      {/* Top Header & Executive Navigation */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                  <Zap size={22} className="text-amber-300" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                    Automations & Workflows
                  </h1>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Speed-to-lead instant greetings, stage milestone drips, and background assignments
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setEditingRule(null);
                  setIsRuleModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-200"
              >
                <Plus size={16} />
                New Automation
              </button>
            </div>
          </div>

          {/* Metric KPI Cards (Calculated from Real Database Data) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                <span>Active Workflows</span>
                <Sparkles size={14} className="text-indigo-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{metrics.activeRules}</span>
                <span className="text-xs font-semibold text-slate-500">of {metrics.totalRules} total</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80">
              <div className="flex items-center justify-between text-indigo-800 text-xs font-bold uppercase tracking-wider mb-1">
                <span>Executions (Today)</span>
                <Activity size={14} className="text-indigo-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-950">{metrics.executionsToday}</span>
                <span className="text-xs font-semibold text-indigo-700">runs in 24h</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
                <span>Success Rate</span>
                <CheckCircle2 size={14} className="text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-950">{successRate}%</span>
                <span className="text-xs font-semibold text-emerald-700">{metrics.successfulToday} succeeded</span>
              </div>
            </div>

            <div
              onClick={() => {
                if (metrics.issuesCount > 0) {
                  setActiveView('issues');
                  setLogsStatusFilter('failed');
                }
              }}
              className={`p-4 rounded-2xl border transition cursor-pointer ${
                metrics.issuesCount > 0
                  ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/60 ring-2 ring-rose-500/20'
                  : 'bg-slate-50 border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-1">
                <span className={metrics.issuesCount > 0 ? 'text-rose-800' : 'text-slate-500'}>
                  Attention Needed
                </span>
                <ShieldAlert size={14} className={metrics.issuesCount > 0 ? 'text-rose-600' : 'text-slate-400'} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black ${metrics.issuesCount > 0 ? 'text-rose-950' : 'text-slate-900'}`}>
                  {metrics.issuesCount}
                </span>
                <span className={`text-xs font-semibold ${metrics.issuesCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                  {metrics.issuesCount === 0 ? 'All healthy' : 'failed actions'}
                </span>
              </div>
            </div>
          </div>

          {/* Primary View Switcher Navigation */}
          <div className="flex items-center gap-1 mt-6 border-b border-slate-200 -mb-5">
            {[
              { id: 'workflows', label: 'My Workflows', count: metrics.totalRules },
              { id: 'activity', label: 'Activity & Execution History', count: metrics.executionsToday },
              { id: 'issues', label: 'Issues & Failures', count: metrics.issuesCount, badgeColor: 'rose' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setActiveView(v.id);
                  if (v.id === 'issues') setLogsStatusFilter('failed');
                  else if (v.id === 'activity') setLogsStatusFilter('all');
                }}
                className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition flex items-center gap-2 ${
                  activeView === v.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>{v.label}</span>
                {v.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      v.badgeColor === 'rose' && v.count > 0
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {v.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ───────────────────────────────────────────────────────────── */}
        {/* VIEW 1: WORKFLOWS LIST */}
        {/* ───────────────────────────────────────────────────────────── */}
        {activeView === 'workflows' && (
          <div className="space-y-4">
            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: 'all', label: 'All Workflows' },
                  { id: 'lead_lifecycle', label: 'Lead Lifecycle' },
                  { id: 'communication', label: 'Messaging' },
                  { id: 'pipeline', label: 'Pipeline Milestones' },
                  { id: 'inactivity', label: 'Inactivity Schedulers' },
                  { id: 'chatbots', label: 'Chatbots' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setCategoryFilter(id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      categoryFilter === id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="paused">Paused Only</option>
                  <option value="draft">Drafts Only</option>
                </select>

                <div className="relative min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search workflows..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Workflow Cards */}
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Loading workflows...
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {error}
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Zap size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No automation workflows found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Automate speed-to-lead responses, reassign stale leads, and deliver milestone WhatsApp directions.
                </p>
                <button
                  onClick={() => {
                    setEditingRule(null);
                    setIsRuleModalOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition inline-flex items-center gap-1.5"
                >
                  <Plus size={14} /> Build Your First Workflow
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRules.map((rule) => {
                  const isWa = rule.channel === 'whatsapp';
                  const isBot = rule.triggerType === 'whatsapp_inbound';
                  const isDraft = rule.status === 'draft';
                  const isPaused = rule.status === 'paused' || (!rule.isActive && !isDraft);
                  const actionCount = Array.isArray(rule.actions) && rule.actions.length > 0 ? rule.actions.length : 1;

                  return (
                    <div
                      key={rule._id}
                      className={`p-5 rounded-3xl border transition bg-white shadow-2xs hover:shadow-md ${
                        isDraft
                          ? 'border-dashed border-slate-300 bg-slate-50/50'
                          : isPaused
                          ? 'border-slate-200/80 opacity-75 bg-slate-50/30'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Left: Info, Summary & Tags */}
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                              isDraft
                                ? 'bg-slate-200 text-slate-600'
                                : isBot
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                : isWa
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                            }`}
                          >
                            {isBot ? (
                              <Bot size={22} />
                            ) : isWa ? (
                              <MessageCircle size={22} />
                            ) : (
                              <Mail size={22} />
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-black text-slate-900">{rule.name}</h3>

                              {/* Status Badge */}
                              {isDraft ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase border border-slate-300">
                                  Draft
                                </span>
                              ) : isPaused ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-extrabold uppercase border border-amber-200">
                                  Paused
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-extrabold uppercase border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Active
                                </span>
                              )}

                              {/* Trigger Badge */}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                                <Zap size={10} className="text-amber-500" />
                                {rule.triggerType?.replace('_', ' ')}
                              </span>

                              {/* Action Count */}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                <Layers size={10} />
                                {actionCount} {actionCount === 1 ? 'Action' : 'Actions'}
                              </span>

                              {rule.delayMinutes > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                  <Clock size={10} /> {rule.delayMinutes}m delay
                                </span>
                              )}
                            </div>

                            {/* Human-Readable Natural Summary */}
                            <p className="text-xs font-semibold text-slate-700 leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-100">
                              "{rule.summary || rule.description}"
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                              <span>{rule.executionCount || 0} lifetime executions</span>
                              {rule.lastExecutedAt && (
                                <span>• Last run: {new Date(rule.lastExecutedAt).toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Actions Menu */}
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          {/* Toggle Active / Pause */}
                          {!isDraft && (
                            <button
                              onClick={() => handleToggleActive(rule)}
                              className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1 ${
                                rule.isActive
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              }`}
                              title={rule.isActive ? 'Pause Workflow' : 'Resume Workflow'}
                            >
                              {rule.isActive ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                          )}

                          {/* View Logs Button */}
                          <button
                            onClick={() => {
                              setSelectedRuleForLogs(rule);
                              setIsLogsModalOpen(true);
                            }}
                            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
                            title="Execution Logs"
                          >
                            <Clock size={14} />
                          </button>

                          {/* Duplicate Button */}
                          <button
                            onClick={() => handleDuplicate(rule._id)}
                            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
                            title="Duplicate as Draft"
                          >
                            <Copy size={14} />
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => {
                              setEditingRule(rule);
                              setIsRuleModalOpen(true);
                            }}
                            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-indigo-600 transition"
                            title="Edit Workflow"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteRule(rule._id)}
                            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-rose-600 transition"
                            title="Delete Workflow"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* VIEW 2 & 3: ACTIVITY LOGS & ISSUES HEALTH */}
        {/* ───────────────────────────────────────────────────────────── */}
        {(activeView === 'activity' || activeView === 'issues') && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Filter Execution Status:</span>
                {['all', 'failed', 'success', 'pending'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setLogsStatusFilter(st);
                      setLogsPage(1);
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold uppercase transition ${
                      logsStatusFilter === st
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <button
                onClick={fetchActivityLogs}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition inline-flex items-center gap-1.5"
              >
                <RefreshCw size={13} className={logsLoading ? 'animate-spin' : ''} />
                Refresh Logs
              </button>
            </div>

            {logsLoading ? (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Loading execution history...
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-2">
                <Clock size={24} className="mx-auto text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800">No execution logs found</h3>
                <p className="text-xs text-slate-500">
                  {logsStatusFilter === 'failed'
                    ? 'Great news! There are zero failed executions recorded.'
                    : 'Executions will appear here automatically when workflows are triggered.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Automation Rule</th>
                        <th className="px-4 py-3">Target Lead</th>
                        <th className="px-4 py-3">Action Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Details / Outcome</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {logs.map((log) => {
                        const isSuccess = log.status === 'success';
                        const isFailed = log.status === 'failed';
                        const isPending = log.status === 'pending';

                        return (
                          <tr key={log._id} className="hover:bg-slate-50/70 transition">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                              {new Date(log.timestamp || log.executedAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900">
                              {log.ruleId?.name || log.ruleName || 'Automation Rule'}
                            </td>
                            <td className="px-4 py-3">
                              {log.leadId?.name || log.leadName || log.recipientPhone || 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                                {log.actionType?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  isSuccess
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : isFailed
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {isSuccess && <CheckCircle2 size={11} />}
                                {isFailed && <XCircle size={11} />}
                                {isPending && <Clock size={11} />}
                                {log.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs truncate text-[11px]">
                              {log.errorMessage || log.error || log.messageSent || 'Completed'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isFailed && (
                                <button
                                  type="button"
                                  disabled={retryingLogId === log._id}
                                  onClick={() => handleRetryLog(log._id)}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition shadow-2xs"
                                >
                                  {retryingLogId === log._id ? 'Retrying...' : 'Retry'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsTotalPages > 1 && (
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Page {logsPage} of {logsTotalPages}</span>
                    <div className="flex gap-1.5">
                      <button
                        disabled={logsPage <= 1}
                        onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40 font-bold"
                      >
                        Prev
                      </button>
                      <button
                        disabled={logsPage >= logsTotalPages}
                        onClick={() => setLogsPage((p) => Math.min(logsTotalPages, p + 1))}
                        className="px-3 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40 font-bold"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AutomationRuleModal
        isOpen={isRuleModalOpen}
        onClose={() => {
          setIsRuleModalOpen(false);
          setEditingRule(null);
        }}
        onSaved={fetchAutomations}
        initialRule={editingRule}
      />

      <AutomationLogsModal
        isOpen={isLogsModalOpen}
        onClose={() => {
          setIsLogsModalOpen(false);
          setSelectedRuleForLogs(null);
        }}
        ruleId={selectedRuleForLogs?._id}
        ruleName={selectedRuleForLogs?.name}
      />
    </div>
  );
}
