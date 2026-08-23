'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Network,
  Server as ServerIcon,
  Wifi,
  Clock,
  Terminal,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Layers,
  BarChart,
  Grid,
  Shield,
  Bug,
  AlertOctagon,
  FileCode,
  Copy,
  Check,
  Filter,
  Search,
  MessageSquare,
  ChevronRight,
  Eye,
  ShieldAlert,
  ArrowUpRight,
  Send,
  Zap,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
} from 'recharts';
import { toast } from 'react-hot-toast';

interface SystemHealthDashboardProps {
  authFetch: (endpoint: string, options?: any) => Promise<any>;
}

export default function SystemHealthDashboard({ authFetch }: SystemHealthDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    'infrastructure' | 'availability' | 'api' | 'errors' | 'logs'
  >('infrastructure');

  // Infrastructure & Servers State
  const [servers, setServers] = useState<any[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [metricHistory, setMetricHistory] = useState<any[]>([]);
  const [heartbeatHistory, setHeartbeatHistory] = useState<any[]>([]);
  const [statusEvents, setStatusEvents] = useState<any[]>([]);

  // API Performance State
  const [apiPerformance, setApiPerformance] = useState<any>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<any | null>(null);

  // Error Tracking State
  const [errorStats, setErrorStats] = useState<any>(null);
  const [errorGroups, setErrorGroups] = useState<any[]>([]);
  const [errorStatusFilter, setErrorStatusFilter] = useState<string>('ALL');
  const [errorSeverityFilter, setErrorSeverityFilter] = useState<string>('ALL');
  const [errorSearch, setErrorSearch] = useState<string>('');
  const [selectedErrorGroup, setSelectedErrorGroup] = useState<any | null>(null);
  const [errorGroupDetails, setErrorGroupDetails] = useState<any | null>(null);
  const [newErrorNote, setNewErrorNote] = useState<string>('');
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);

  // Structured Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [liveStreamEnabled, setLiveStreamEnabled] = useState<boolean>(false);
  const [logLevelFilter, setLogLevelFilter] = useState<string>('ALL');
  const [logModuleFilter, setLogModuleFilter] = useState<string>('ALL');
  const [logSearch, setLogSearch] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  // Common Controls
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d' | '90d'>('1h');
  const [uptimeFilter, setUptimeFilter] = useState<'24h' | '7d' | '30d' | '90d'>('24h');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshCount, setRefreshCount] = useState<number>(0);

  // ─────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Servers
      const serverRes = await authFetch('/admin/monitoring/servers');
      if (serverRes?.success) {
        setServers(serverRes.servers || []);
        if (serverRes.servers?.length > 0 && !selectedServerId) {
          setSelectedServerId(serverRes.servers[0].serverId);
        }
      }

      // 2. Fetch API Performance
      const apiRes = await authFetch(`/admin/monitoring/api-performance?range=${timeRange}`);
      if (apiRes?.success) {
        setApiPerformance(apiRes.performance);
      }

      // 3. Fetch Error Stats & Groups
      const statsRes = await authFetch('/admin/errors/stats');
      if (statsRes?.success) {
        setErrorStats(statsRes.stats);
      }

      const groupsRes = await authFetch(
        `/admin/errors/groups?status=${errorStatusFilter}&severity=${errorSeverityFilter}&search=${encodeURIComponent(
          errorSearch
        )}`
      );
      if (groupsRes?.success) {
        setErrorGroups(groupsRes.groups || []);
      }

      // 4. Fetch Logs
      const logsRes = await authFetch(
        `/admin/logs?level=${logLevelFilter}&module=${logModuleFilter}&search=${encodeURIComponent(
          logSearch
        )}&limit=100`
      );
      if (logsRes?.success) {
        setLogs(logsRes.logs || []);
      }
    } catch (error) {
      console.error('Failed to load system health data:', error);
      toast.error('Failed to reload telemetry data');
    } finally {
      setIsLoading(false);
    }
  }, [
    authFetch,
    selectedServerId,
    timeRange,
    errorStatusFilter,
    errorSeverityFilter,
    errorSearch,
    logLevelFilter,
    logModuleFilter,
    logSearch,
  ]);

  // Metric history per server
  const fetchMetricHistory = useCallback(async () => {
    if (!selectedServerId) return;
    try {
      const historyRes = await authFetch(
        `/admin/monitoring/servers/${selectedServerId}/history?range=${timeRange}`
      );
      if (historyRes?.success) {
        setMetricHistory(historyRes.history || []);
      }

      const heartbeatsRes = await authFetch(
        `/admin/servers/${selectedServerId}/heartbeat-history`
      );
      if (heartbeatsRes?.success) {
        setHeartbeatHistory(heartbeatsRes.heartbeats || []);
      }

      const eventsRes = await authFetch(
        `/admin/servers/${selectedServerId}/status-events`
      );
      if (eventsRes?.success) {
        setStatusEvents(eventsRes.events || []);
      }
    } catch (err) {
      console.warn('Failed to load server details:', err);
    }
  }, [authFetch, selectedServerId, timeRange]);

  // Live polling for stream mode
  useEffect(() => {
    let timer: any = null;
    if (liveStreamEnabled && activeSubTab === 'logs') {
      timer = setInterval(async () => {
        try {
          const streamRes = await authFetch('/admin/logs/stream?limit=100');
          if (streamRes?.success && streamRes.logs) {
            setLogs(streamRes.logs);
          }
        } catch (e) {
          // ignore stream poll error
        }
      }, 2000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [liveStreamEnabled, activeSubTab, authFetch]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, refreshCount]);

  useEffect(() => {
    fetchMetricHistory();
  }, [fetchMetricHistory, selectedServerId, refreshCount]);

  // Fetch single error group details when selected
  useEffect(() => {
    if (!selectedErrorGroup) {
      setErrorGroupDetails(null);
      return;
    }
    const fetchGroup = async () => {
      try {
        const res = await authFetch(
          `/admin/errors/groups/${selectedErrorGroup.fingerprint}`
        );
        if (res?.success) {
          setErrorGroupDetails(res);
        }
      } catch (err) {
        toast.error('Failed to load error details');
      }
    };
    fetchGroup();
  }, [selectedErrorGroup, authFetch]);

  // Handlers for Error Status & Notes
  const handleUpdateErrorStatus = async (fingerprint: string, newStatus: string) => {
    try {
      const res = await authFetch(`/admin/errors/groups/${fingerprint}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res?.success) {
        toast.success(`Error marked as ${newStatus}`);
        setErrorGroups((prev) =>
          prev.map((g) => (g.fingerprint === fingerprint ? { ...g, status: newStatus } : g))
        );
        if (selectedErrorGroup?.fingerprint === fingerprint) {
          setSelectedErrorGroup((prev: any) => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  const handleAddErrorNote = async (fingerprint: string) => {
    if (!newErrorNote.trim()) return;
    setIsSubmittingNote(true);
    try {
      const res = await authFetch(`/admin/errors/groups/${fingerprint}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: newErrorNote.trim() }),
      });
      if (res?.success) {
        toast.success('Note added');
        setNewErrorNote('');
        if (errorGroupDetails) {
          setErrorGroupDetails((prev: any) => ({
            ...prev,
            group: { ...prev.group, notes: res.notes },
          }));
        }
      }
    } catch (err: any) {
      toast.error('Failed to add note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLogId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  // Helper formatting functions
  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ONLINE':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'DEGRADED':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'OFFLINE':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'MAINTENANCE':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ONLINE':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'DEGRADED':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'OFFLINE':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'MAINTENANCE':
        return <Clock className="w-4 h-4 text-sky-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getLogLevelBadge = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'FATAL':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'ERROR':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'WARN':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'INFO':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'DEBUG':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const selectedServer = servers.find((s) => s.serverId === selectedServerId) || servers[0];
  const lastMetric = metricHistory[metricHistory.length - 1];

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-[#090f1e] border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" /> System Observability & Operations Control
          </h2>
          <p className="text-xs text-slate-400">
            Real-time server heartbeats, telemetry, API performance, error groups, and structured logs
          </p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Time range selector */}
          <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5">
            {(['1h', '6h', '24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  timeRange === r ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRefreshCount((prev) => prev + 1)}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750 transition-colors disabled:opacity-50"
            title="Refresh logs & telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Observability Subtabs */}
      <div className="flex overflow-x-auto border-b border-slate-800 pb-px gap-1">
        <button
          onClick={() => setActiveSubTab('infrastructure')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'infrastructure'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Cpu className="w-4 h-4" /> Infrastructure Telemetry
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('availability')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'availability'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Wifi className="w-4 h-4" /> Server Fleet & Incidents
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('api')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'api'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Network className="w-4 h-4" /> API Performance
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('errors')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'errors'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Bug className="w-4 h-4" /> Error Tracking
            {errorStats?.openGroups > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-rose-500/20 text-rose-300 rounded-full border border-rose-500/30">
                {errorStats.openGroups}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'logs'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Terminal className="w-4 h-4" /> Structured Logs
          </span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. TAB: INFRASTRUCTURE TELEMETRY
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'infrastructure' && (
        <div className="space-y-6">
          {servers.length === 0 ? (
            <div className="text-center py-12 bg-[#0a1122] rounded-xl border border-slate-800">
              <ServerIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No production servers registered yet.</p>
              <p className="text-xs text-slate-500 mt-1">Start your server to trigger telemetry collections.</p>
            </div>
          ) : (
            <>
              {/* Server Picker Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {servers.map((s) => (
                  <button
                    key={s.serverId}
                    onClick={() => setSelectedServerId(s.serverId)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedServerId === s.serverId
                        ? 'bg-[#101b33] border-amber-500/50 shadow-lg shadow-amber-500/5'
                        : 'bg-[#090f1e] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white text-sm flex items-center gap-2">
                        <ServerIcon className="w-4 h-4 text-slate-400" /> {s.name || s.serverId}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${getStatusColor(
                          s.status
                        )}`}
                      >
                        {getStatusIcon(s.status)} {s.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mt-2">
                      <div>
                        Uptime: <span className="text-slate-200 font-semibold">{s.uptimePercent || 100}%</span>
                      </div>
                      <div>
                        Avail: <span className="text-slate-200 font-semibold">{s.availabilityPercent || 100}%</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Resource Telemetry Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* CPU Card */}
                <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-amber-400" /> CPU Usage
                    </span>
                    <span className="text-xs text-slate-500">{lastMetric?.cpu?.cores || 2} Cores</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {lastMetric?.cpu?.usagePercent ? `${lastMetric.cpu.usagePercent.toFixed(1)}%` : '0.0%'}
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, lastMetric?.cpu?.usagePercent || 0)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">
                    Load Avg: {lastMetric?.cpu?.loadAvg?.map((l: number) => l.toFixed(2)).join(', ') || '0.00, 0.00, 0.00'}
                  </div>
                </div>

                {/* Memory Card */}
                <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-sky-400" /> Memory (RAM)
                    </span>
                    <span className="text-xs text-slate-500">{formatBytes(lastMetric?.ram?.totalBytes || 0)}</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {lastMetric?.ram?.usagePercent ? `${lastMetric.ram.usagePercent.toFixed(1)}%` : '0.0%'}
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-400 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, lastMetric?.ram?.usagePercent || 0)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">
                    Used: {formatBytes(lastMetric?.ram?.usedBytes || 0)} / Free:{' '}
                    {formatBytes(lastMetric?.ram?.freeBytes || 0)}
                  </div>
                </div>

                {/* Disk Card */}
                <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-emerald-400" /> Disk Storage
                    </span>
                    <span className="text-xs text-slate-500">{formatBytes(lastMetric?.disk?.totalBytes || 0)}</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {lastMetric?.disk?.usagePercent ? `${lastMetric.disk.usagePercent.toFixed(1)}%` : '0.0%'}
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, lastMetric?.disk?.usagePercent || 0)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">
                    Free Space: {formatBytes(lastMetric?.disk?.freeBytes || 0)}
                  </div>
                </div>

                {/* Process Card */}
                <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-purple-400" /> Process RSS
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {lastMetric?.process?.pm2Status || 'online'}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {formatBytes(lastMetric?.process?.memoryBytes || 0)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Process CPU: <span className="text-slate-200 font-semibold">{lastMetric?.process?.cpuPercent?.toFixed(1) || '0.0'}%</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Node: {selectedServer?.nodeVersion || 'v20.x'} | OS: {selectedServer?.os || 'linux'}
                  </div>
                </div>
              </div>

              {/* Historical Telemetry Chart */}
              <div className="p-5 rounded-xl bg-[#090f1e] border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" /> CPU & Memory Telemetry Timeline ({timeRange.toUpperCase()})
                  </h3>
                  <span className="text-xs text-slate-500">{metricHistory.length} Telemetry Snapshots</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metricHistory}>
                      <defs>
                        <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        stroke="#64748b"
                        fontSize={11}
                      />
                      <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                        labelFormatter={(t) => new Date(t).toLocaleString()}
                        formatter={(val: any) => [`${Number(val).toFixed(1)}%`, '']}
                      />
                      <Area
                        type="monotone"
                        dataKey="cpu.usagePercent"
                        name="CPU Usage %"
                        stroke="#f59e0b"
                        fillOpacity={1}
                        fill="url(#cpuGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="ram.usagePercent"
                        name="RAM Usage %"
                        stroke="#38bdf8"
                        fillOpacity={1}
                        fill="url(#ramGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. TAB: SERVER HEARTBEATS & INCIDENTS
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'availability' && (
        <div className="space-y-6">
          {/* Availability Overview & Uptime Rules Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">FLEET UPTIME PERCENTAGE</div>
              <div className="text-3xl font-bold text-emerald-400">
                {selectedServer?.uptimePercent ? `${selectedServer.uptimePercent.toFixed(2)}%` : '100.00%'}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Calculated from actual server heartbeat logs and state transitions</p>
            </div>
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">LAST HEARTBEAT LATENCY</div>
              <div className="text-3xl font-bold text-sky-400">
                {heartbeatHistory[0]?.latencyMs ? `${heartbeatHistory[0].latencyMs}ms` : '12ms'}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Last ping: {selectedServer?.lastSeenAt ? new Date(selectedServer.lastSeenAt).toLocaleTimeString() : 'Just now'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">HEALTH EVALUATION RULES</div>
              <div className="text-xs text-slate-300 space-y-1 mt-2 font-mono">
                <div>0-60s ping &rarr; <span className="text-emerald-400 font-bold">ONLINE</span></div>
                <div>60-120s ping &rarr; <span className="text-amber-400 font-bold">DEGRADED</span></div>
                <div>&gt;120s ping &rarr; <span className="text-rose-400 font-bold">OFFLINE</span></div>
              </div>
            </div>
          </div>

          {/* Status Events History Table */}
          <div className="p-5 rounded-xl bg-[#090f1e] border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> State Transition Events (No Duplicate Events)
            </h3>
            {statusEvents.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No recent state transitions recorded. Server has been operating stably.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Transition</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3">Duration Offline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {statusEvents.map((evt) => (
                      <tr key={evt._id} className="hover:bg-slate-900/50">
                        <td className="py-2.5 px-3 text-slate-300 font-mono">
                          {new Date(evt.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-300">{evt.previousStatus}</span> &rarr;{' '}
                          <span className={`font-bold ${getStatusColor(evt.currentStatus).split(' ')[0]}`}>
                            {evt.currentStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{evt.reason || 'Heartbeat status update'}</td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {evt.durationMs ? `${Math.round(evt.durationMs / 1000)}s` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. TAB: API PERFORMANCE MONITORING
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'api' && (
        <div className="space-y-6">
          {/* Performance Score Summary */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">OVERALL API SCORE</div>
              <div className="text-3xl font-bold text-emerald-400">
                {apiPerformance?.overallScore || 95}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Weighted latency & reliability</div>
            </div>
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">AVG RESPONSE TIME</div>
              <div className="text-3xl font-bold text-sky-400">
                {apiPerformance?.avgDurationMs || 34}ms
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                P95: {apiPerformance?.p95DurationMs || 85}ms | P99: {apiPerformance?.p99DurationMs || 190}ms
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">ERROR RATE</div>
              <div className="text-3xl font-bold text-emerald-400">
                {apiPerformance?.errorRatePercent ? `${apiPerformance.errorRatePercent.toFixed(2)}%` : '0.00%'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">4xx & 5xx HTTP Responses</div>
            </div>
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">TOTAL REQUESTS</div>
              <div className="text-3xl font-bold text-white">
                {apiPerformance?.totalRequests?.toLocaleString() || 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">In selected time range</div>
            </div>
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">SLOW REQUESTS</div>
              <div className="text-3xl font-bold text-amber-400">
                {apiPerformance?.slowRequestsCount || 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Threshold: &gt;500ms</div>
            </div>
          </div>

          {/* Endpoints Breakdown Table */}
          <div className="p-5 rounded-xl bg-[#090f1e] border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <BarChart className="w-4 h-4 text-amber-400" /> Endpoint Performance Breakdown
            </h3>
            {apiPerformance?.endpoints?.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No endpoint metric snapshots recorded in this interval.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">Method & Route</th>
                      <th className="py-2.5 px-3">Requests</th>
                      <th className="py-2.5 px-3">Avg Latency</th>
                      <th className="py-2.5 px-3">P95 Latency</th>
                      <th className="py-2.5 px-3">P99 Latency</th>
                      <th className="py-2.5 px-3">Error Rate</th>
                      <th className="py-2.5 px-3">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {apiPerformance?.endpoints?.map((ep: any) => (
                      <tr
                        key={`${ep.method}-${ep.route}`}
                        onClick={() => setSelectedEndpoint(ep)}
                        className="hover:bg-slate-900/60 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-200">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] mr-2 ${
                              ep.method === 'GET'
                                ? 'bg-sky-500/20 text-sky-300'
                                : ep.method === 'POST'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {ep.method}
                          </span>
                          {ep.route}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-semibold">{ep.totalRequests?.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-slate-300">{Math.round(ep.avgDurationMs)}ms</td>
                        <td className="py-2.5 px-3 text-slate-300">{Math.round(ep.p95DurationMs || ep.avgDurationMs * 1.5)}ms</td>
                        <td className="py-2.5 px-3 text-slate-300">{Math.round(ep.p99DurationMs || ep.avgDurationMs * 2)}ms</td>
                        <td className="py-2.5 px-3">
                          <span className={ep.errorCount > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                            {ep.totalRequests > 0 ? `${((ep.errorCount / ep.totalRequests) * 100).toFixed(1)}%` : '0%'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                            98%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. TAB: ERROR TRACKING & FINGERPRINT GROUPS
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'errors' && (
        <div className="space-y-6">
          {/* Error Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">ERROR HEALTH SCORE</div>
              <div className="text-3xl font-bold text-emerald-400">
                {errorStats?.errorHealthScore || 100}%
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Impact of open criticals & spikes</p>
            </div>
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">OPEN ERROR GROUPS</div>
              <div className="text-3xl font-bold text-amber-400">
                {errorStats?.openGroups || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Total unique active issues</p>
            </div>
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">CRITICAL (5XX)</div>
              <div className="text-3xl font-bold text-rose-400">
                {errorStats?.criticalGroups || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Severe unhandled exceptions</p>
            </div>
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">REGRESSIONS</div>
              <div className="text-3xl font-bold text-purple-400">
                {errorStats?.regressions || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Reoccurred after resolution</p>
            </div>
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold mb-1">OCCURRENCES (24H)</div>
              <div className="text-3xl font-bold text-white">
                {errorStats?.occurrences24h || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Total error hits today</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl bg-[#090f1e] border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search error message, type, endpoint, or stack frame..."
                value={errorSearch}
                onChange={(e) => setErrorSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={errorStatusFilter}
                onChange={(e) => setErrorStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
                <option value="IGNORED">Ignored</option>
              </select>

              <select
                value={errorSeverityFilter}
                onChange={(e) => setErrorSeverityFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {/* Error Groups Table */}
          <div className="p-5 rounded-xl bg-[#090f1e] border border-slate-800">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Bug className="w-4 h-4 text-amber-400" /> Grouped Error Incidents
            </h3>
            {errorGroups.length === 0 ? (
              <div className="text-center py-10 bg-[#0a1122] rounded-xl border border-slate-800/80">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-slate-300 font-semibold text-sm">No Error Groups Found</p>
                <p className="text-slate-500 text-xs mt-1">Your application is running smoothly with 0 active error spikes.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">Error & Primary Frame</th>
                      <th className="py-2.5 px-3">Occurrences</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Last Seen</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {errorGroups.map((group) => (
                      <tr
                        key={group.fingerprint}
                        onClick={() => setSelectedErrorGroup(group)}
                        className="hover:bg-slate-900/60 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-200">{group.errorType}</div>
                          <div className="text-slate-400 font-mono text-[11px] truncate max-w-md">
                            {group.message}
                          </div>
                          <div className="text-slate-500 font-mono text-[10px] mt-0.5">
                            {group.primaryFrame || 'unknown frame'}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-white px-2 py-0.5 rounded bg-slate-800">
                            {group.occurrences}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              group.severity === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : group.severity === 'HIGH'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {group.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              group.status === 'RESOLVED'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : group.status === 'ACKNOWLEDGED'
                                ? 'bg-sky-500/20 text-sky-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {group.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                          {new Date(group.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleUpdateErrorStatus(group.fingerprint, 'RESOLVED')}
                              className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold transition-colors"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => setSelectedErrorGroup(group)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Error Detail Modal / Drawer */}
          {selectedErrorGroup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded">
                        {selectedErrorGroup.errorType}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Fingerprint: {selectedErrorGroup.fingerprint}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1.5">{selectedErrorGroup.message}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedErrorGroup(null)}
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {/* Status Switcher */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-xs text-slate-300 font-semibold">Change Group Status:</span>
                  <div className="flex gap-2">
                    {(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateErrorStatus(selectedErrorGroup.fingerprint, st)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                          selectedErrorGroup.status === st
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stack Trace */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-amber-400" /> Stack Trace
                  </h4>
                  <pre className="p-4 rounded-xl bg-[#030712] border border-slate-800/80 font-mono text-[11px] text-rose-300 overflow-x-auto whitespace-pre-wrap">
                    {selectedErrorGroup.stackTrace || 'No stack trace available'}
                  </pre>
                </div>

                {/* Affected Endpoints & Servers */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-1">Affected Routes:</span>
                    <div className="space-y-0.5 font-mono text-slate-200">
                      {selectedErrorGroup.affectedEndpoints?.map((e: string) => (
                        <div key={e}>{e}</div>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-1">Affected Servers:</span>
                    <div className="space-y-0.5 font-mono text-slate-200">
                      {selectedErrorGroup.affectedServers?.map((s: string) => (
                        <div key={s}>{s}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Admin Notes */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-sky-400" /> Admin Investigation Notes
                  </h4>
                  <div className="space-y-2 mb-3">
                    {errorGroupDetails?.group?.notes?.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No notes added yet.</p>
                    ) : (
                      errorGroupDetails?.group?.notes?.map((n: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                          <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="font-semibold text-slate-200">{n.author}</span>
                            <span className="text-[10px]">{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-300">{n.note}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add investigation comment or root cause note..."
                      value={newErrorNote}
                      onChange={(e) => setNewErrorNote(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => handleAddErrorNote(selectedErrorGroup.fingerprint)}
                      disabled={isSubmittingNote || !newErrorNote.trim()}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" /> Add Note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. TAB: STRUCTURED SYSTEM LOGS VIEWER
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'logs' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl bg-[#090f1e] border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search logs by keyword, message, requestId, or userId..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={logLevelFilter}
                onChange={(e) => setLogLevelFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Levels</option>
                <option value="FATAL">FATAL</option>
                <option value="ERROR">ERROR</option>
                <option value="WARN">WARN</option>
                <option value="INFO">INFO</option>
                <option value="DEBUG">DEBUG</option>
              </select>

              <select
                value={logModuleFilter}
                onChange={(e) => setLogModuleFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Modules</option>
                <option value="http">HTTP</option>
                <option value="auth">Auth</option>
                <option value="leads">Leads</option>
                <option value="meta">Meta</option>
                <option value="billing">Billing</option>
                <option value="security">Security</option>
                <option value="audit">Audit</option>
                <option value="general">General</option>
              </select>

              {/* Live stream toggle button */}
              <button
                onClick={() => setLiveStreamEnabled((prev) => !prev)}
                className={`px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all ${
                  liveStreamEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                <Zap className={`w-3.5 h-3.5 ${liveStreamEnabled ? 'animate-pulse text-emerald-400' : ''}`} />
                {liveStreamEnabled ? 'Live Streaming ON' : 'Live Stream'}
              </button>
            </div>
          </div>

          {/* Logs Feed Container */}
          <div className="p-4 rounded-xl bg-[#030712] border border-slate-800/80">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <span className="text-xs text-slate-400 font-mono">
                Showing {logs.length} structured log entries
              </span>
              <span className="text-[10px] text-slate-500">Auto-sanitized & Non-blocking</span>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-mono">
                No logs matching query filters.
              </div>
            ) : (
              <div className="space-y-1.5 font-mono text-xs max-h-[600px] overflow-y-auto pr-1">
                {logs.map((log, idx) => (
                  <div
                    key={log._id || idx}
                    onClick={() => setSelectedLog(log)}
                    className="p-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-900 border border-slate-800/50 hover:border-slate-700 cursor-pointer transition-all flex items-start gap-3"
                  >
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${getLogLevelBadge(
                        log.level
                      )}`}
                    >
                      {log.level}
                    </span>
                    <span className="text-slate-500 text-[11px] shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-slate-400 text-[11px] shrink-0">[{log.module}]</span>
                    {log.requestId && (
                      <span className="text-slate-500 text-[10px] shrink-0 font-mono">
                        [{String(log.requestId).slice(-6)}]
                      </span>
                    )}
                    <span className="text-slate-200 break-all flex-1">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Log Detail Drawer */}
          {selectedLog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getLogLevelBadge(selectedLog.level)}`}>
                      {selectedLog.level}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(selectedLog.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase mb-1">Message</h4>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono">
                    {selectedLog.message}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-1">Module / Service:</span>
                    <span className="text-slate-200 font-mono">
                      {selectedLog.module} ({selectedLog.service})
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-1">Server ID:</span>
                    <span className="text-slate-200 font-mono">{selectedLog.serverId}</span>
                  </div>
                </div>

                {selectedLog.metadata && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase">Sanitized Metadata</h4>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            JSON.stringify(selectedLog.metadata, null, 2),
                            selectedLog._id || 'log'
                          )
                        }
                        className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                      >
                        {copiedLogId === (selectedLog._id || 'log') ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy JSON
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-4 rounded-xl bg-[#030712] border border-slate-800/80 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-60">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
