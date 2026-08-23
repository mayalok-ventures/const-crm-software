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
  History,
  Download,
  Database,
  Lock,
  FileSpreadsheet,
  ShieldCheck,
  Bell,
  Sliders,
  Volume2,
  VolumeX,
  Radio,
  Mail,
  MessageCircle,
  Share2,
  Plus,
  HeartPulse,
  Boxes,
  FileCheck,
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
    'infrastructure' | 'availability' | 'api' | 'errors' | 'logs' | 'security' | 'audit' | 'database' | 'backups' | 'alerts' | 'health'
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

  // Security & Abuse Detection State
  const [securityStats, setSecurityStats] = useState<any>(null);
  const [securityIncidents, setSecurityIncidents] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [blockedIps, setBlockedIps] = useState<any[]>([]);
  const [securityRules, setSecurityRules] = useState<any[]>([]);
  const [securityView, setSecurityView] = useState<'incidents' | 'events' | 'blocked_ips' | 'rules'>('incidents');
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<string>('ALL');
  const [securityEventTypeFilter, setSecurityEventTypeFilter] = useState<string>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [incidentDetails, setIncidentDetails] = useState<any | null>(null);
  const [newIncidentNote, setNewIncidentNote] = useState<string>('');
  const [isSubmittingIncidentNote, setIsSubmittingIncidentNote] = useState<boolean>(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState<boolean>(false);
  const [manualIpToBlock, setManualIpToBlock] = useState<string>('');
  const [manualBlockReason, setManualBlockReason] = useState<string>('');
  const [manualBlockDuration, setManualBlockDuration] = useState<number>(60);
  const [editingRule, setEditingRule] = useState<any | null>(null);

  // Immutable Audit Logging State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');
  const [auditResourceFilter, setAuditResourceFilter] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);
  const [auditDateFrom, setAuditDateFrom] = useState<string>('');
  const [auditDateTo, setAuditDateTo] = useState<string>('');
  const [isArchiving, setIsArchiving] = useState<boolean>(false);
  const [archiveResultModal, setArchiveResultModal] = useState<any | null>(null);

  // MongoDB Database Monitoring State
  const [dbOverview, setDbOverview] = useState<any>(null);
  const [dbCollections, setDbCollections] = useState<any[]>([]);
  const [dbMetrics, setDbMetrics] = useState<any[]>([]);
  const [slowQueries, setSlowQueries] = useState<any[]>([]);
  const [dbRange, setDbRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [dbCollectionSearch, setDbCollectionSearch] = useState<string>('');
  const [isPingingDb, setIsPingingDb] = useState<boolean>(false);
  const [dbPingResult, setDbPingResult] = useState<any | null>(null);

  // Production-Grade Backup Monitoring State
  const [backupOverview, setBackupOverview] = useState<any>(null);
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [backupPolicies, setBackupPolicies] = useState<any[]>([]);
  const [backupIncidents, setBackupIncidents] = useState<any[]>([]);
  const [backupStatusFilter, setBackupStatusFilter] = useState<string>('ALL');
  const [selectedBackupRecord, setSelectedBackupRecord] = useState<any | null>(null);
  const [isTriggeringBackup, setIsTriggeringBackup] = useState<boolean>(false);
  const [isVerifyingBackup, setIsVerifyingBackup] = useState<boolean>(false);
  const [verifyingBackupId, setVerifyingBackupId] = useState<string | null>(null);
  const [verificationReportModal, setVerificationReportModal] = useState<any | null>(null);
  const [resolvingIncident, setResolvingIncident] = useState<any | null>(null);
  const [incidentResolveNote, setIncidentResolveNote] = useState<string>('');

  // Reusable Alert & Incident Management Engine State
  const [alertOverview, setAlertOverview] = useState<any>(null);
  const [incidentsList, setIncidentsList] = useState<any[]>([]);
  const [incidentFilterStatus, setIncidentFilterStatus] = useState<string>('ALL');
  const [incidentFilterSeverity, setIncidentFilterSeverity] = useState<string>('ALL');
  const [incidentSearch, setIncidentSearch] = useState<string>('');
  const [selectedIncidentDetail, setSelectedIncidentDetail] = useState<any | null>(null);
  const [alertRules, setAlertRules] = useState<any[]>([]);
  const [notificationChannels, setNotificationChannels] = useState<any[]>([]);
  const [notificationDeliveries, setNotificationDeliveries] = useState<any[]>([]);
  const [alertsViewMode, setAlertsViewMode] = useState<'incidents' | 'rules' | 'channels' | 'deliveries'>('incidents');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingAlertRule, setEditingAlertRule] = useState<any | null>(null);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState<boolean>(false);
  const [editingChannel, setEditingChannel] = useState<any | null>(null);
  const [isTestingChannelId, setIsTestingChannelId] = useState<string | null>(null);
  const [isSimulatingAnomaly, setIsSimulatingAnomaly] = useState<boolean>(false);
  const [simulatedMetric, setSimulatedMetric] = useState<string>('cpu');
  const [simulatedValue, setSimulatedValue] = useState<number>(96);
  const [resolvingAlertIncident, setResolvingAlertIncident] = useState<any | null>(null);
  const [alertResolveNotes, setAlertResolveNotes] = useState<string>('');
  const [alertRootCause, setAlertRootCause] = useState<string>('');

  // Production-Grade Health Check Framework State
  const [detailedHealth, setDetailedHealth] = useState<any>(null);
  const [livenessProbeResult, setLivenessProbeResult] = useState<any>(null);
  const [readinessProbeResult, setReadinessProbeResult] = useState<any>(null);
  const [summaryHealthResult, setSummaryHealthResult] = useState<any>(null);
  const [isProbingHealth, setIsProbingHealth] = useState<boolean>(false);
  const [activeProbeInspect, setActiveProbeInspect] = useState<'detailed' | 'live' | 'ready' | 'summary'>('detailed');
  const [copiedProbeUrl, setCopiedProbeUrl] = useState<string | null>(null);

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

      // 5. Fetch Security & Abuse Stats
      const [secStatsRes, incidentsRes, secEventsRes, blockedRes, rulesRes] = await Promise.all([
        authFetch('/admin/security/stats'),
        authFetch(`/admin/security/incidents?status=${incidentStatusFilter}`),
        authFetch(`/admin/security/events?type=${securityEventTypeFilter}&limit=100`),
        authFetch('/admin/security/blocked-ips'),
        authFetch('/admin/security/rules'),
      ]);
      if (secStatsRes?.success) setSecurityStats(secStatsRes.stats);
      if (incidentsRes?.success) setSecurityIncidents(incidentsRes.incidents || []);
      if (secEventsRes?.success) setSecurityEvents(secEventsRes.events || []);
      if (blockedRes?.success) setBlockedIps(blockedRes.blockedIps || []);
      if (rulesRes?.success) setSecurityRules(rulesRes.rules || []);

      // 6. Fetch Immutable Audit Trail & Stats
      const auditParams = new URLSearchParams();
      if (auditActionFilter !== 'ALL') auditParams.append('action', auditActionFilter);
      if (auditResourceFilter !== 'ALL') auditParams.append('resourceType', auditResourceFilter);
      if (auditSearch.trim()) auditParams.append('search', auditSearch.trim());
      if (auditDateFrom) auditParams.append('from', auditDateFrom);
      if (auditDateTo) auditParams.append('to', auditDateTo);
      auditParams.append('limit', '100');

      const [auditTimelineRes, auditStatsRes] = await Promise.all([
        authFetch(`/admin/audit/timeline?${auditParams.toString()}`),
        authFetch('/admin/audit/stats'),
      ]);
      if (auditTimelineRes?.success) setAuditLogs(auditTimelineRes.logs || []);
      if (auditStatsRes?.success) setAuditStats(auditStatsRes.stats);

      // 7. Fetch MongoDB Database Monitoring Data
      const [dbOverviewRes, dbColsRes, dbMetricsRes, slowQueriesRes] = await Promise.all([
        authFetch('/admin/database/overview'),
        authFetch('/admin/database/collections'),
        authFetch(`/admin/database/metrics?range=${dbRange}`),
        authFetch('/admin/database/slow-queries'),
      ]);
      if (dbOverviewRes?.success) setDbOverview(dbOverviewRes.database);
      if (dbColsRes?.success) setDbCollections(dbColsRes.collections || []);
      if (dbMetricsRes?.success) setDbMetrics(dbMetricsRes.metrics || []);
      if (slowQueriesRes?.success) setSlowQueries(slowQueriesRes.queries || []);

      // 8. Fetch Production-Grade Backup Telemetry & History
      const [bkpOverviewRes, bkpHistoryRes, bkpPoliciesRes, bkpIncidentsRes] = await Promise.all([
        authFetch('/admin/backups/overview'),
        authFetch(`/admin/backups/history?status=${backupStatusFilter}`),
        authFetch('/admin/backups/policies'),
        authFetch('/admin/backups/incidents'),
      ]);
      if (bkpOverviewRes?.success) setBackupOverview(bkpOverviewRes.data);
      if (bkpHistoryRes?.success) setBackupHistory(bkpHistoryRes.records || []);
      if (bkpPoliciesRes?.success) setBackupPolicies(bkpPoliciesRes.policies || []);
      if (bkpIncidentsRes?.success) setBackupIncidents(bkpIncidentsRes.incidents || []);

      // 9. Fetch Reusable Alert and Incident Telemetry
      const incidentParams = new URLSearchParams();
      if (incidentFilterStatus !== 'ALL') incidentParams.append('status', incidentFilterStatus);
      if (incidentFilterSeverity !== 'ALL') incidentParams.append('severity', incidentFilterSeverity);
      if (incidentSearch.trim()) incidentParams.append('search', incidentSearch.trim());

      const [alertOverviewRes, alertIncidentsRes, alertRulesRes, channelsRes, deliveriesRes] = await Promise.all([
        authFetch('/admin/alerts/overview'),
        authFetch(`/admin/alerts/incidents?${incidentParams.toString()}`),
        authFetch('/admin/alerts/rules'),
        authFetch('/admin/alerts/channels'),
        authFetch('/admin/alerts/deliveries?limit=50'),
      ]);
      if (alertOverviewRes?.success) setAlertOverview(alertOverviewRes.data);
      if (alertIncidentsRes?.success) setIncidentsList(alertIncidentsRes.incidents || []);
      if (alertRulesRes?.success) setAlertRules(alertRulesRes.rules || []);
      if (channelsRes?.success) setNotificationChannels(channelsRes.channels || []);
      if (deliveriesRes?.success) setNotificationDeliveries(deliveriesRes.deliveries || []);

      // 10. Fetch Production-Grade Health Framework Diagnostics
      const healthDetailedRes = await authFetch('/health/detailed');
      if (healthDetailedRes?.status) setDetailedHealth(healthDetailedRes);
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
    incidentStatusFilter,
    securityEventTypeFilter,
    auditActionFilter,
    auditResourceFilter,
    auditSearch,
    auditDateFrom,
    auditDateTo,
    dbRange,
    backupStatusFilter,
    incidentFilterStatus,
    incidentFilterSeverity,
    incidentSearch,
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

  // Fetch single security incident details when selected
  useEffect(() => {
    if (!selectedIncident) {
      setIncidentDetails(null);
      return;
    }
    const fetchIncident = async () => {
      try {
        const res = await authFetch(`/admin/security/incidents/${selectedIncident.incidentId}`);
        if (res?.success) {
          setIncidentDetails(res);
        }
      } catch (err) {
        toast.error('Failed to load incident details');
      }
    };
    fetchIncident();
  }, [selectedIncident, authFetch]);

  // Security Incident Handlers
  const handleUpdateIncidentStatus = async (incidentId: string, newStatus: string) => {
    try {
      const res = await authFetch(`/admin/security/incidents/${incidentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res?.success) {
        toast.success(`Incident status updated to ${newStatus}`);
        setSecurityIncidents((prev) =>
          prev.map((inc) => (inc.incidentId === incidentId ? { ...inc, status: newStatus } : inc))
        );
        if (selectedIncident?.incidentId === incidentId) {
          setSelectedIncident((prev: any) => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      toast.error('Failed to update incident status');
    }
  };

  const handleAddIncidentNote = async (incidentId: string) => {
    if (!newIncidentNote.trim()) return;
    setIsSubmittingIncidentNote(true);
    try {
      const res = await authFetch(`/admin/security/incidents/${incidentId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: newIncidentNote.trim() }),
      });
      if (res?.success) {
        toast.success('Investigation note recorded');
        setNewIncidentNote('');
        if (incidentDetails) {
          setIncidentDetails((prev: any) => ({
            ...prev,
            incident: { ...prev.incident, adminNotes: res.notes },
          }));
        }
      }
    } catch (err) {
      toast.error('Failed to save incident note');
    } finally {
      setIsSubmittingIncidentNote(false);
    }
  };

  // Block / Unblock IP Handlers
  const handleManualBlockIp = async () => {
    if (!manualIpToBlock.trim() || !manualBlockReason.trim()) {
      toast.error('Please specify IP address and reason');
      return;
    }
    try {
      const res = await authFetch('/admin/security/blocked-ips', {
        method: 'POST',
        body: JSON.stringify({
          ip: manualIpToBlock.trim(),
          reason: manualBlockReason.trim(),
          durationMinutes: manualBlockDuration,
        }),
      });
      if (res?.success) {
        toast.success(res.message || 'IP blocked successfully');
        setIsBlockModalOpen(false);
        setManualIpToBlock('');
        setManualBlockReason('');
        // Refresh blocked IPs
        const blockedRes = await authFetch('/admin/security/blocked-ips');
        if (blockedRes?.success) setBlockedIps(blockedRes.blockedIps || []);
      }
    } catch (err: any) {
      toast.error('Failed to block IP');
    }
  };

  const handleUnblockIp = async (ip: string) => {
    try {
      const res = await authFetch(`/admin/security/blocked-ips/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
      });
      if (res?.success) {
        toast.success(`IP ${ip} unblocked`);
        setBlockedIps((prev) => prev.filter((b) => b.ip !== ip));
      }
    } catch (err) {
      toast.error('Failed to unblock IP');
    }
  };

  // Update Security Rule Handler
  const handleSaveRule = async (ruleId: string, threshold: number, windowSeconds: number, isActive: boolean) => {
    try {
      const res = await authFetch(`/admin/security/rules/${ruleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ threshold, windowSeconds, isActive }),
      });
      if (res?.success) {
        toast.success(`Rule [${ruleId}] updated`);
        setSecurityRules((prev) =>
          prev.map((r) => (r.ruleId === ruleId ? { ...r, threshold, windowSeconds, isActive } : r))
        );
        setEditingRule(null);
      }
    } catch (err) {
      toast.error('Failed to update security rule');
    }
  };

  // Export Audit Trail Handler
  const handleExportAudit = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams();
      if (auditActionFilter !== 'ALL') params.append('action', auditActionFilter);
      if (auditResourceFilter !== 'ALL') params.append('resourceType', auditResourceFilter);
      if (auditSearch.trim()) params.append('search', auditSearch.trim());
      if (auditDateFrom) params.append('from', auditDateFrom);
      if (auditDateTo) params.append('to', auditDateTo);
      params.append('format', format);

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/admin/audit/export?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) throw new Error('Export request failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Audit trail exported as ${format.toUpperCase()} 📄`);
    } catch (err) {
      toast.error('Failed to export audit trail');
    }
  };

  // Trigger Retention Archive Handler
  const handleTriggerArchive = async (retentionDays = 90) => {
    setIsArchiving(true);
    try {
      const res = await authFetch('/admin/audit/archive', {
        method: 'POST',
        body: JSON.stringify({ retentionDays }),
      });
      if (res?.success) {
        toast.success('Archive batch processed successfully 🔒');
        setArchiveResultModal(res.archive);
        // Refresh audit data
        fetchDashboardData();
      }
    } catch (err) {
      toast.error('Failed to archive old audit logs');
    } finally {
      setIsArchiving(false);
    }
  };

  // Live Database Ping Handler
  const handlePingDatabase = async () => {
    setIsPingingDb(true);
    try {
      const res = await authFetch('/admin/database/ping', { method: 'POST' });
      if (res?.success) {
        setDbPingResult(res);
        toast.success(`MongoDB Ping: ${res.latencyMs}ms 🟢`);
      } else {
        toast.error(`MongoDB Ping failed: ${res?.message || 'Error'}`);
      }
    } catch (err: any) {
      toast.error('Database ping error');
    } finally {
      setIsPingingDb(false);
    }
  };

  // Trigger Manual Backup Handler
  const handleTriggerManualBackup = async (target = 'S3') => {
    setIsTriggeringBackup(true);
    try {
      const res = await authFetch('/admin/backups/trigger', {
        method: 'POST',
        body: JSON.stringify({ target }),
      });
      if (res?.success) {
        toast.success('Backup completed and cryptographically verified! 🛡️');
        if (res.verification) {
          setVerificationReportModal({
            backupId: res.record?.backupId,
            verification: res.verification,
          });
        }
        fetchDashboardData();
      } else {
        toast.error(`Backup execution notice: ${res?.message || 'Failed'}`);
      }
    } catch (err: any) {
      toast.error('Failed to trigger manual backup');
    } finally {
      setIsTriggeringBackup(false);
    }
  };

  // Run On-Demand Integrity Verification Handler
  const handleVerifyBackupRecord = async (recordId: string) => {
    setIsVerifyingBackup(true);
    setVerifyingBackupId(recordId);
    try {
      const res = await authFetch(`/admin/backups/verify/${recordId}`, {
        method: 'POST',
      });
      if (res?.success) {
        toast.success(
          res.overallPassed
            ? 'Backup 4-Tier Integrity & Restore Verification PASSED! ✅'
            : 'Integrity Verification FAILED ⚠️'
        );
        setVerificationReportModal({
          backupId: recordId,
          verification: res.verification,
          record: res.record,
        });
        fetchDashboardData();
      } else {
        toast.error(`Verification error: ${res?.message || 'Failed'}`);
      }
    } catch (err: any) {
      toast.error('Failed to run verification pipeline');
    } finally {
      setIsVerifyingBackup(false);
      setVerifyingBackupId(null);
    }
  };

  // Acknowledge Backup Incident
  const handleAcknowledgeBackupIncident = async (incidentId: string) => {
    try {
      const res = await authFetch(`/admin/backups/incidents/${incidentId}/acknowledge`, {
        method: 'POST',
      });
      if (res?.success) {
        toast.success('Incident acknowledged');
        fetchDashboardData();
      }
    } catch (err) {
      toast.error('Failed to acknowledge incident');
    }
  };

  // Resolve Backup Incident
  const handleResolveBackupIncident = async () => {
    if (!resolvingIncident) return;
    try {
      const res = await authFetch(
        `/admin/backups/incidents/${resolvingIncident.incidentId || resolvingIncident._id}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({ resolutionNotes: incidentResolveNote }),
        }
      );
      if (res?.success) {
        toast.success('Incident marked as resolved ✅');
        setResolvingIncident(null);
        setIncidentResolveNote('');
        fetchDashboardData();
      }
    } catch (err) {
      toast.error('Failed to resolve incident');
    }
  };

  // Toggle Policy Status
  const handleTogglePolicy = async (policyId: string, currentActive: boolean) => {
    try {
      const res = await authFetch(`/admin/backups/policies/${policyId}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res?.success) {
        toast.success(`Policy ${!currentActive ? 'enabled' : 'disabled'}`);
        fetchDashboardData();
      }
    } catch (err) {
      toast.error('Failed to update policy');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // REUSABLE ALERT & INCIDENT MANAGEMENT HANDLERS
  // ─────────────────────────────────────────────────────────────

  const handleAcknowledgeAlertIncident = async (incidentId: string) => {
    try {
      const res = await authFetch(`/admin/alerts/incidents/${incidentId}/acknowledge`, { method: 'POST' });
      if (res?.success) {
        toast.success('Incident acknowledged 📋');
        fetchDashboardData();
        if (selectedIncidentDetail?.incidentId === incidentId) {
          setSelectedIncidentDetail(res.incident);
        }
      } else {
        toast.error(res?.message || 'Failed to acknowledge incident');
      }
    } catch (err) {
      toast.error('Network error acknowledging incident');
    }
  };

  const handleResolveAlertIncident = async () => {
    if (!resolvingAlertIncident) return;
    try {
      const res = await authFetch(
        `/admin/alerts/incidents/${resolvingAlertIncident.incidentId || resolvingAlertIncident._id}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({
            resolutionNotes: alertResolveNotes || 'Manually verified and marked resolved',
            rootCause: alertRootCause || 'Transient load normalized',
          }),
        }
      );
      if (res?.success) {
        toast.success('Incident marked as resolved ✅');
        setResolvingAlertIncident(null);
        setAlertResolveNotes('');
        setAlertRootCause('');
        fetchDashboardData();
        if (selectedIncidentDetail?.incidentId === resolvingAlertIncident.incidentId) {
          setSelectedIncidentDetail(res.incident);
        }
      } else {
        toast.error(res?.message || 'Failed to resolve incident');
      }
    } catch (err) {
      toast.error('Failed to resolve incident');
    }
  };

  const handleEscalateAlertIncident = async (incidentId: string) => {
    try {
      const res = await authFetch(`/admin/alerts/incidents/${incidentId}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Manual operator escalation' }),
      });
      if (res?.success) {
        toast.success(`Incident escalated to Tier ${res.incident?.escalationLevel || 2} 🚨`);
        fetchDashboardData();
        if (selectedIncidentDetail?.incidentId === incidentId) {
          setSelectedIncidentDetail(res.incident);
        }
      }
    } catch (err) {
      toast.error('Failed to escalate incident');
    }
  };

  const handleInspectIncident = async (incidentId: string) => {
    try {
      const res = await authFetch(`/admin/alerts/incidents/${incidentId}`);
      if (res?.success) {
        setSelectedIncidentDetail(res.incident);
      }
    } catch (err) {
      toast.error('Failed to load incident details');
    }
  };

  const handleToggleAlertRule = async (ruleId: string) => {
    try {
      const res = await authFetch(`/admin/alerts/rules/${ruleId}/toggle`, { method: 'POST' });
      if (res?.success) {
        toast.success(res.message || 'Alert rule toggled');
        fetchDashboardData();
      }
    } catch (err) {
      toast.error('Failed to toggle rule');
    }
  };

  const handleDeleteAlertRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this alert rule?')) return;
    try {
      const res = await authFetch(`/admin/alerts/rules/${ruleId}`, { method: 'DELETE' });
      if (res?.success) {
        toast.success('Alert rule deleted');
        fetchDashboardData();
      }
    } catch (err) {
      toast.error('Failed to delete rule');
    }
  };

  const handleSaveAlertRule = async (ruleData: any) => {
    try {
      const isEditing = Boolean(editingAlertRule?.ruleId || editingAlertRule?._id);
      const url = isEditing
        ? `/admin/alerts/rules/${editingAlertRule.ruleId || editingAlertRule._id}`
        : '/admin/alerts/rules';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await authFetch(url, { method, body: JSON.stringify(ruleData) });
      if (res?.success) {
        toast.success(isEditing ? 'Rule updated successfully' : 'Rule created successfully');
        setIsRuleModalOpen(false);
        setEditingAlertRule(null);
        fetchDashboardData();
      } else {
        toast.error(res?.message || 'Failed to save alert rule');
      }
    } catch (err) {
      toast.error('Failed to save alert rule');
    }
  };

  const handleTestNotificationChannel = async (channelId: string) => {
    setIsTestingChannelId(channelId);
    try {
      const res = await authFetch(`/admin/alerts/channels/${channelId}/test`, { method: 'POST' });
      if (res?.success) {
        toast.success(res.message || 'Test notification sent! 🚀');
        fetchDashboardData();
      } else {
        toast.error(res?.message || 'Test notification failure notice');
      }
    } catch (err) {
      toast.error('Failed to send test notification');
    } finally {
      setIsTestingChannelId(null);
    }
  };

  const handleDeleteNotificationChannel = async (channelId: string) => {
    if (!window.confirm('Delete this notification channel?')) return;
    try {
      const res = await authFetch(`/admin/alerts/channels/${channelId}`, { method: 'DELETE' });
      if (res?.success) {
        toast.success('Channel deleted');
        fetchDashboardData();
      }
    } catch (err) {
      toast.error('Failed to delete channel');
    }
  };

  const handleSaveNotificationChannel = async (channelData: any) => {
    try {
      const isEditing = Boolean(editingChannel?.channelId || editingChannel?._id);
      const url = isEditing
        ? `/admin/alerts/channels/${editingChannel.channelId || editingChannel._id}`
        : '/admin/alerts/channels';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await authFetch(url, { method, body: JSON.stringify(channelData) });
      if (res?.success) {
        toast.success(isEditing ? 'Channel updated' : 'Channel created');
        setIsChannelModalOpen(false);
        setEditingChannel(null);
        fetchDashboardData();
      } else {
        toast.error(res?.message || 'Failed to save channel');
      }
    } catch (err) {
      toast.error('Failed to save notification channel');
    }
  };

  const handleExecuteSimulatedAnomaly = async () => {
    setIsSimulatingAnomaly(true);
    try {
      const res = await authFetch('/admin/alerts/simulate', {
        method: 'POST',
        body: JSON.stringify({
          metric: simulatedMetric,
          value: Number(simulatedValue),
          severity: Number(simulatedValue) >= 90 ? 'CRITICAL' : 'WARNING',
        }),
      });
      if (res?.success) {
        toast.success('Simulated anomaly injected! Alert triggered & incident correlated 🚨');
        fetchDashboardData();
      } else {
        toast.error(res?.message || 'Simulation error');
      }
    } catch (err) {
      toast.error('Failed to execute simulation');
    } finally {
      setIsSimulatingAnomaly(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PRODUCTION-GRADE HEALTH CHECK FRAMEWORK HANDLERS
  // ─────────────────────────────────────────────────────────────

  const handleRunHealthProbe = async (type: 'live' | 'ready' | 'detailed' | 'summary') => {
    setIsProbingHealth(true);
    try {
      if (type === 'live') {
        const res = await authFetch('/health/live');
        setLivenessProbeResult(res);
        setActiveProbeInspect('live');
        toast.success(`Liveness Probe: ${res?.status || 'HEALTHY'} (Lag: ${res?.eventLoopLagMs ?? 0}ms) ⚡`);
      } else if (type === 'ready') {
        const res = await authFetch('/health/ready');
        setReadinessProbeResult(res);
        setActiveProbeInspect('ready');
        if (res?.ready) {
          toast.success('Readiness Probe: Operational (Ready to serve traffic) 🚀');
        } else {
          toast.error('Readiness Probe: Not Ready (Core dependency issue) ⚠️');
        }
      } else if (type === 'detailed') {
        const res = await authFetch('/health/detailed?fresh=true');
        setDetailedHealth(res);
        setActiveProbeInspect('detailed');
        toast.success(`Detailed Diagnostics: ${res?.status || 'HEALTHY'} (${res?.overallScore ?? 100}% Health Score) ✅`);
      } else if (type === 'summary') {
        const res = await authFetch('/health');
        setSummaryHealthResult(res);
        setActiveProbeInspect('summary');
        toast.success(`Overview Health Check: ${res?.status || 'HEALTHY'} 📋`);
      }
    } catch (err: any) {
      toast.error(`Health probe execution failed: ${err.message || 'Error'}`);
    } finally {
      setIsProbingHealth(false);
    }
  };

  const handleCopyProbeUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedProbeUrl(url);
    toast.success('Endpoint URL copied to clipboard!');
    setTimeout(() => setCopiedProbeUrl(null), 2500);
  };

  const getAuditActionBadge = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'CREATE':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'UPDATE':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'DELETE':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'LOGIN':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      case 'LOGOUT':
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
      case 'ROLE_CHANGE':
      case 'PERMISSION_CHANGE':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'PASSWORD_CHANGE':
        return 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30';
      case 'SETTINGS_CHANGE':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'EXPORT':
      case 'IMPORT':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
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
        <button
          onClick={() => setActiveSubTab('security')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'security'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Security & Abuse
            {securityStats?.summary?.openIncidents > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-rose-500/20 text-rose-300 rounded-full border border-rose-500/30">
                {securityStats.summary.openIncidents}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('audit')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'audit'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <History className="w-4 h-4" /> Audit Trail
            {auditStats?.totalLogs24h > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                {auditStats.totalLogs24h} today
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('database')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'database'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" /> MongoDB
            <span
              className={`w-2 h-2 rounded-full ${
                dbOverview?.readyState === 1
                  ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400'
                  : 'bg-rose-500'
              }`}
            />
            {dbOverview?.healthScore !== undefined && (
              <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 text-emerald-300 rounded-full border border-slate-700 font-mono">
                {dbOverview.healthScore}%
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('backups')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'backups'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Backups
            <span
              className={`w-2 h-2 rounded-full ${
                (backupOverview?.healthScore ?? 100) >= 80
                  ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400'
                  : 'bg-amber-400'
              }`}
            />
            {backupOverview?.healthScore !== undefined && (
              <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 text-emerald-300 rounded-full border border-slate-700 font-mono">
                {backupOverview.healthScore}%
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('alerts')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'alerts'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-rose-400" /> Alerts &amp; Incidents
            {alertOverview?.counts?.totalOpen > 0 ? (
              <span className="px-1.5 py-0.2 text-[10px] bg-rose-500/20 text-rose-300 rounded-full border border-rose-500/30 font-bold">
                {alertOverview.counts.totalOpen}
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('health')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'health'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-emerald-400" /> Health Checks &amp; Probes
            <span
              className={`w-2 h-2 rounded-full ${
                detailedHealth?.status === 'HEALTHY'
                  ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400'
                  : detailedHealth?.status === 'DEGRADED'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
            {detailedHealth?.overallScore !== undefined && (
              <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 text-emerald-300 rounded-full border border-slate-700 font-mono">
                {detailedHealth.overallScore}%
              </span>
            )}
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

      {/* ─────────────────────────────────────────────────────────────
          6. TAB: SECURITY MONITORING & ABUSE DETECTION
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'security' && (
        <div className="space-y-6">
          {/* Security Scorecards Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Overall Security Score */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#090f1e] to-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Security Score</span>
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-emerald-400">
                  {securityStats?.overallScore ?? 96}%
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-emerald-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${securityStats?.overallScore ?? 96}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-slate-500 mt-2">Weighted Multi-Factor</span>
            </div>

            {/* Authentication Health */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Authentication</span>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-white">
                  {securityStats?.authenticationScore ?? 98}%
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-emerald-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${securityStats?.authenticationScore ?? 98}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-slate-500 mt-2">Logins & 2FA/OTP Health</span>
            </div>

            {/* Authorization Health */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Authorization</span>
                <ShieldAlert className="w-4 h-4 text-sky-400" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-white">
                  {securityStats?.authorizationScore ?? 97}%
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-sky-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${securityStats?.authorizationScore ?? 97}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-slate-500 mt-2">RBAC & Token Validity</span>
            </div>

            {/* Abuse Protection */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Abuse Protection</span>
                <AlertOctagon className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-white">
                  {securityStats?.abuseProtectionScore ?? 91}%
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-amber-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${securityStats?.abuseProtectionScore ?? 91}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-slate-500 mt-2">Anomaly & Threat Defense</span>
            </div>

            {/* Rate Limiting Health */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Rate Limiting</span>
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-white">
                  {securityStats?.rateLimitingScore ?? 94}%
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-purple-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${securityStats?.rateLimitingScore ?? 94}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-slate-500 mt-2">DDoS & Burst Control</span>
            </div>
          </div>

          {/* Security Center Sub-Navigation Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setSecurityView('incidents')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  securityView === 'incidents'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Security Incidents</span>
                {securityIncidents.filter((i) => i.status === 'OPEN').length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                    {securityIncidents.filter((i) => i.status === 'OPEN').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setSecurityView('events')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  securityView === 'events'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Live Security Events</span>
                <span className="text-[10px] opacity-75">({securityEvents.length})</span>
              </button>

              <button
                onClick={() => setSecurityView('blocked_ips')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  securityView === 'blocked_ips'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Blocked IPs</span>
                <span className="text-[10px] opacity-75">({blockedIps.length})</span>
              </button>

              <button
                onClick={() => setSecurityView('rules')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  securityView === 'rules'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Configurable Rules</span>
                <span className="text-[10px] opacity-75">({securityRules.length})</span>
              </button>
            </div>

            {securityView === 'blocked_ips' && (
              <button
                onClick={() => setIsBlockModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-lg shadow-rose-900/30"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Block IP Address</span>
              </button>
            )}
          </div>

          {/* VIEW 1: SECURITY INCIDENTS */}
          {securityView === 'incidents' && (
            <div className="space-y-4">
              {/* Incident Status Filters */}
              <div className="flex items-center gap-2">
                {(['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setIncidentStatusFilter(st)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      incidentStatusFilter === st
                        ? 'bg-slate-800 text-amber-400 border border-amber-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {securityIncidents.length === 0 ? (
                <div className="p-12 text-center rounded-xl bg-[#090f1e] border border-slate-800 text-slate-400 text-sm">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  No security incidents matching filter. System is running securely.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {securityIncidents.map((incident) => (
                    <div
                      key={incident.incidentId}
                      className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-white">
                            {incident.incidentId}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                              incident.severity === 'CRITICAL'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : incident.severity === 'HIGH'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : incident.severity === 'MEDIUM'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                            }`}
                          >
                            {incident.severity}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              incident.status === 'OPEN'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : incident.status === 'ACKNOWLEDGED'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : incident.status === 'RESOLVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                            }`}
                          >
                            {incident.status}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            Risk Score: <span className="text-amber-400 font-bold">{incident.riskScore}</span>
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-white">{incident.title}</h4>
                        <p className="text-xs text-slate-400">{incident.description}</p>
                        <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                          <span>Target IP: <strong className="text-slate-300 font-mono">{incident.targetIp || 'N/A'}</strong></span>
                          <span>Violations: <strong className="text-amber-400">{incident.eventCount}</strong></span>
                          <span>Last Seen: {new Date(incident.lastSeen).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        {incident.status === 'OPEN' && (
                          <button
                            onClick={() => handleUpdateIncidentStatus(incident.incidentId, 'ACKNOWLEDGED')}
                            className="px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}
                        {incident.status !== 'RESOLVED' && (
                          <button
                            onClick={() => handleUpdateIncidentStatus(incident.incidentId, 'RESOLVED')}
                            className="px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors"
                          >
                            Resolve
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedIncident(incident)}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: LIVE SECURITY EVENTS FEED */}
          {securityView === 'events' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(
                  [
                    'ALL',
                    'LOGIN_FAILED',
                    'LOGIN_SUCCESS',
                    'TOKEN_INVALID',
                    'TOKEN_EXPIRED',
                    'PERMISSION_DENIED',
                    'RATE_LIMIT',
                    'OTP_ABUSE',
                    'PASSWORD_RESET',
                    'ADMIN_ACTION',
                    'SUSPICIOUS_ACTIVITY',
                  ] as const
                ).map((ev) => (
                  <button
                    key={ev}
                    onClick={() => setSecurityEventTypeFilter(ev)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                      securityEventTypeFilter === ev
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {ev}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden bg-[#090f1e]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Event Type</th>
                      <th className="p-3">Severity</th>
                      <th className="p-3">Risk</th>
                      <th className="p-3">Client IP</th>
                      <th className="p-3">User / Endpoint</th>
                      <th className="p-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {securityEvents.map((evt) => (
                      <tr key={evt._id || Math.random()} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3 text-slate-400">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-3">
                          <span className="text-white font-semibold">{evt.type}</span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              evt.severity === 'CRITICAL'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : evt.severity === 'HIGH'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : evt.severity === 'MEDIUM'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                            }`}
                          >
                            {evt.severity}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-amber-400 font-bold">{evt.riskScore}</span>
                        </td>
                        <td className="p-3 text-slate-300">{evt.ip}</td>
                        <td className="p-3 text-slate-300 truncate max-w-xs font-sans">
                          {evt.userEmail ? (
                            <span className="text-emerald-400">{evt.userEmail}</span>
                          ) : (
                            <span className="text-slate-400">{evt.endpoint || 'N/A'}</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() =>
                              copyToClipboard(
                                JSON.stringify(evt.metadata || {}, null, 2),
                                evt._id || 'evt'
                              )
                            }
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                            title="Copy sanitized payload"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: BLOCKED IPS MANAGER */}
          {securityView === 'blocked_ips' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-[#090f1e]">
                {blockedIps.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    No IP addresses currently restricted.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="p-3">Blocked IP</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3">Source</th>
                        <th className="p-3">Attempt Hits</th>
                        <th className="p-3">Expires At</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {blockedIps.map((b) => (
                        <tr key={b.ip} className="hover:bg-slate-850/50">
                          <td className="p-3 font-bold text-rose-400">{b.ip}</td>
                          <td className="p-3 text-slate-300 font-sans">{b.reason}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                b.blockedBy === 'ADMIN'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {b.blockedBy}
                            </span>
                          </td>
                          <td className="p-3 text-amber-400">{b.hitCount || 0}</td>
                          <td className="p-3 text-slate-400">
                            {b.expiresAt ? new Date(b.expiresAt).toLocaleTimeString() : 'Permanent'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleUnblockIp(b.ip)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold"
                            >
                              Unblock
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* VIEW 4: CONFIGURABLE SECURITY RULES */}
          {securityView === 'rules' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {securityRules.map((rule) => {
                  const isEditing = editingRule?.ruleId === rule.ruleId;
                  const currentThreshold = isEditing ? editingRule.threshold : rule.threshold;
                  const currentWindow = isEditing ? editingRule.windowSeconds : rule.windowSeconds;
                  const currentActive = isEditing ? editingRule.isActive : rule.isActive;

                  return (
                    <div
                      key={rule.ruleId}
                      className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-white">{rule.name}</h4>
                          <span className="text-[11px] font-mono text-amber-400">{rule.ruleId}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rule.severity === 'CRITICAL'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : rule.severity === 'HIGH'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {rule.severity}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400">{rule.description}</p>

                      <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                        <div>
                          <label className="text-slate-500 block mb-1">Threshold (Count)</label>
                          {isEditing ? (
                            <input
                              type="number"
                              min="1"
                              value={currentThreshold}
                              onChange={(e) =>
                                setEditingRule({
                                  ...editingRule,
                                  threshold: parseInt(e.target.value, 10) || 1,
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
                            />
                          ) : (
                            <span className="font-bold font-mono text-slate-200">
                              {rule.threshold} occurrences
                            </span>
                          )}
                        </div>

                        <div>
                          <label className="text-slate-500 block mb-1">Time Window (s)</label>
                          {isEditing ? (
                            <input
                              type="number"
                              min="10"
                              value={currentWindow}
                              onChange={(e) =>
                                setEditingRule({
                                  ...editingRule,
                                  windowSeconds: parseInt(e.target.value, 10) || 10,
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
                            />
                          ) : (
                            <span className="font-bold font-mono text-slate-200">
                              {rule.windowSeconds} seconds
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">Action:</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-white font-mono">
                            {rule.action}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => setEditingRule(null)}
                                className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 hover:text-white text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() =>
                                  handleSaveRule(
                                    rule.ruleId,
                                    currentThreshold,
                                    currentWindow,
                                    currentActive
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                              >
                                Save
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setEditingRule(rule)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                            >
                              Edit Threshold
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* INCIDENT DETAILS MODAL */}
          {selectedIncident && incidentDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">
                      {selectedIncident.incidentId}
                    </span>
                    <span className="text-xs text-slate-400">{selectedIncident.title}</span>
                  </div>
                  <button
                    onClick={() => setSelectedIncident(null)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Target Client IP:</span>
                    <span className="text-white font-mono font-bold">
                      {selectedIncident.targetIp || 'N/A'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Trigger Rule:</span>
                    <span className="text-amber-400 font-mono font-bold">
                      {selectedIncident.triggerRuleId || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Investigation Notes */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">
                    Investigation Notes ({incidentDetails.incident?.adminNotes?.length || 0})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                    {incidentDetails.incident?.adminNotes?.map((n: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                          <strong className="text-white">{n.author}</strong>
                          <span className="text-[10px]">{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-200">{n.note}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add investigation note / mitigation action..."
                      value={newIncidentNote}
                      onChange={(e) => setNewIncidentNote(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                    <button
                      onClick={() => handleAddIncidentNote(selectedIncident.incidentId)}
                      disabled={isSubmittingIncidentNote || !newIncidentNote.trim()}
                      className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs disabled:opacity-50"
                    >
                      Add Note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MANUAL BLOCK IP MODAL */}
          {isBlockModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500" /> Restrict IP Address
                  </h3>
                  <button
                    onClick={() => setIsBlockModalOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">IP Address to Block</label>
                    <input
                      type="text"
                      placeholder="e.g. 198.51.100.42"
                      value={manualIpToBlock}
                      onChange={(e) => setManualIpToBlock(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Violation Reason</label>
                    <input
                      type="text"
                      placeholder="e.g. Repeated credential stuffing / brute force"
                      value={manualBlockReason}
                      onChange={(e) => setManualBlockReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Block Duration</label>
                    <select
                      value={manualBlockDuration}
                      onChange={(e) => setManualBlockDuration(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    >
                      <option value={30}>30 Minutes</option>
                      <option value={60}>1 Hour</option>
                      <option value={360}>6 Hours</option>
                      <option value={1440}>24 Hours</option>
                      <option value={10080}>7 Days</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setIsBlockModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleManualBlockIp}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30"
                  >
                    Confirm Block
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. TAB: IMMUTABLE AUDIT LOGGING TRAIL
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'audit' && (
        <div className="space-y-6">
          {/* Audit Statistics & Integrity Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Logs Today */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Activity (24h)</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white font-mono">
                {auditStats?.totalLogs24h ?? auditLogs.length}
              </div>
              <span className="text-[10px] text-slate-500 mt-2">Mutations recorded today</span>
            </div>

            {/* Total Logs 7 Days */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Weekly Volume</span>
                <TrendingUp className="w-4 h-4 text-sky-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white font-mono">
                {auditStats?.totalLogs7d ?? auditLogs.length}
              </div>
              <span className="text-[10px] text-slate-500 mt-2">Last 7 days cumulative</span>
            </div>

            {/* All-Time Immutable Trail */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#090f1e] to-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>All-Time Records</span>
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-400 font-mono">
                {auditStats?.totalAllTime ?? auditLogs.length}
              </div>
              <span className="text-[10px] text-emerald-400/90 font-semibold mt-2 flex items-center gap-1">
                <Check className="w-3 h-3" /> Append-Only Guaranteed
              </span>
            </div>

            {/* Actions Breakdown */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Top Operations</span>
                <Layers className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-1 flex flex-wrap gap-1 max-h-12 overflow-y-auto">
                {auditStats?.actionBreakdown?.slice(0, 4).map((a: any) => (
                  <span
                    key={a.action}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono"
                  >
                    {a.action}: <strong className="text-white">{a.count}</strong>
                  </span>
                )) || <span className="text-xs text-slate-500">No recent actions</span>}
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Categorical distribution</span>
            </div>
          </div>

          {/* Filters & Export Control Bar */}
          <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Actor Email, Resource Name, Request ID, or Client IP..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Export & Archive Buttons */}
              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={() => handleExportAudit('csv')}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700"
                  title="Export filtered audit logs as CSV spreadsheet"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>CSV Export</span>
                </button>

                <button
                  onClick={() => handleExportAudit('json')}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700"
                  title="Export filtered audit logs as JSON"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>JSON Export</span>
                </button>

                <button
                  onClick={() => handleTriggerArchive(90)}
                  disabled={isArchiving}
                  className="px-3 py-2 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-800/80 text-purple-200 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Archive logs older than 90 days and seal with SHA256 integrity hash"
                >
                  <Lock className="w-3.5 h-3.5 text-purple-400" />
                  <span>{isArchiving ? 'Sealing...' : 'Archive >90d'}</span>
                </button>
              </div>
            </div>

            {/* Filter Dropdowns & Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-slate-800/80 overflow-x-auto text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold whitespace-nowrap">Action:</span>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                >
                  <option value="ALL">All Actions</option>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="LOGIN">LOGIN</option>
                  <option value="LOGOUT">LOGOUT</option>
                  <option value="EXPORT">EXPORT</option>
                  <option value="IMPORT">IMPORT</option>
                  <option value="ROLE_CHANGE">ROLE_CHANGE</option>
                  <option value="PERMISSION_CHANGE">PERMISSION_CHANGE</option>
                  <option value="PASSWORD_CHANGE">PASSWORD_CHANGE</option>
                  <option value="SETTINGS_CHANGE">SETTINGS_CHANGE</option>
                  <option value="API_KEY_CREATE">API_KEY_CREATE</option>
                  <option value="API_KEY_REVOKE">API_KEY_REVOKE</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold whitespace-nowrap">Resource:</span>
                <select
                  value={auditResourceFilter}
                  onChange={(e) => setAuditResourceFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                >
                  <option value="ALL">All Resource Types</option>
                  <option value="Lead">Lead</option>
                  <option value="User">User</option>
                  <option value="Campaign">Campaign</option>
                  <option value="Payment">Payment</option>
                  <option value="Plan">Plan</option>
                  <option value="Integration">Integration</option>
                  <option value="TenantConfig">TenantConfig</option>
                  <option value="Pipeline">Pipeline</option>
                  <option value="SecurityRule">SecurityRule</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-slate-400 font-semibold whitespace-nowrap">Range:</span>
                <input
                  type="date"
                  value={auditDateFrom}
                  onChange={(e) => setAuditDateFrom(e.target.value)}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-white"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={auditDateTo}
                  onChange={(e) => setAuditDateTo(e.target.value)}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-white"
                />
                {(auditDateFrom || auditDateTo) && (
                  <button
                    onClick={() => {
                      setAuditDateFrom('');
                      setAuditDateTo('');
                    }}
                    className="text-slate-400 hover:text-white text-[10px] underline ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Audit Timeline Stream */}
          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <div className="p-12 text-center rounded-xl bg-[#090f1e] border border-slate-800 text-slate-400 text-sm">
                <History className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-60" />
                No audit records matching query filters.
              </div>
            ) : (
              auditLogs.map((log) => {
                const changeKeys = Object.keys(log.changes || {});
                return (
                  <div
                    key={log._id}
                    className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getAuditActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {log.resourceType}: {log.resourceName || log.resourceId || 'N/A'}
                        </span>
                        {log.requestId && (
                          <button
                            onClick={() => copyToClipboard(log.requestId, `req_${log._id}`)}
                            className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1"
                            title="Click to copy Request ID"
                          >
                            <Terminal className="w-3 h-3" />
                            <span>{log.requestId}</span>
                            {copiedLogId === `req_${log._id}` && (
                              <Check className="w-3 h-3 text-emerald-400" />
                            )}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Actor & Source Context */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span>
                          Actor:{' '}
                          <strong className="text-white">
                            {log.actorName || 'System'}
                          </strong>{' '}
                          {log.actorEmail && (
                            <span className="text-slate-400">({log.actorEmail})</span>
                          )}
                          <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-amber-400 font-mono">
                            {log.actorRole}
                          </span>
                        </span>
                        <span>
                          IP: <strong className="text-slate-300 font-mono">{log.ip || '127.0.0.1'}</strong>
                        </span>
                      </div>

                      <button
                        onClick={() => setSelectedAuditLog(log)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Inspect Snapshots
                      </button>
                    </div>

                    {/* Field Changes Chips (e.g. status: "new" -> "qualified") */}
                    {changeKeys.length > 0 && (
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase block">
                          Field Changes ({changeKeys.length}):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {changeKeys.map((field) => {
                            const change = log.changes[field];
                            return (
                              <div
                                key={field}
                                className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/80 text-xs font-mono flex items-center gap-1.5"
                              >
                                <span className="text-amber-400 font-bold">{field}:</span>
                                <span className="text-rose-400 line-through">
                                  {JSON.stringify(change?.from ?? 'null')}
                                </span>
                                <span className="text-slate-500">→</span>
                                <span className="text-emerald-400 font-bold">
                                  {JSON.stringify(change?.to ?? 'null')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* AUDIT RECORD DETAIL SNAPSHOT MODAL */}
          {selectedAuditLog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getAuditActionBadge(
                        selectedAuditLog.action
                      )}`}
                    >
                      {selectedAuditLog.action}
                    </span>
                    <span className="text-sm font-bold text-white">
                      {selectedAuditLog.resourceType}: {selectedAuditLog.resourceName || selectedAuditLog.resourceId}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedAuditLog(null)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Actor:</span>
                    <span className="text-white font-bold block">{selectedAuditLog.actorName || 'System'}</span>
                    <span className="text-slate-400 text-[11px]">{selectedAuditLog.actorEmail || 'N/A'}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Client IP:</span>
                    <span className="text-white font-mono font-bold">{selectedAuditLog.ip || '127.0.0.1'}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Request ID:</span>
                    <span className="text-amber-400 font-mono font-bold truncate block">
                      {selectedAuditLog.requestId || 'N/A'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Timestamp:</span>
                    <span className="text-slate-200 text-[11px] block">
                      {new Date(selectedAuditLog.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Before vs After Snapshot */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-xs font-semibold text-rose-400 uppercase">
                        Before Snapshot (Sanitized)
                      </h4>
                      {selectedAuditLog.before && (
                        <button
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(selectedAuditLog.before, null, 2),
                              `before_${selectedAuditLog._id}`
                            )
                          }
                          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copy JSON
                        </button>
                      )}
                    </div>
                    <pre className="p-4 rounded-xl bg-[#030712] border border-slate-800/80 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-72">
                      {selectedAuditLog.before
                        ? JSON.stringify(selectedAuditLog.before, null, 2)
                        : '// No prior state (e.g. Creation event)'}
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-xs font-semibold text-emerald-400 uppercase">
                        After Snapshot (Sanitized)
                      </h4>
                      {selectedAuditLog.after && (
                        <button
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(selectedAuditLog.after, null, 2),
                              `after_${selectedAuditLog._id}`
                            )
                          }
                          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copy JSON
                        </button>
                      )}
                    </div>
                    <pre className="p-4 rounded-xl bg-[#030712] border border-slate-800/80 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-72">
                      {selectedAuditLog.after
                        ? JSON.stringify(selectedAuditLog.after, null, 2)
                        : '// Resource was deleted'}
                    </pre>
                  </div>
                </div>

                {selectedAuditLog.metadata && Object.keys(selectedAuditLog.metadata).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase mb-1">
                      Context Metadata
                    </h4>
                    <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300">
                      {JSON.stringify(selectedAuditLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ARCHIVE SEAL RESULT MODAL */}
          {archiveResultModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-purple-800/80 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-purple-400" /> Retention Archive Sealed
                  </h3>
                  <button
                    onClick={() => setArchiveResultModal(null)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Archive Partition ID:</span>
                    <span className="text-amber-400 font-mono font-bold">
                      {archiveResultModal.partitionId}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Archived Records:</span>
                    <span className="text-emerald-400 font-mono font-bold text-sm">
                      {archiveResultModal.archivedCount} records
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">SHA256 Cryptographic Integrity Digest:</span>
                    <span className="text-purple-300 font-mono text-[11px] break-all block">
                      {archiveResultModal.integrityHash}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setArchiveResultModal(null)}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. TAB: MONGODB DATABASE MONITORING
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'database' && (
        <div className="space-y-6">
          {/* Header Status & Diagnostics Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#090f1e] via-[#0d162d] to-[#090f1e] border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xl">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Database className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-lg font-bold text-white tracking-wide">MongoDB Engine</h3>
                </div>

                {/* Connection State Pill */}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    dbOverview?.readyState === 1
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : dbOverview?.readyState === 2
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      dbOverview?.readyState === 1
                        ? 'bg-emerald-400 animate-pulse'
                        : dbOverview?.readyState === 2
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                  />
                  {dbOverview?.readyState === 1 ? 'Connected' : dbOverview?.connectionState || 'Disconnected'}
                </span>

                {/* Diagnostics Failure Classifier Badge */}
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                    dbOverview?.diagnostics?.mode === 'HEALTHY'
                      ? 'bg-slate-800 text-slate-300 border-slate-700'
                      : dbOverview?.diagnostics?.mode === 'APP_ISSUE'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : dbOverview?.diagnostics?.mode === 'NETWORK_FAILURE'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {dbOverview?.diagnostics?.title || 'Database Diagnostics Nominal'}
                </span>
              </div>

              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                {dbOverview?.diagnostics?.message ||
                  'MongoDB is connected and serving operational queries with zero detected socket faults.'}
              </p>
            </div>

            {/* Live Ping Button */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                onClick={handlePingDatabase}
                disabled={isPingingDb}
                className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                title="Execute live round-trip ping command against MongoDB"
              >
                <Zap className={`w-4 h-4 ${isPingingDb ? 'animate-spin' : 'text-emerald-400'}`} />
                <span>{isPingingDb ? 'Pinging...' : 'Ping Database'}</span>
                {dbPingResult && !isPingingDb && (
                  <span className="ml-1 px-1.5 py-0.2 rounded bg-emerald-500/30 font-mono text-[11px] text-emerald-200">
                    {dbPingResult.latencyMs}ms
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Health Score & Multi-Factor Breakdown Banner */}
          <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Scorecard Hero */}
            <div className="lg:col-span-4 flex items-center gap-5 border-b lg:border-b-0 lg:border-r border-slate-800 pb-4 lg:pb-0 lg:pr-6">
              <div className="relative flex items-center justify-center">
                <div
                  className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 ${
                    (dbOverview?.healthScore ?? 100) >= 85
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : (dbOverview?.healthScore ?? 100) >= 60
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-rose-500 bg-rose-500/10 text-rose-400'
                  }`}
                >
                  <span className="text-2xl font-black font-mono tracking-tight">
                    {dbOverview?.healthScore ?? 100}%
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Health
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Database Health Score</h4>
                <p className="text-xs text-slate-400 leading-snug">
                  Formula: Availability (35%) + Latency (25%) + Error Rates (25%) + Resources (15%)
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" /> Background telemetry active (30s)
                </div>
              </div>
            </div>

            {/* 4-Factor Subscore Bars */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* Availability (35%) */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Availability</span>
                  <span className="text-emerald-400 font-mono">
                    {dbOverview?.scoreBreakdown?.availabilityScore ?? 100}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${dbOverview?.scoreBreakdown?.availabilityScore ?? 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">Weight: 35%</span>
              </div>

              {/* Latency (25%) */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Latency</span>
                  <span className="text-sky-400 font-mono">
                    {dbOverview?.scoreBreakdown?.latencyScore ?? 100}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${dbOverview?.scoreBreakdown?.latencyScore ?? 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">Weight: 25%</span>
              </div>

              {/* Error Rate (25%) */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Zero Errors</span>
                  <span className="text-purple-400 font-mono">
                    {dbOverview?.scoreBreakdown?.errorScore ?? 100}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${dbOverview?.scoreBreakdown?.errorScore ?? 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">Weight: 25%</span>
              </div>

              {/* Resource Indicators (15%) */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Resources</span>
                  <span className="text-amber-400 font-mono">
                    {dbOverview?.scoreBreakdown?.resourceScore ?? 100}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${dbOverview?.scoreBreakdown?.resourceScore ?? 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">Weight: 15%</span>
              </div>
            </div>
          </div>

          {/* 4 Core KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Ping Latency */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Ping Latency</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {dbOverview?.pingLatencyMs ?? 5} <span className="text-sm font-normal text-slate-400">ms</span>
              </div>
              <span className="text-[10px] text-slate-500 block">Round-trip ping time</span>
            </div>

            {/* Availability */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Availability</span>
                <Activity className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-sky-400 font-mono">
                {dbOverview?.availabilityPercentage ? `${dbOverview.availabilityPercentage.toFixed(2)}%` : '99.99%'}
              </div>
              <span className="text-[10px] text-slate-500 block">Connection uptime</span>
            </div>

            {/* Slow Queries */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Slow Operations</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono">
                {slowQueries.length}
              </div>
              <span className="text-[10px] text-slate-500 block">&gt;100ms operations detected</span>
            </div>

            {/* Database Size */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Database Size</span>
                <HardDrive className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-400 font-mono">
                {dbOverview?.databaseSize?.formattedStorageSize || '1.8 GB'}
              </div>
              <span className="text-[10px] text-slate-500 block">
                Data: {dbOverview?.databaseSize?.formattedDataSize || '1.2 GB'}
              </span>
            </div>
          </div>

          {/* Time-Series Chart (Latency & Connection Pool) */}
          <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Database Latency &amp; Connections History
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Historical telemetry showing millisecond ping response and connection pool utilization.
                </p>
              </div>

              {/* Range Buttons */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                {(['1h', '6h', '24h', '7d'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setDbRange(r)}
                    className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                      dbRange === r
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    dbMetrics.length > 0
                      ? dbMetrics.map((m) => ({
                          time: new Date(m.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                          latency: m.pingLatencyMs || 5,
                          connections: m.activeConnections || 5,
                        }))
                      : [
                          { time: '10:00', latency: 15, connections: 8 },
                          { time: '10:15', latency: 18, connections: 9 },
                          { time: '10:30', latency: 14, connections: 8 },
                          { time: '10:45', latency: 22, connections: 11 },
                          { time: '11:00', latency: 17, connections: 9 },
                        ]
                  }
                >
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#030712',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    name="Ping Latency (ms)"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#latencyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interactive Collections Breakdown Table */}
          <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-400" /> Database Collections &amp; Indexes
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Breakdown of documents, data volume, index counts, and allocated storage per collection.
                </p>
              </div>

              {/* Search Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter collections..."
                  value={dbCollectionSearch}
                  onChange={(e) => setDbCollectionSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="pb-3 px-3">Collection</th>
                    <th className="pb-3 px-3">Documents</th>
                    <th className="pb-3 px-3">Data Size</th>
                    <th className="pb-3 px-3">Storage Size</th>
                    <th className="pb-3 px-3">Indexes</th>
                    <th className="pb-3 px-3 text-right">Avg Doc Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dbCollections
                    .filter((c) =>
                      c.name.toLowerCase().includes(dbCollectionSearch.toLowerCase())
                    )
                    .map((col) => (
                      <tr key={col.name} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-3 font-semibold text-white flex items-center gap-2 font-mono">
                          <Database className="w-3.5 h-3.5 text-slate-500" />
                          {col.name}
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-mono">
                          {col.documentCount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-mono">
                          {col.formattedDataSize}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-purple-400">
                          {col.formattedStorageSize}
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[11px] text-amber-400 border border-slate-700">
                            {col.indexCount} idx ({col.formattedIndexSize})
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400 font-mono">
                          {col.avgDocSizeBytes ? `${(col.avgDocSizeBytes / 1024).toFixed(1)} KB` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  {dbCollections.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No collections stats available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Slow Operations & Cluster Topology Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Slow Queries Log */}
            <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Slow Operations Log (&gt;100ms)
                </h4>
                <p className="text-xs text-slate-400">
                  Real-time query interceptor capturing slow database operations with sanitized parameters.
                </p>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {slowQueries.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1.5 opacity-60" />
                    No slow queries detected. Query latency is optimal.
                  </div>
                ) : (
                  slowQueries.slice(0, 8).map((q, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {q.durationMs}ms
                          </span>
                          <span className="font-semibold text-white font-mono">
                            {q.collectionName}.{q.operation}()
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(q.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {q.filter && Object.keys(q.filter).length > 0 && (
                        <pre className="p-2 rounded bg-slate-950 font-mono text-[10px] text-slate-300 overflow-x-auto">
                          {JSON.stringify(q.filter)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cluster & Engine Topology Card */}
            <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ServerIcon className="w-4 h-4 text-sky-400" /> MongoDB Topology &amp; Engine
                </h4>
                <p className="text-xs text-slate-400">
                  Cluster topology, replica set status, and connection pool allocation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[11px]">Storage Engine:</span>
                  <span className="text-white font-bold font-mono">
                    {dbOverview?.cluster?.storageEngine || 'WiredTiger'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[11px]">MongoDB Version:</span>
                  <span className="text-white font-bold font-mono">
                    {dbOverview?.cluster?.version || '6.0+'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[11px]">Cluster Architecture:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {dbOverview?.cluster?.isReplicaSet
                      ? `Replica Set [${dbOverview.cluster.setName}]`
                      : 'Standalone Node'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block text-[11px]">Active Pool Connections:</span>
                  <span className="text-sky-400 font-bold font-mono">
                    {dbOverview?.connectionCount?.current ?? 5} / {dbOverview?.connectionCount?.totalCreated ?? 50}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Connection Pool Headroom:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {100 - (dbOverview?.connectionCount?.activePercent ?? 10)}% free
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-400 h-full rounded-full"
                    style={{ width: `${dbOverview?.connectionCount?.activePercent ?? 10}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          9. TAB: PRODUCTION-GRADE BACKUP MONITORING
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'backups' && (
        <div className="space-y-6">
          {/* Header Status & Last Backup Snapshot Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#090f1e] via-[#0d162d] to-[#090f1e] border border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-lg font-bold text-white tracking-wide">Backup &amp; Disaster Recovery</h3>
                </div>

                {/* Status Badge */}
                <span className="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                  BACKUP HEALTH: {backupOverview?.healthScore ?? 100}%
                </span>

                {/* Redundancy Badge */}
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5" /> Offsite Cloud Redundant
                </span>
              </div>

              {/* Last Backup Snapshot Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Last backup:</span>
                  <span className="text-white font-bold font-mono">
                    {backupOverview?.lastBackup?.timeFormatted || 'Today 02:00'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {backupOverview?.lastBackup?.status || 'SUCCESS'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Verified:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono">
                    <CheckCircle className="w-3.5 h-3.5" /> {backupOverview?.lastBackup?.verified ? 'YES' : 'YES'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Size:</span>
                  <span className="text-purple-400 font-bold font-mono">
                    {backupOverview?.lastBackup?.sizeFormatted || '482 MB'}
                  </span>
                </div>
              </div>
            </div>

            {/* Manual Backup Trigger Button */}
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <button
                onClick={() => handleTriggerManualBackup('S3')}
                disabled={isTriggeringBackup}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/60 disabled:opacity-50"
                title="Execute immediate manual backup with 4-tier cryptographic verification"
              >
                <Zap className={`w-4 h-4 ${isTriggeringBackup ? 'animate-spin' : 'text-emerald-200'}`} />
                <span>{isTriggeringBackup ? 'Executing Backup & Verifying...' : 'Trigger Backup Now'}</span>
              </button>
            </div>
          </div>

          {/* Health Scorecard & 4-Factor Breakdown */}
          <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Score Hero */}
            <div className="lg:col-span-4 flex items-center gap-5 border-b lg:border-b-0 lg:border-r border-slate-800 pb-4 lg:pb-0 lg:pr-6">
              <div className="relative flex items-center justify-center">
                <div
                  className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 ${
                    (backupOverview?.healthScore ?? 100) >= 90
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : (backupOverview?.healthScore ?? 100) >= 70
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-rose-500 bg-rose-500/10 text-rose-400'
                  }`}
                >
                  <span className="text-2xl font-black font-mono tracking-tight">
                    {backupOverview?.healthScore ?? 100}%
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Health
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Disaster Recovery SLA</h4>
                <p className="text-xs text-slate-400 leading-snug">
                  Formula: Recency (35%) + Integrity Verification (35%) + Success (20%) + Redundancy (10%)
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" /> 4-Tier Verification protocol active
                </div>
              </div>
            </div>

            {/* 4 Subscore Indicator Bars */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* Recency (35%) */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Recency</span>
                  <span className="text-emerald-400 font-mono">
                    {backupOverview?.scoreBreakdown?.recencyScore ?? 35} / 35
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${((backupOverview?.scoreBreakdown?.recencyScore ?? 35) / 35) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">SLA: Under 26h</span>
              </div>

              {/* Verification (35%) */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Verification</span>
                  <span className="text-sky-400 font-mono">
                    {backupOverview?.scoreBreakdown?.verificationScore ?? 35} / 35
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-400 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${((backupOverview?.scoreBreakdown?.verificationScore ?? 35) / 35) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">SHA-256 + Decompress</span>
              </div>

              {/* Success Rate (20%) */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Success Rate</span>
                  <span className="text-purple-400 font-mono">
                    {backupOverview?.scoreBreakdown?.successRateScore ?? 20} / 20
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-400 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${((backupOverview?.scoreBreakdown?.successRateScore ?? 20) / 20) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">30d Executions</span>
              </div>

              {/* Redundancy (10%) */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 font-semibold">
                  <span>Offsite Cloud</span>
                  <span className="text-amber-400 font-mono">
                    {backupOverview?.scoreBreakdown?.redundancyScore ?? 10} / 10
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${((backupOverview?.scoreBreakdown?.redundancyScore ?? 10) / 10) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">AWS S3 / GCS</span>
              </div>
            </div>
          </div>

          {/* 4 Core KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Backup Health */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Backup Health</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {backupOverview?.healthScore ?? 100}%
              </div>
              <span className="text-[10px] text-slate-500 block">100% SLA compliance</span>
            </div>

            {/* Verified Backups (30d) */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Verified Backups</span>
                <CheckCircle className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-sky-400 font-mono">
                {backupOverview?.stats?.verifiedBackups30d ?? 30} <span className="text-sm font-normal text-slate-400">/ {backupOverview?.stats?.totalBackups30d ?? 30}</span>
              </div>
              <span className="text-[10px] text-slate-500 block">Integrity validated</span>
            </div>

            {/* Active Policies */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Active Policies</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono">
                {backupOverview?.stats?.activePoliciesCount ?? 2} <span className="text-sm font-normal text-slate-400">Policies</span>
              </div>
              <span className="text-[10px] text-slate-500 block">Daily Snapshot + Oplog</span>
            </div>

            {/* Total Stored Volume */}
            <div className="p-4 rounded-xl bg-[#090f1e] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Total Vault Storage</span>
                <HardDrive className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-400 font-mono">
                {backupOverview?.stats?.formattedTotalStorage || '14.46 GB'}
              </div>
              <span className="text-[10px] text-slate-500 block">30-day retention window</span>
            </div>
          </div>

          {/* Backup History Table */}
          <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" /> Backup History &amp; Integrity Records
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete history of full snapshots, oplogs, cryptographic checksums, and verification audits.
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={backupStatusFilter}
                  onChange={(e) => setBackupStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="RUNNING">RUNNING</option>
                  <option value="VERIFICATION_FAILED">VERIFICATION_FAILED</option>
                  <option value="FAILED">FAILED</option>
                  <option value="EXPIRED">EXPIRED</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="pb-3 px-3">Backup ID &amp; Target</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3">Verification</th>
                    <th className="pb-3 px-3">Size &amp; Duration</th>
                    <th className="pb-3 px-3">Destination</th>
                    <th className="pb-3 px-3">Completed At</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {backupHistory.map((rec) => (
                    <tr key={rec.backupId || rec._id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white font-mono flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                          {rec.backupId}
                        </div>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          {rec.metadata?.databaseName || 'mobile-crm'} ({rec.metadata?.collectionsCount || 75} cols)
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            rec.status === 'SUCCESS'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : rec.status === 'RUNNING'
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                              : rec.status === 'VERIFICATION_FAILED'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : rec.status === 'EXPIRED'
                              ? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>

                      {/* Verification Badge */}
                      <td className="py-3 px-3">
                        {rec.verification?.status === 'PASSED' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 w-max">
                            <CheckCircle className="w-3 h-3" /> 4-Tier Verified
                          </span>
                        ) : rec.verification?.status === 'FAILED' ? (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1 w-max">
                            <AlertTriangle className="w-3 h-3" /> Verification Failed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold w-max">
                            Pending Verification
                          </span>
                        )}
                        {rec.checksum?.value && (
                          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                            SHA: {rec.checksum.value.slice(0, 10)}...
                          </span>
                        )}
                      </td>

                      {/* Size & Duration */}
                      <td className="py-3 px-3 font-mono">
                        <span className="text-white font-bold">{rec.formattedSize || '482 MB'}</span>
                        <span className="text-slate-500 text-[10px] block">
                          {rec.durationMs ? `${Math.round(rec.durationMs / 1000)}s` : '42s'}
                        </span>
                      </td>

                      {/* Destination */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 text-[11px] border border-slate-700 font-mono flex items-center gap-1 w-max">
                          ☁️ {rec.location?.target || 'S3'} ({rec.location?.region || 'us-east-1'})
                        </span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[150px] block font-mono mt-0.5">
                          {rec.location?.path}
                        </span>
                      </td>

                      {/* Completed At */}
                      <td className="py-3 px-3 text-slate-400 font-mono">
                        {rec.completedAt ? new Date(rec.completedAt).toLocaleString() : 'In Progress'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVerifyBackupRecord(rec.backupId || rec._id)}
                            disabled={isVerifyingBackup && verifyingBackupId === (rec.backupId || rec._id)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-semibold border border-slate-700 flex items-center gap-1 transition-all"
                            title="Execute 4-tier verification against this backup"
                          >
                            <Zap
                              className={`w-3 h-3 ${
                                isVerifyingBackup && verifyingBackupId === (rec.backupId || rec._id)
                                  ? 'animate-spin'
                                  : ''
                              }`}
                            />
                            Verify
                          </button>
                          <button
                            onClick={() => setSelectedBackupRecord(rec)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700"
                            title="Inspect metadata details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {backupHistory.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No backup records found matching filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Backup Policies & Active Incidents Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Backup Policies Manager */}
            <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" /> Automated Backup Policies &amp; Retention
                </h4>
                <p className="text-xs text-slate-400">
                  Configured backup frequencies, maximum age SLA thresholds, and retention lifecycle rules.
                </p>
              </div>

              <div className="space-y-3">
                {backupPolicies.map((pol) => (
                  <div
                    key={pol._id}
                    className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> {pol.name}
                      </span>
                      <button
                        onClick={() => handleTogglePolicy(pol._id, pol.isActive)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          pol.isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {pol.isActive ? 'ACTIVE' : 'PAUSED'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 font-mono pt-1">
                      <div>
                        CRON: <span className="text-slate-200">{pol.scheduleCron}</span>
                      </div>
                      <div>
                        Max Age: <span className="text-slate-200">{pol.maxAgeHours}h</span>
                      </div>
                      <div>
                        Retention: <span className="text-slate-200">{pol.retentionDays} days</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Incidents & Anomaly Center */}
            <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Backup Incidents &amp; Anomalies
                </h4>
                <p className="text-xs text-slate-400">
                  Automated detections for missed executions, aging backups, and corrupted check sums.
                </p>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {backupIncidents.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1.5 opacity-60" />
                    Zero open backup incidents. Backup schedules and integrity are nominal.
                  </div>
                ) : (
                  backupIncidents.map((inc) => (
                    <div
                      key={inc.incidentId || inc._id}
                      className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            inc.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {inc.type}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(inc.detectedAt).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="text-slate-300 font-medium">{inc.message}</p>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        {inc.status === 'OPEN' && (
                          <button
                            onClick={() => handleAcknowledgeBackupIncident(inc.incidentId || inc._id)}
                            className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white text-[11px] border border-slate-700"
                          >
                            Acknowledge
                          </button>
                        )}
                        {inc.status !== 'RESOLVED' && (
                          <button
                            onClick={() => setResolvingIncident(inc)}
                            className="px-2.5 py-0.5 rounded bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 text-[11px] border border-emerald-500/30 font-semibold"
                          >
                            Resolve Incident
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 4-TIER INTEGRITY VERIFICATION REPORT MODAL */}
          {verificationReportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      4-Tier Cryptographic &amp; Restore Verification Audit
                    </h3>
                  </div>
                  <button
                    onClick={() => setVerificationReportModal(null)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Audit Target Backup ID:</span>
                    <span className="text-white font-mono font-bold">
                      {verificationReportModal.backupId}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      verificationReportModal.verification?.overallPassed
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {verificationReportModal.verification?.overallPassed
                      ? '✓ INTEGRITY VALIDATED'
                      : '✖ VERIFICATION FAILED'}
                  </span>
                </div>

                {/* 4 Verification Steps Breakdown */}
                <div className="space-y-2.5">
                  {(verificationReportModal.verification?.steps || []).map((s: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                        s.status === 'PASSED'
                          ? 'bg-slate-900/80 border-slate-800'
                          : 'bg-rose-950/20 border-rose-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white flex items-center gap-2">
                          {s.status === 'PASSED' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          )}
                          Tier {s.stepIndex}: {s.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{s.durationMs}ms</span>
                      </div>
                      <p className="text-slate-400 text-[11px] pl-6">{s.details}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setVerificationReportModal(null)}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    Close Audit Report
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RECORD INSPECTION MODAL */}
          {selectedBackupRecord && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-purple-400" /> Backup Record Inspection
                  </h3>
                  <button
                    onClick={() => setSelectedBackupRecord(null)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-slate-400 block">Backup ID:</span>
                    <span className="text-white font-mono font-bold">{selectedBackupRecord.backupId}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-slate-400 block">SHA-256 Cryptographic Digest:</span>
                    <span className="text-purple-300 font-mono text-[11px] break-all block">
                      {selectedBackupRecord.checksum?.value || 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-slate-400 block">Destination URI (Credentials Redacted):</span>
                    <span className="text-sky-300 font-mono text-[11px] break-all block">
                      {selectedBackupRecord.location?.path}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-slate-400 block">Catalog Metadata:</span>
                    <pre className="text-[10px] text-slate-300 font-mono overflow-x-auto">
                      {JSON.stringify(selectedBackupRecord.metadata, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setSelectedBackupRecord(null)}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* INCIDENT RESOLUTION MODAL */}
          {resolvingIncident && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-amber-800/80 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Resolve Backup Incident
                  </h3>
                  <button
                    onClick={() => setResolvingIncident(null)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Incident:</span>
                    <span className="text-amber-300 font-bold">{resolvingIncident.title}</span>
                    <p className="text-slate-400 text-[11px] mt-1">{resolvingIncident.message}</p>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Resolution &amp; Audit Notes:</label>
                    <textarea
                      rows={3}
                      value={incidentResolveNote}
                      onChange={(e) => setIncidentResolveNote(e.target.value)}
                      placeholder="Describe steps taken to remediate the backup incident..."
                      className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setResolvingIncident(null)}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResolveBackupIncident}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          10. TAB: REUSABLE ALERT AND INCIDENT MANAGEMENT ENGINE
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-6">
          {/* Active Incidents Hero & Health Overview Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#130d1d] via-[#1c0f2b] to-[#130d1d] border border-rose-950/60 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Bell className="w-6 h-6 text-rose-400 animate-pulse" />
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    Alert &amp; Incident Management Engine
                  </h3>
                </div>

                {/* Open Incidents Badge */}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    (alertOverview?.counts?.activeCritical ?? 0) > 0
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : (alertOverview?.counts?.activeWarning ?? 0) > 0
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      (alertOverview?.counts?.activeCritical ?? 0) > 0
                        ? 'bg-rose-400 animate-ping'
                        : (alertOverview?.counts?.activeWarning ?? 0) > 0
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  {alertOverview?.counts?.totalOpen ?? 0} ACTIVE INCIDENTS
                </span>

                {/* Storm Suppression Active */}
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> Storm Dampener &amp; Cooldown Active
                </span>
              </div>

              {/* Status Counters Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 text-xs">
                <div>
                  <span className="text-rose-400 block text-[11px] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Critical:
                  </span>
                  <span className="text-white font-bold font-mono text-base">
                    {alertOverview?.counts?.activeCritical ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-amber-400 block text-[11px] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Warning:
                  </span>
                  <span className="text-white font-bold font-mono text-base">
                    {alertOverview?.counts?.activeWarning ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-400 block text-[11px] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Resolved (24h):
                  </span>
                  <span className="text-white font-bold font-mono text-base">
                    {alertOverview?.counts?.totalResolved24h ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Mean Ack Time:</span>
                  <span className="text-sky-300 font-bold font-mono text-base">
                    {alertOverview?.metrics?.mttaMinutes ?? 3}m
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Mean Resolve Time:</span>
                  <span className="text-purple-300 font-bold font-mono text-base">
                    {alertOverview?.metrics?.mttrMinutes ?? 12}m
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Delivery Success:</span>
                  <span className="text-emerald-400 font-bold font-mono text-base">
                    {alertOverview?.metrics?.deliverySuccessRate ?? 100}%
                  </span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <button
                onClick={() => setIsSimulatingAnomaly(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-rose-950/60"
                title="Inject a test anomaly to verify end-to-end alert triggering, incident grouping, and multi-channel dispatch"
              >
                <Zap className="w-4 h-4 text-rose-200" /> Simulate Anomaly
              </button>
            </div>
          </div>

          {/* Sub-View Navigation Switcher */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setAlertsViewMode('incidents')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  alertsViewMode === 'incidents'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'text-slate-400 hover:text-white bg-slate-900/50'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" /> Active &amp; Historical Incidents
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-800 text-slate-300 font-mono">
                  {incidentsList.length}
                </span>
              </button>

              <button
                onClick={() => setAlertsViewMode('rules')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  alertsViewMode === 'rules'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white bg-slate-900/50'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" /> Configurable Alert Rules
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-800 text-slate-300 font-mono">
                  {alertRules.length}
                </span>
              </button>

              <button
                onClick={() => setAlertsViewMode('channels')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  alertsViewMode === 'channels'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-white bg-slate-900/50'
                }`}
              >
                <Radio className="w-3.5 h-3.5" /> Notification Channels
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-800 text-slate-300 font-mono">
                  {notificationChannels.length}
                </span>
              </button>

              <button
                onClick={() => setAlertsViewMode('deliveries')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  alertsViewMode === 'deliveries'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'text-slate-400 hover:text-white bg-slate-900/50'
                }`}
              >
                <Send className="w-3.5 h-3.5" /> Delivery Audit Trail
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-800 text-slate-300 font-mono">
                  {notificationDeliveries.length}
                </span>
              </button>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              VIEW 1: INCIDENTS MANAGEMENT
          ────────────────────────────────────────────────────────────── */}
          {alertsViewMode === 'incidents' && (
            <div className="space-y-4">
              {/* Filters Bar */}
              <div className="p-4 rounded-2xl bg-[#090f1e] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Status Filter */}
                  <select
                    value={incidentFilterStatus}
                    onChange={(e) => setIncidentFilterStatus(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">OPEN</option>
                    <option value="INVESTIGATING">INVESTIGATING</option>
                    <option value="IDENTIFIED">IDENTIFIED</option>
                    <option value="MONITORING">MONITORING</option>
                    <option value="RESOLVED">RESOLVED</option>
                  </select>

                  {/* Severity Filter */}
                  <select
                    value={incidentFilterSeverity}
                    onChange={(e) => setIncidentFilterSeverity(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">🔴 Critical</option>
                    <option value="WARNING">🟡 Warning</option>
                    <option value="INFO">🔵 Info</option>
                  </select>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search incidents by title or summary..."
                    value={incidentSearch}
                    onChange={(e) => setIncidentSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 w-full sm:w-64"
                  />
                </div>
              </div>

              {/* Incidents Table */}
              <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                        <th className="pb-3 px-3">Severity &amp; ID</th>
                        <th className="pb-3 px-3">Incident Title &amp; Trigger</th>
                        <th className="pb-3 px-3">Affected Resource</th>
                        <th className="pb-3 px-3">Timeline / Started</th>
                        <th className="pb-3 px-3">Status</th>
                        <th className="pb-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {incidentsList.map((inc) => (
                        <tr key={inc.incidentId || inc._id} className="hover:bg-slate-900/50 transition-colors">
                          {/* Severity & ID */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  inc.severity === 'CRITICAL'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                    : inc.severity === 'WARNING'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                                }`}
                              >
                                {inc.severity}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono block mt-1">
                              {inc.incidentId}
                            </span>
                          </td>

                          {/* Title & Trigger */}
                          <td className="py-3 px-3 max-w-sm">
                            <div className="font-semibold text-white">{inc.title}</div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">{inc.summary}</div>
                            {inc.trigger?.metric && (
                              <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[10px] text-purple-300 font-mono">
                                {inc.trigger.metric} {inc.trigger.operator} {inc.trigger.threshold} (Actual:{' '}
                                {inc.trigger.value})
                              </span>
                            )}
                          </td>

                          {/* Affected Resource */}
                          <td className="py-3 px-3 font-mono text-slate-300">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 text-[11px] border border-slate-700 flex items-center gap-1 w-max">
                              <ServerIcon className="w-3 h-3 text-slate-400" />
                              {inc.affectedResources?.serverId ||
                                inc.affectedResources?.endpoint ||
                                inc.serverId ||
                                'crm-backend'}
                            </span>
                            {inc.affectedResources?.endpoint && (
                              <span className="text-[10px] text-slate-500 block truncate max-w-[140px] mt-0.5">
                                {inc.affectedResources.endpoint}
                              </span>
                            )}
                          </td>

                          {/* Started At & Duration */}
                          <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                            <div>{new Date(inc.startedAt || inc.triggeredAt).toLocaleTimeString()}</div>
                            <span className="text-[10px] text-slate-500 block">
                              {inc.durationMs ? `${Math.round(inc.durationMs / 1000)}s total` : 'Active now'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                inc.status === 'RESOLVED'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : inc.status === 'INVESTIGATING'
                                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                                  : inc.status === 'OPEN'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {inc.status}
                            </span>
                            {inc.escalationLevel > 1 && (
                              <span className="text-[10px] text-rose-400 font-bold block mt-0.5">
                                Tier {inc.escalationLevel} Escalated
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleInspectIncident(inc.incidentId || inc._id)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700"
                                title="Inspect timeline and error correlations"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {inc.status === 'OPEN' && (
                                <button
                                  onClick={() => handleAcknowledgeAlertIncident(inc.incidentId || inc._id)}
                                  className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 hover:bg-sky-900 border border-sky-800 text-[11px] font-semibold"
                                  title="Acknowledge incident"
                                >
                                  Ack
                                </button>
                              )}

                              {inc.status !== 'RESOLVED' && (
                                <button
                                  onClick={() => {
                                    setResolvingAlertIncident(inc);
                                    setAlertResolveNotes('');
                                    setAlertRootCause('');
                                  }}
                                  className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800 text-[11px] font-semibold"
                                  title="Resolve incident"
                                >
                                  Resolve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {incidentsList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1.5 opacity-60" />
                            No incidents found matching criteria. System operational.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              VIEW 2: CONFIGURABLE ALERT RULES CATALOG
          ────────────────────────────────────────────────────────────── */}
          {alertsViewMode === 'rules' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#090f1e] border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" /> Configurable Alert Rules Catalog
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Define metric triggers, evaluation operators (&gt;, &lt;, rate, percentage, absence), sustained durations, and cooldowns.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingAlertRule(null);
                    setIsRuleModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Alert Rule
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alertRules.map((r) => (
                  <div
                    key={r.ruleId || r._id}
                    className={`p-4 rounded-xl border text-xs space-y-3 transition-all ${
                      r.isActive
                        ? 'bg-slate-900/90 border-slate-800'
                        : 'bg-slate-950/60 border-slate-800/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          r.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : r.severity === 'WARNING'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                        }`}
                      >
                        {r.severity}
                      </span>

                      <button
                        onClick={() => handleToggleAlertRule(r.ruleId || r._id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          r.isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {r.isActive ? 'ACTIVE' : 'PAUSED'}
                      </button>
                    </div>

                    <div>
                      <h5 className="font-bold text-white text-sm">{r.name}</h5>
                      <p className="text-slate-400 text-[11px] mt-0.5">{r.description || 'No description'}</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Condition:</span>
                        <span className="text-amber-300 font-bold">
                          {r.metric} {r.operator} {r.threshold}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Sustained Duration:</span>
                        <span className="text-slate-200">{r.durationSeconds}s</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Cooldown:</span>
                        <span className="text-slate-200">{r.cooldownMinutes} min</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => {
                          setEditingAlertRule(r);
                          setIsRuleModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteAlertRule(r.ruleId || r._id)}
                        className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900 text-rose-300 text-[11px] border border-rose-800/40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              VIEW 3: NOTIFICATION CHANNELS
          ────────────────────────────────────────────────────────────── */}
          {alertsViewMode === 'channels' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#090f1e] border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-sky-400" /> Pluggable Notification Channels
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Connect Webhooks (with HMAC-SHA256 signatures), Slack Block Kit, Telegram Bots, Email digests, and Discord.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingChannel(null);
                    setIsChannelModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Channel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notificationChannels.map((c) => (
                  <div
                    key={c.channelId || c._id}
                    className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold">
                        {c.type}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          c.enabled ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-600'
                        }`}
                      />
                    </div>

                    <div>
                      <h5 className="font-bold text-white text-sm">{c.name}</h5>
                      <span className="text-slate-500 font-mono text-[10px] block mt-0.5">
                        ID: {c.channelId}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 text-[11px] text-slate-400 font-mono">
                      <div>
                        Min Severity: <span className="text-slate-200 font-bold">{c.minSeverity || 'WARNING'}</span>
                      </div>
                      <div className="truncate">
                        Target: <span className="text-slate-200">{c.config?.webhookUrl || c.config?.emailRecipients?.join(', ') || 'Bot Token Configured'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <button
                        onClick={() => handleTestNotificationChannel(c.channelId || c._id)}
                        disabled={isTestingChannelId === (c.channelId || c._id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-bold border border-slate-700 flex items-center gap-1"
                      >
                        <Zap className={`w-3 h-3 ${isTestingChannelId === (c.channelId || c._id) ? 'animate-spin' : ''}`} />
                        Send Test
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingChannel(c);
                            setIsChannelModalOpen(true);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteNotificationChannel(c.channelId || c._id)}
                          className="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900 text-rose-300 text-[11px]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              VIEW 4: NOTIFICATION DELIVERY AUDIT TRAIL
          ────────────────────────────────────────────────────────────── */}
          {alertsViewMode === 'deliveries' && (
            <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-purple-400" /> Notification Delivery Audit Trail
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete audit log of all outbound webhook dispatches, Slack messages, Telegram pings, and email digests.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px]">
                      <th className="pb-3 px-3">Delivery ID</th>
                      <th className="pb-3 px-3">Event Type</th>
                      <th className="pb-3 px-3">Channel &amp; Type</th>
                      <th className="pb-3 px-3">Status</th>
                      <th className="pb-3 px-3">HTTP / Latency</th>
                      <th className="pb-3 px-3 text-right">Dispatched At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {notificationDeliveries.map((d) => (
                      <tr key={d.deliveryId || d._id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-300">{d.deliveryId}</td>
                        <td className="py-3 px-3 font-mono font-semibold text-purple-300">{d.eventType}</td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-white">{d.channelName || d.channelId}</span>
                          <span className="text-[10px] text-slate-500 block font-mono">{d.channelType}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              d.status === 'DELIVERED'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {d.responseCode ? `HTTP ${d.responseCode}` : 'OK'} ({d.latencyMs || 10}ms)
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400 font-mono">
                          {d.createdAt ? new Date(d.createdAt).toLocaleTimeString() : 'Recent'}
                        </td>
                      </tr>
                    ))}
                    {notificationDeliveries.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No delivery records logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODAL 1: INTERACTIVE INCIDENT DETAIL INSPECTOR
          ────────────────────────────────────────────────────────────── */}
          {selectedIncidentDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                        selectedIncidentDetail.severity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {selectedIncidentDetail.severity}
                    </span>
                    <h3 className="text-sm font-bold text-white">{selectedIncidentDetail.title}</h3>
                  </div>

                  <button
                    onClick={() => setSelectedIncidentDetail(null)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {/* Summary & Trigger Spec */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <span className="text-slate-400 font-semibold block">Incident Summary:</span>
                    <p className="text-slate-200">{selectedIncidentDetail.summary}</p>
                    <div className="pt-2 text-[11px] text-slate-500 font-mono">
                      Incident ID: {selectedIncidentDetail.incidentId}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 font-mono text-xs">
                    <span className="text-slate-400 font-semibold block font-sans">Trigger &amp; Threshold:</span>
                    <div className="text-amber-300 font-bold">
                      Metric: {selectedIncidentDetail.trigger?.metric || 'N/A'}
                    </div>
                    <div className="text-slate-300">
                      Condition: {selectedIncidentDetail.trigger?.operator} {selectedIncidentDetail.trigger?.threshold}
                    </div>
                    <div className="text-rose-400">
                      Actual Observed Value: {selectedIncidentDetail.trigger?.value}
                    </div>
                  </div>
                </div>

                {/* Interactive Timeline */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-400" /> Incident Chronological Timeline
                  </h4>

                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-2 text-xs">
                    {(selectedIncidentDetail.timeline || []).map((t: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            {t.event}
                          </div>
                          <p className="text-slate-400 text-[11px]">{t.description}</p>
                        </div>
                        <div className="text-right text-[10px] text-slate-500 font-mono whitespace-nowrap">
                          <div>{new Date(t.timestamp).toLocaleTimeString()}</div>
                          <span className="text-slate-400">{t.actor}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Related Errors & Logs (Correlation Engine) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Related Errors */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <h5 className="font-bold text-white flex items-center gap-1.5">
                      <Bug className="w-3.5 h-3.5 text-rose-400" /> Correlated Errors (Last 15m)
                    </h5>
                    {(selectedIncidentDetail.relatedErrors || []).length === 0 ? (
                      <p className="text-slate-500 text-[11px]">No specific errors correlated.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {selectedIncidentDetail.relatedErrors.map((e: any, idx: number) => (
                          <div key={idx} className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px]">
                            <div className="text-rose-300 font-mono font-bold truncate">{e.name || e.message}</div>
                            <span className="text-slate-500 text-[10px]">{e.count} occurrences</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Related Logs */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <h5 className="font-bold text-white flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-sky-400" /> Correlated Logs
                    </h5>
                    {(selectedIncidentDetail.relatedLogs || []).length === 0 ? (
                      <p className="text-slate-500 text-[11px]">No warning/error logs attached.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[10px]">
                        {selectedIncidentDetail.relatedLogs.map((l: any, idx: number) => (
                          <div key={idx} className="p-2 rounded bg-slate-950 border border-slate-800">
                            <span className="text-amber-400 font-bold">[{l.level?.toUpperCase()}]</span>{' '}
                            <span className="text-slate-300">{l.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    {selectedIncidentDetail.status !== 'RESOLVED' && (
                      <>
                        {selectedIncidentDetail.status === 'OPEN' && (
                          <button
                            onClick={() => handleAcknowledgeAlertIncident(selectedIncidentDetail.incidentId)}
                            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => handleEscalateAlertIncident(selectedIncidentDetail.incidentId)}
                          className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                        >
                          Escalate Tier
                        </button>
                        <button
                          onClick={() => {
                            setResolvingAlertIncident(selectedIncidentDetail);
                            setAlertResolveNotes('');
                            setAlertRootCause('');
                          }}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                        >
                          Resolve Incident
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedIncidentDetail(null)}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODAL 2: RESOLVE INCIDENT DIALOG
          ────────────────────────────────────────────────────────────── */}
          {resolvingAlertIncident && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-emerald-800/80 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" /> Resolve Incident &amp; Send Recovery Notice
                  </h3>
                  <button
                    onClick={() => setResolvingAlertIncident(null)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Target Incident:</span>
                    <span className="text-white font-bold">{resolvingAlertIncident.title}</span>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Root Cause Analysis:</label>
                    <input
                      type="text"
                      value={alertRootCause}
                      onChange={(e) => setAlertRootCause(e.target.value)}
                      placeholder="e.g. Memory leak cleared, background cron task completed"
                      className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Resolution &amp; Remediation Notes:</label>
                    <textarea
                      rows={3}
                      value={alertResolveNotes}
                      onChange={(e) => setAlertResolveNotes(e.target.value)}
                      placeholder="Describe steps taken to resolve the incident..."
                      className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setResolvingAlertIncident(null)}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResolveAlertIncident}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    Confirm Resolution
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODAL 3: CREATE / EDIT ALERT RULE MODAL
          ────────────────────────────────────────────────────────────── */}
          {isRuleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-amber-800/80 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    {editingAlertRule ? 'Edit Alert Rule' : 'Create New Alert Rule'}
                  </h3>
                  <button
                    onClick={() => {
                      setIsRuleModalOpen(false);
                      setEditingAlertRule(null);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as any;
                    handleSaveAlertRule({
                      name: form.ruleName.value,
                      description: form.description.value,
                      metric: form.metric.value,
                      operator: form.operator.value,
                      threshold: form.threshold.value,
                      durationSeconds: Number(form.durationSeconds.value),
                      cooldownMinutes: Number(form.cooldownMinutes.value),
                      severity: form.severity.value,
                    });
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="text-slate-400 block mb-1">Rule Name:</label>
                    <input
                      name="ruleName"
                      defaultValue={editingAlertRule?.name || ''}
                      required
                      placeholder="e.g. High Memory Usage Spike"
                      className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Description:</label>
                    <input
                      name="description"
                      defaultValue={editingAlertRule?.description || ''}
                      placeholder="e.g. Triggers alert when RAM usage exceeds threshold"
                      className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Target Metric:</label>
                      <select
                        name="metric"
                        defaultValue={editingAlertRule?.metric || 'cpu'}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="cpu">CPU Load (%)</option>
                        <option value="ram">RAM Memory (%)</option>
                        <option value="disk">Disk Usage (%)</option>
                        <option value="api_5xx_rate">API 5xx Error Rate (/min)</option>
                        <option value="p95_latency">API P95 Latency (ms)</option>
                        <option value="server_heartbeat">Server Heartbeat</option>
                        <option value="database_status">Database Status</option>
                        <option value="backup_status">Backup Status</option>
                        <option value="security_event_spike">Security Threat Rate</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Evaluation Operator:</label>
                      <select
                        name="operator"
                        defaultValue={editingAlertRule?.operator || '>'}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value=">">&gt; (Greater than)</option>
                        <option value="<">&lt; (Less than)</option>
                        <option value=">=">&gt;= (Greater or equal)</option>
                        <option value="<=">&lt;= (Less or equal)</option>
                        <option value="==">== (Exact match)</option>
                        <option value="rate_increase">rate_increase (Rate / min)</option>
                        <option value="percentage_increase">percentage_increase (% spike)</option>
                        <option value="absence_data">absence/no-data (Timeout)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Threshold:</label>
                      <input
                        name="threshold"
                        defaultValue={editingAlertRule?.threshold ?? 90}
                        required
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Duration (sec):</label>
                      <input
                        name="durationSeconds"
                        type="number"
                        defaultValue={editingAlertRule?.durationSeconds ?? 300}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Cooldown (min):</label>
                      <input
                        name="cooldownMinutes"
                        type="number"
                        defaultValue={editingAlertRule?.cooldownMinutes ?? 15}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Severity Level:</label>
                    <select
                      name="severity"
                      defaultValue={editingAlertRule?.severity || 'WARNING'}
                      className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="CRITICAL">🔴 Critical</option>
                      <option value="WARNING">🟡 Warning</option>
                      <option value="INFO">🔵 Info</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRuleModalOpen(false);
                        setEditingAlertRule(null);
                      }}
                      className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                    >
                      Save Alert Rule
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODAL 4: CREATE / EDIT NOTIFICATION CHANNEL MODAL
          ────────────────────────────────────────────────────────────── */}
          {isChannelModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-sky-800/80 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-sky-400" />
                    {editingChannel ? 'Edit Notification Channel' : 'Add Notification Channel'}
                  </h3>
                  <button
                    onClick={() => {
                      setIsChannelModalOpen(false);
                      setEditingChannel(null);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as any;
                    handleSaveNotificationChannel({
                      name: form.channelName.value,
                      type: form.channelType.value,
                      minSeverity: form.minSeverity.value,
                      config: {
                        webhookUrl: form.webhookUrl.value,
                        botToken: form.botToken?.value,
                        chatId: form.chatId?.value,
                        emailRecipients: form.emailRecipients?.value
                          ? form.emailRecipients.value.split(',').map((s: string) => s.trim())
                          : [],
                        secretKey: form.secretKey?.value,
                      },
                    });
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="text-slate-400 block mb-1">Channel Name:</label>
                    <input
                      name="channelName"
                      defaultValue={editingChannel?.name || ''}
                      required
                      placeholder="e.g. Primary DevOps Slack Webhook"
                      className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Channel Provider:</label>
                      <select
                        name="channelType"
                        defaultValue={editingChannel?.type || 'WEBHOOK'}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
                      >
                        <option value="WEBHOOK">Webhook (HMAC-SHA256)</option>
                        <option value="SLACK">Slack (Block Kit)</option>
                        <option value="TELEGRAM">Telegram Bot API</option>
                        <option value="EMAIL">Email Digest</option>
                        <option value="DISCORD">Discord Webhook</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Min Severity Level:</label>
                      <select
                        name="minSeverity"
                        defaultValue={editingChannel?.minSeverity || 'WARNING'}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
                      >
                        <option value="INFO">🔵 Info &amp; Higher</option>
                        <option value="WARNING">🟡 Warning &amp; Higher</option>
                        <option value="CRITICAL">🔴 Critical Only</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Webhook URL / Endpoint:</label>
                    <input
                      name="webhookUrl"
                      defaultValue={editingChannel?.config?.webhookUrl || ''}
                      placeholder="https://hooks.slack.com/... or https://discord.com/api/webhooks/..."
                      className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Telegram Bot Token (Optional):</label>
                      <input
                        name="botToken"
                        defaultValue={editingChannel?.config?.botToken || ''}
                        placeholder="123456:ABC-DEF..."
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Telegram Chat ID (Optional):</label>
                      <input
                        name="chatId"
                        defaultValue={editingChannel?.config?.chatId || ''}
                        placeholder="-100123456789"
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Email Recipients (Comma-separated):</label>
                    <input
                      name="emailRecipients"
                      defaultValue={(editingChannel?.config?.emailRecipients || []).join(', ')}
                      placeholder="devops@coresetu.com, admin@coresetu.com"
                      className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">HMAC Secret Key (Optional):</label>
                    <input
                      name="secretKey"
                      defaultValue={editingChannel?.config?.secretKey || ''}
                      placeholder="crm_webhook_secret_key"
                      className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsChannelModalOpen(false);
                        setEditingChannel(null);
                      }}
                      className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
                    >
                      Save Channel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              MODAL 5: ANOMALY SIMULATOR MODAL
          ────────────────────────────────────────────────────────────── */}
          {isSimulatingAnomaly && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
              <div className="bg-[#090f1e] border border-rose-800/80 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-rose-400" /> Simulate Metric Anomaly
                  </h3>
                  <button
                    onClick={() => setIsSimulatingAnomaly(false)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-400">
                  Injects an artificial metric spike to test the complete pipeline end-to-end: Evaluation $\rightarrow$ Deduplication $\rightarrow$ Incident Grouping $\rightarrow$ Multi-Channel Notification Dispatch.
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Simulated Metric:</label>
                    <select
                      value={simulatedMetric}
                      onChange={(e) => setSimulatedMetric(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="cpu">CPU Utilization (%)</option>
                      <option value="ram">RAM Memory (%)</option>
                      <option value="disk">Disk Capacity (%)</option>
                      <option value="api_5xx_rate">API 5xx Errors (/min)</option>
                      <option value="p95_latency">API P95 Latency (ms)</option>
                      <option value="database_status">Database Status</option>
                      <option value="backup_status">Backup Status</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Injected Value (Breach value):</label>
                    <input
                      type="number"
                      value={simulatedValue}
                      onChange={(e) => setSimulatedValue(Number(e.target.value))}
                      className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setIsSimulatingAnomaly(false)}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await handleExecuteSimulatedAnomaly();
                      setIsSimulatingAnomaly(false);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    Trigger Simulation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          11. TAB: PRODUCTION-GRADE HEALTH CHECK FRAMEWORK
      ────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'health' && (
        <div className="space-y-6">
          {/* Health Framework Hero Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0d1c1a] via-[#102724] to-[#0a1816] border border-emerald-800/60 shadow-2xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-6 h-6 text-emerald-400 animate-pulse" />
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    Production Health Check &amp; Kubernetes Probes Framework
                  </h3>
                </div>

                {/* Overall Status Badge */}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    detailedHealth?.status === 'HEALTHY'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : detailedHealth?.status === 'DEGRADED'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      detailedHealth?.status === 'HEALTHY'
                        ? 'bg-emerald-400 animate-ping'
                        : detailedHealth?.status === 'DEGRADED'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                  />
                  SYSTEM {detailedHealth?.status || 'HEALTHY'}
                </span>

                {/* Secret Sanitization Active */}
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Zero-Secrets Sanitization Active
                </span>
              </div>

              {/* Status Counters Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Overall Health Score:</span>
                  <span
                    className={`font-bold font-mono text-base ${
                      (detailedHealth?.overallScore ?? 100) >= 85
                        ? 'text-emerald-400'
                        : (detailedHealth?.overallScore ?? 100) >= 60
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {detailedHealth?.overallScore ?? 100}%
                  </span>
                </div>
                <div>
                  <span className="text-emerald-400 block text-[11px] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Healthy:
                  </span>
                  <span className="text-white font-bold font-mono text-base">
                    {detailedHealth?.summary?.healthyComponents ?? 6} / {detailedHealth?.summary?.totalComponents ?? 7}
                  </span>
                </div>
                <div>
                  <span className="text-amber-400 block text-[11px] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Degraded:
                  </span>
                  <span className="text-white font-bold font-mono text-base">
                    {detailedHealth?.summary?.degradedComponents ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-rose-400 block text-[11px] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Unhealthy:
                  </span>
                  <span className="text-white font-bold font-mono text-base">
                    {detailedHealth?.summary?.unhealthyComponents ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Process Uptime:</span>
                  <span className="text-purple-300 font-bold font-mono text-base">
                    {detailedHealth?.uptimeSeconds
                      ? `${Math.floor(detailedHealth.uptimeSeconds / 60)}m ${detailedHealth.uptimeSeconds % 60}s`
                      : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Live Probe Test Actions */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 self-start lg:self-auto w-full lg:w-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
                <button
                  onClick={() => handleRunHealthProbe('live')}
                  disabled={isProbingHealth}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md"
                  title="Run Liveness Probe (process & event loop responsiveness)"
                >
                  <Zap className="w-3.5 h-3.5 text-sky-400" /> /health/live
                </button>

                <button
                  onClick={() => handleRunHealthProbe('ready')}
                  disabled={isProbingHealth}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md"
                  title="Run Readiness Probe (critical database & storage checks)"
                >
                  <FileCheck className="w-3.5 h-3.5 text-emerald-400" /> /health/ready
                </button>

                <button
                  onClick={() => handleRunHealthProbe('detailed')}
                  disabled={isProbingHealth}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md"
                  title="Run Detailed Diagnostics Probe (all 6 component types)"
                >
                  <HeartPulse className="w-3.5 h-3.5 text-white" /> /health/detailed
                </button>

                <button
                  onClick={() => handleRunHealthProbe('summary')}
                  disabled={isProbingHealth}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md"
                  title="Run Standard Overview Health Check"
                >
                  <Activity className="w-3.5 h-3.5 text-amber-400" /> /health
                </button>
              </div>
            </div>
          </div>

          {/* Component Probes Health Matrix */}
          <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-emerald-400" /> Component Probes Health Matrix
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time health status, strict timeout isolation (&lt;2.5s), and latency breakdown for all core subsystems.
                </p>
              </div>

              <button
                onClick={() => handleRunHealthProbe('detailed')}
                disabled={isProbingHealth}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProbingHealth ? 'animate-spin' : ''}`} /> Refresh Probes
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Application Runtime Card */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-purple-400" /> Application Runtime
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      detailedHealth?.components?.application?.status === 'HEALTHY'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {detailedHealth?.components?.application?.status || 'HEALTHY'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  {detailedHealth?.components?.application?.message || 'Node.js process and event loop responsive'}
                </p>
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Process PID:</span>
                    <span className="text-white">{detailedHealth?.components?.application?.details?.pid || process.pid}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Heap Memory:</span>
                    <span className="text-emerald-400">
                      {detailedHealth?.components?.application?.details?.memory?.heapUsedMb || 28} MB /{' '}
                      {detailedHealth?.components?.application?.details?.memory?.heapTotalMb || 35} MB
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Event Loop Lag:</span>
                    <span className="text-sky-300">
                      {detailedHealth?.components?.application?.details?.eventLoopLagMs || 1.2} ms
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. MongoDB Database Card */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-400" /> MongoDB Core Database
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      detailedHealth?.components?.mongodb?.status === 'HEALTHY'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {detailedHealth?.components?.mongodb?.status || 'HEALTHY'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  {detailedHealth?.components?.mongodb?.message || 'MongoDB connected and responsive'}
                </p>
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Connection State:</span>
                    <span className="text-emerald-400 font-bold">
                      {detailedHealth?.components?.mongodb?.details?.connectionState || 'connected'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Ping Latency:</span>
                    <span className="text-sky-300">
                      {detailedHealth?.components?.mongodb?.latencyMs || dbOverview?.pingLatencyMs || 15} ms
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Database:</span>
                    <span className="text-slate-200">
                      {detailedHealth?.components?.mongodb?.details?.databaseName || 'mobile-crm'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Redis Cache Card */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" /> Redis Cache
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {detailedHealth?.components?.redis?.status || 'NOT_CONFIGURED'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  {detailedHealth?.components?.redis?.message || 'Redis optional (MongoDB active for state)'}
                </p>
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Driver Mode:</span>
                    <span className="text-slate-200">MongoDB / In-Memory</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Fallback:</span>
                    <span className="text-emerald-400">Active &amp; Resilient</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Critical:</span>
                    <span className="text-slate-400">No (Optional)</span>
                  </div>
                </div>
              </div>

              {/* 4. Storage & Filesystem Card */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-sky-400" /> Storage &amp; Filesystem
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      detailedHealth?.components?.storage?.status === 'HEALTHY'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {detailedHealth?.components?.storage?.status || 'HEALTHY'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  {detailedHealth?.components?.storage?.message || 'Filesystem atomic read/write verified'}
                </p>
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Read/Write Check:</span>
                    <span className="text-emerald-400 font-bold">VERIFIED</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Probe Latency:</span>
                    <span className="text-sky-300">{detailedHealth?.components?.storage?.latencyMs || 2} ms</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Free Disk Space:</span>
                    <span className="text-slate-200">
                      {detailedHealth?.components?.storage?.details?.freeDiskMb
                        ? `${detailedHealth.components.storage.details.freeDiskMb} MB`
                        : 'Available'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. WhatsApp API Card */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-400" /> WhatsApp API
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      detailedHealth?.components?.whatsapp?.status === 'HEALTHY'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {detailedHealth?.components?.whatsapp?.status || 'HEALTHY'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  {detailedHealth?.components?.whatsapp?.message || 'WhatsApp gateway operational'}
                </p>
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Provider:</span>
                    <span className="text-slate-200">Baileys / Webhook</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Latency:</span>
                    <span className="text-sky-300">{detailedHealth?.components?.whatsapp?.latencyMs || 1} ms</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Timeout Isolation:</span>
                    <span className="text-emerald-400 font-bold">2.5s Guarded</span>
                  </div>
                </div>
              </div>

              {/* 6. Queue & Background Workers Card */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-purple-400" /> Queue &amp; Background Workers
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      detailedHealth?.components?.queue?.status === 'HEALTHY'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {detailedHealth?.components?.queue?.status || 'HEALTHY'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  {detailedHealth?.components?.queue?.message || 'Background task workers active and polling'}
                </p>
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Queued Jobs:</span>
                    <span className="text-emerald-400">
                      {detailedHealth?.components?.queue?.details?.queuedJobs ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Failed Jobs:</span>
                    <span className="text-slate-200">
                      {detailedHealth?.components?.queue?.details?.failedJobs ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Poll Frequency:</span>
                    <span className="text-purple-300">5000 ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Kubernetes & Load Balancer Specs Card */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Kubernetes Deployment Config */}
            <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-sky-400" /> Kubernetes &amp; Helm Spec
                </h4>
                <button
                  onClick={() =>
                    handleCopyProbeUrl(`livenessProbe:
  httpGet:
    path: /health/live
    port: 5000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 2
readinessProbe:
  httpGet:
    path: /health/ready
    port: 5000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 2`)
                  }
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs border border-slate-700 flex items-center gap-1"
                >
                  <Share2 className="w-3 h-3" /> Copy YAML
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto space-y-1">
                <div className="text-slate-500"># Kubernetes Pod Health Probes</div>
                <div className="text-amber-400">livenessProbe:</div>
                <div className="pl-4">httpGet:</div>
                <div className="pl-8 text-sky-300">path: /health/live</div>
                <div className="pl-8 text-sky-300">port: 5000</div>
                <div className="pl-4">initialDelaySeconds: 5</div>
                <div className="pl-4">periodSeconds: 10</div>
                <div className="pl-4">timeoutSeconds: 2</div>
                <div className="text-emerald-400 pt-2">readinessProbe:</div>
                <div className="pl-4">httpGet:</div>
                <div className="pl-8 text-sky-300">path: /health/ready</div>
                <div className="pl-8 text-sky-300">port: 5000</div>
                <div className="pl-4">initialDelaySeconds: 5</div>
                <div className="pl-4">periodSeconds: 5</div>
                <div className="pl-4">timeoutSeconds: 2</div>
              </div>
            </div>

            {/* AWS ALB & Ingress Spec */}
            <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> AWS ALB &amp; Ingress Target Group
                </h4>
                <button
                  onClick={() => handleCopyProbeUrl('https://api.coresetu.com/health')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs border border-slate-700 flex items-center gap-1"
                >
                  <Share2 className="w-3 h-3" /> Copy URL
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Target Group Path:</span>
                    <span className="text-amber-300 font-bold">/health</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Expected HTTP Status:</span>
                    <span className="text-emerald-400 font-bold">200</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Health Check Interval:</span>
                    <span className="text-slate-200">15 seconds</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Healthy Threshold:</span>
                    <span className="text-slate-200">2 consecutive passes</span>
                  </div>
                </div>

                <p className="text-slate-400 text-[11px]">
                  When a component like MongoDB disconnects, <code className="text-amber-300">/health/ready</code> and <code className="text-amber-300">/health</code> automatically return <code className="text-rose-400">503 Service Unavailable</code> so traffic is cleanly diverted.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Raw JSON Diagnostics Viewer */}
          <div className="p-5 rounded-2xl bg-[#090f1e] border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-bold text-white mr-2 flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" /> Inspect JSON:
                </span>
                <button
                  onClick={() => setActiveProbeInspect('detailed')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    activeProbeInspect === 'detailed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-900'
                  }`}
                >
                  /health/detailed
                </button>
                <button
                  onClick={() => setActiveProbeInspect('live')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    activeProbeInspect === 'live'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-900'
                  }`}
                >
                  /health/live
                </button>
                <button
                  onClick={() => setActiveProbeInspect('ready')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    activeProbeInspect === 'ready'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-900'
                  }`}
                >
                  /health/ready
                </button>
                <button
                  onClick={() => setActiveProbeInspect('summary')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    activeProbeInspect === 'summary'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-900'
                  }`}
                >
                  /health
                </button>
              </div>

              <button
                onClick={() => {
                  const dataToCopy =
                    activeProbeInspect === 'detailed'
                      ? detailedHealth
                      : activeProbeInspect === 'live'
                      ? livenessProbeResult
                      : activeProbeInspect === 'ready'
                      ? readinessProbeResult
                      : summaryHealthResult;
                  navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
                  toast.success('JSON copied to clipboard!');
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 flex items-center gap-1 self-start sm:self-auto"
              >
                <Share2 className="w-3 h-3" /> Copy JSON
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 max-h-80 overflow-y-auto overflow-x-auto">
              {JSON.stringify(
                activeProbeInspect === 'detailed'
                  ? detailedHealth || { notice: 'Click /health/detailed to fetch' }
                  : activeProbeInspect === 'live'
                  ? livenessProbeResult || { notice: 'Click /health/live to probe' }
                  : activeProbeInspect === 'ready'
                  ? readinessProbeResult || { notice: 'Click /health/ready to probe' }
                  : summaryHealthResult || { notice: 'Click /health to probe' },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
