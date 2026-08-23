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
  const [activeSubTab, setActiveSubTab] = useState<'infrastructure' | 'availability' | 'api'>('infrastructure');
  const [servers, setServers] = useState<any[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [metricHistory, setMetricHistory] = useState<any[]>([]);
  const [apiPerformance, setApiPerformance] = useState<any>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<any | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('1h');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshCount, setRefreshCount] = useState<number>(0);

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
    } catch (error) {
      console.error('Failed to load system health data:', error);
      toast.error('Failed to reload telemetry data');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, selectedServerId, timeRange]);

  const fetchMetricHistory = useCallback(async () => {
    if (!selectedServerId) return;
    try {
      const historyRes = await authFetch(`/admin/monitoring/servers/${selectedServerId}/history?range=${timeRange}`);
      if (historyRes?.success) {
        setMetricHistory(historyRes.history || []);
      }
    } catch (err) {
      console.warn('Failed to load metrics history:', err);
    }
  }, [authFetch, selectedServerId, timeRange]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, refreshCount, timeRange]);

  useEffect(() => {
    fetchMetricHistory();
  }, [fetchMetricHistory, selectedServerId, refreshCount, timeRange]);

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

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 75) return 'text-emerald-300';
    if (score >= 60) return 'text-amber-400';
    return 'text-rose-400';
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
      {/* Dashboard Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-[#090f1e] border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" /> Infrastructure & System Health
          </h2>
          <p className="text-xs text-slate-400">Real-time server telemetry and API endpoint performance logs</p>
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
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => {
            setActiveSubTab('infrastructure');
            setSelectedEndpoint(null);
          }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
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
          onClick={() => {
            setActiveSubTab('availability');
            setSelectedEndpoint(null);
          }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeSubTab === 'availability'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Wifi className="w-4 h-4" /> Server Heartbeats & Incidents
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('api')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeSubTab === 'api'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Network className="w-4 h-4" /> API Performance Monitoring
          </span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB: INFRASTRUCTURE TELEMETRY
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'infrastructure' && (
        <div className="space-y-6">
          {/* Server Picker Grid */}
          {servers.length === 0 ? (
            <div className="text-center py-12 bg-[#0a1122] rounded-xl border border-slate-800">
              <ServerIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No production servers registered yet.</p>
              <p className="text-xs text-slate-500 mt-1">Start your server to trigger telemetry collections.</p>
            </div>
          ) : (
            <>
              {/* Server List Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {servers.map((s) => (
                  <button
                    key={s.serverId}
                    onClick={() => setSelectedServerId(s.serverId)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedServerId === s.serverId
                        ? 'bg-[#121b2d] border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                        : 'bg-[#090f1d] border-slate-800 hover:bg-[#0c1426] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white text-sm">{s.name}</h4>
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">{s.hostname}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusColor(s.status)}`}>
                        {s.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Health Score</span>
                        <span className={`font-bold ${getHealthScoreColor(s.healthScore || 100)}`}>
                          {s.healthScore || 100}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Node.js</span>
                        <span className="font-semibold text-slate-300 block overflow-hidden text-ellipsis whitespace-nowrap">
                          {s.nodeVersion || 'v20.x'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {selectedServer && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Server Status Detail */}
                  <div className="p-5 rounded-xl bg-[#090f1d] border border-slate-800 space-y-4 h-fit">
                    <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Server Details</h3>
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Environment:</span>
                        <span className="text-amber-400 font-bold uppercase font-mono">{selectedServer.environment}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Operating System:</span>
                        <span className="text-slate-300 font-semibold">{selectedServer.os}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Uptime:</span>
                        <span className="text-slate-300 font-mono font-semibold">
                          {selectedServer.uptimePercentage}% (30-day index)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Last Seen:</span>
                        <span className="text-slate-300 font-mono">
                          {selectedServer.lastSeenAt ? new Date(selectedServer.lastSeenAt).toLocaleTimeString() : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Heartbeat Latency:</span>
                        <span className="text-emerald-400 font-mono font-bold">
                          {selectedServer.incidents?.[0]?.durationMs ? 'Online' : 'Normal'}
                        </span>
                      </div>
                    </div>

                    {lastMetric && (
                      <div className="pt-4 border-t border-slate-800 space-y-4">
                        <h4 className="text-xs font-bold text-slate-300">Live Resource Utilization</h4>
                        <div className="space-y-3">
                          {/* CPU usage bar */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-400">CPU Usage</span>
                              <span className="text-slate-300 font-mono">{lastMetric.cpu?.usagePercent}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500"
                                style={{ width: `${lastMetric.cpu?.usagePercent}%` }}
                              />
                            </div>
                          </div>

                          {/* RAM usage bar */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-400">RAM Usage</span>
                              <span className="text-slate-300 font-mono">{lastMetric.ram?.usagePercent}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-400"
                                style={{ width: `${lastMetric.ram?.usagePercent}%` }}
                              />
                            </div>
                          </div>

                          {/* Disk usage bar */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-400">Disk Space</span>
                              <span className="text-slate-300 font-mono">{lastMetric.disk?.usagePercent}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-400"
                                style={{ width: `${lastMetric.disk?.usagePercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Historical telemetry graphs */}
                  <div className="lg:col-span-2 p-5 rounded-xl bg-[#090f1d] border border-slate-800 space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-white">Historical Telemetry Trends</h3>
                      <span className="text-[10px] text-slate-500 font-mono">Range: {timeRange.toUpperCase()}</span>
                    </div>

                    {metricHistory.length === 0 ? (
                      <div className="flex justify-center items-center h-64 bg-slate-900/25 rounded-lg border border-dashed border-slate-800">
                        <p className="text-xs text-slate-500">Generating initial metric chart samples...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* CPU & Memory usage chart */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-amber-500" /> CPU & RAM Usage Percentage (%)
                          </h4>
                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={metricHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis
                                  dataKey="timestamp"
                                  stroke="#64748b"
                                  fontSize={9}
                                  tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                />
                                <YAxis stroke="#64748b" fontSize={9} domain={[0, 100]} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                  labelStyle={{ color: '#fff', fontSize: '10px' }}
                                  itemStyle={{ fontSize: '10px' }}
                                  labelFormatter={(label) => new Date(label).toLocaleString()}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="cpu.usagePercent"
                                  name="CPU Usage"
                                  stroke="#f59e0b"
                                  strokeWidth={1.5}
                                  dot={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="ram.usagePercent"
                                  name="RAM Usage"
                                  stroke="#10b981"
                                  strokeWidth={1.5}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Network uploads & download chart */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <Network className="w-3.5 h-3.5 text-blue-400" /> Network Bytes Transmitted
                          </h4>
                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={metricHistory} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis
                                  dataKey="timestamp"
                                  stroke="#64748b"
                                  fontSize={9}
                                  tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                />
                                <YAxis
                                  stroke="#64748b"
                                  fontSize={9}
                                  tickFormatter={(val) => formatBytes(val, 0)}
                                />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                  labelStyle={{ color: '#fff', fontSize: '10px' }}
                                  itemStyle={{ fontSize: '10px' }}
                                  labelFormatter={(label) => new Date(label).toLocaleString()}
                                  formatter={(val: any) => [formatBytes(val), 'Speed']}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="network.downloadBytesSec"
                                  name="Download Rate"
                                  stroke="#06b6d4"
                                  fill="rgba(6, 182, 212, 0.1)"
                                  strokeWidth={1.5}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="network.uploadBytesSec"
                                  name="Upload Rate"
                                  stroke="#ec4899"
                                  fill="rgba(236, 72, 153, 0.1)"
                                  strokeWidth={1.5}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB: HEARTBEAT LOGS & INCIDENTS
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'availability' && (
        <div className="space-y-6">
          {/* Selected Server Availability Overview */}
          {selectedServer ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[#090f1d] border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 font-medium">Uptime Availability</span>
                <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                  {selectedServer.uptimePercentage}%
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Calculated from 30d logs</span>
              </div>

              <div className="p-4 bg-[#090f1d] border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 font-medium">Last Ping Latency</span>
                <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
                  {metricHistory.length > 0 ? 'Normal' : 'Stale'}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Client to server delay</span>
              </div>

              <div className="p-4 bg-[#090f1d] border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 font-medium">Total Downtime Incidents</span>
                <div className="text-2xl font-black text-rose-400 mt-1 font-mono">
                  {selectedServer.incidentCount}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Service outages recorded</span>
              </div>

              <div className="p-4 bg-[#090f1d] border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 font-medium">Status</span>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusIcon(selectedServer.status)}
                  <span className="text-sm font-bold text-white uppercase font-mono">{selectedServer.status}</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Incidents tracking & downtime list */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-[#090f1d] border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-400" /> Recorded Service Incidents
              </h3>

              {!selectedServer?.incidents || selectedServer.incidents.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/20 border border-slate-850 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-emerald-400/80 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">All systems operational.</p>
                  <p className="text-[10px] text-slate-500">No server downtime recorded in this timeframe.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold">
                        <th className="pb-2">Incident ID</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Started At</th>
                        <th className="pb-2">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {selectedServer.incidents.map((inc: any) => (
                        <tr key={inc._id} className="text-slate-300 hover:bg-slate-900/30">
                          <td className="py-2.5 font-mono text-[10px] text-slate-400">{inc._id?.substring(18)}</td>
                          <td className="py-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                inc.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              {inc.status}
                            </span>
                          </td>
                          <td className="py-2.5 font-mono text-[11px]">
                            {new Date(inc.startedAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-2.5 font-mono text-amber-300 font-bold">
                            {inc.durationMs ? `${Math.round(inc.durationMs / 1000)}s` : 'Open outage'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl bg-[#090f1d] border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" /> Recent Heartbeats Received
              </h3>

              {metricHistory.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/20 border border-slate-850 rounded-lg">
                  <p className="text-xs text-slate-500">No heartbeat logs found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold">
                        <th className="pb-2">Timestamp</th>
                        <th className="pb-2">CPU</th>
                        <th className="pb-2">RAM</th>
                        <th className="pb-2">Process CPU</th>
                        <th className="pb-2">PM2 Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {[...metricHistory].reverse().slice(0, 15).map((m: any, idx: number) => (
                        <tr key={m._id || idx} className="text-slate-300 hover:bg-slate-900/30">
                          <td className="py-2 font-mono text-[10px] text-slate-400">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-2 font-mono text-[11px]">{m.cpu?.usagePercent}%</td>
                          <td className="py-2 font-mono text-[11px]">{m.ram?.usagePercent}%</td>
                          <td className="py-2 font-mono text-[11px] text-amber-400">{m.process?.cpuPercent}%</td>
                          <td className="py-2">
                            <span className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800 uppercase font-bold">
                              {m.process?.pm2Status || 'online'}
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB: API PERFORMANCE MONITORING
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'api' && (
        <div className="space-y-6">
          {apiPerformance ? (
            <>
              {/* Snapshot Score Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-[#090f1d] border border-slate-800 rounded-xl">
                  <span className="text-xs text-slate-400 font-medium">Overall API Performance</span>
                  <div className="text-2xl font-black text-amber-500 mt-1 font-mono">
                    {apiPerformance.snapshot?.overallScore}%
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${apiPerformance.snapshot?.overallScore}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 bg-[#090f1d] border border-slate-800 rounded-xl">
                  <span className="text-xs text-slate-400 font-medium">Latency Score</span>
                  <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                    {apiPerformance.snapshot?.latencyScore}%
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${apiPerformance.snapshot?.latencyScore}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 bg-[#090f1d] border border-slate-800 rounded-xl">
                  <span className="text-xs text-slate-400 font-medium">Availability Score</span>
                  <div className="text-2xl font-black text-blue-400 mt-1 font-mono">
                    {apiPerformance.snapshot?.availabilityScore}%
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-blue-400"
                      style={{ width: `${apiPerformance.snapshot?.availabilityScore}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 bg-[#090f1d] border border-slate-800 rounded-xl">
                  <span className="text-xs text-slate-400 font-medium">Reliability Score</span>
                  <div className="text-2xl font-black text-pink-400 mt-1 font-mono">
                    {apiPerformance.snapshot?.reliabilityScore}%
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-pink-400"
                      style={{ width: `${apiPerformance.snapshot?.reliabilityScore}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: API Endpoints Table */}
                <div className="lg:col-span-2 p-5 rounded-xl bg-[#090f1d] border border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-white">Endpoint Performance Summary</h3>
                  
                  {apiPerformance.endpoints?.length === 0 ? (
                    <div className="text-center py-10 bg-slate-900/20 border border-slate-850 rounded-lg">
                      <p className="text-xs text-slate-500">Waiting for API request metrics traffic...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 font-bold">
                            <th className="pb-2">Method</th>
                            <th className="pb-2">Route</th>
                            <th className="pb-2">Requests</th>
                            <th className="pb-2">Avg Resp</th>
                            <th className="pb-2">P95</th>
                            <th className="pb-2">Errors</th>
                            <th className="pb-2">Health</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {apiPerformance.endpoints.map((ep: any, idx: number) => (
                            <tr
                              key={idx}
                              onClick={() => setSelectedEndpoint(ep)}
                              className={`text-slate-300 hover:bg-slate-900/40 cursor-pointer transition-colors ${
                                selectedEndpoint?.route === ep.route && selectedEndpoint?.method === ep.method
                                  ? 'bg-[#121c30]'
                                  : ''
                              }`}
                            >
                              <td className="py-2.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    ep.method === 'GET'
                                      ? 'bg-emerald-500/10 text-emerald-400'
                                      : ep.method === 'POST'
                                      ? 'bg-blue-500/10 text-blue-400'
                                      : ep.method === 'PUT' || ep.method === 'PATCH'
                                      ? 'bg-amber-500/10 text-amber-400'
                                      : 'bg-rose-500/10 text-rose-400'
                                  }`}
                                >
                                  {ep.method}
                                </span>
                              </td>
                              <td className="py-2.5 font-mono text-[11px] max-w-[200px] truncate" title={ep.route}>
                                {ep.route}
                              </td>
                              <td className="py-2.5 font-mono font-semibold">{ep.requests}</td>
                              <td className="py-2.5 font-mono">{ep.avgResponseTime}ms</td>
                              <td className="py-2.5 font-mono">{ep.p95}ms</td>
                              <td className="py-2.5 font-mono text-rose-400">{ep.errorsCount}</td>
                              <td className="py-2.5 font-bold">
                                <span className={getHealthScoreColor(ep.healthScore)}>{ep.healthScore}%</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Right Column: Endpoint drill-down history / overall latency charts */}
                <div className="p-5 rounded-xl bg-[#090f1d] border border-slate-800 space-y-4">
                  {selectedEndpoint ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-300">Endpoint Drill-Down</h4>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5 max-w-[220px] truncate">
                            {selectedEndpoint.method} {selectedEndpoint.route}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedEndpoint(null)}
                          className="text-[10px] text-amber-400 hover:text-white"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="space-y-4 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-slate-900 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Total Load</span>
                            <span className="font-bold text-slate-300">{selectedEndpoint.requests} calls</span>
                          </div>
                          <div className="p-2 bg-slate-900 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">P95 Latency</span>
                            <span className="font-bold text-amber-400 font-mono">{selectedEndpoint.p95}ms</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500">Endpoint Health Analysis</span>
                          <p className="text-slate-300 text-xs">
                            {selectedEndpoint.healthScore >= 90
                              ? 'Excellent speed and zero error rate. Fully optimized.'
                              : selectedEndpoint.healthScore >= 70
                              ? 'Warning: Some high tail latency spikes detected. Check database indexing.'
                              : 'Critical: High error rates or excessive response delays. Action required.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-300">API Health Over Time</h4>
                      {apiPerformance.history?.length === 0 ? (
                        <div className="flex justify-center items-center h-48 bg-slate-900/10 rounded-lg border border-dashed border-slate-800">
                          <p className="text-[10px] text-slate-500">Gathering historical snap data...</p>
                        </div>
                      ) : (
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={apiPerformance.history} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis
                                dataKey="timestamp"
                                stroke="#64748b"
                                fontSize={8}
                                tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              />
                              <YAxis stroke="#64748b" fontSize={8} domain={[0, 100]} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                labelStyle={{ color: '#fff', fontSize: '9px' }}
                                itemStyle={{ fontSize: '9px' }}
                              />
                              <Line
                                type="monotone"
                                dataKey="overallScore"
                                name="API Performance Score"
                                stroke="#f59e0b"
                                strokeWidth={1.5}
                                dot={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-10 bg-slate-900/20 border border-slate-850 rounded-lg">
              <p className="text-xs text-slate-500">API telemetry metrics summary loading...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
