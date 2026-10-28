import crypto from 'crypto';
import { AlertRule, IAlertRule } from '../models/AlertRule';
import { Alert, IAlert } from '../models/Alert';
import { Incident } from '../models/Incident';
import { NotificationChannel } from '../models/NotificationChannel';
import { NotificationDelivery } from '../models/NotificationDelivery';
import { ServerMetric } from '../models/ServerMetric';
import { ServerHeartbeat } from '../models/ServerHeartbeat';
import { ApiPerformanceSnapshot } from '../models/ApiPerformanceSnapshot';
import { DatabaseHealth } from '../models/DatabaseHealth';
import { BackupRecord } from '../models/BackupRecord';
import { SecurityEvent } from '../models/SecurityEvent';
import { alertEngine } from './alertEngine';
import { alertDeduplicator } from './alertDeduplicator';
import { incidentManager } from './incidentManager';
import { notificationEngine } from './notificationEngine';

export interface CachedAlertDashboardState {
  counts: {
    activeCritical: number;
    activeWarning: number;
    activeInfo: number;
    totalOpen: number;
    totalResolved24h: number;
    totalAlerts24h: number;
  };
  metrics: {
    mttaMinutes: number;
    mttrMinutes: number;
    deliverySuccessRate: number;
  };
  recentIncidents: any[];
  recentAlerts: any[];
  activeRulesCount: number;
  activeChannelsCount: number;
  lastEvaluatedAt: Date;
}

export class AlertMonitorWorker {
  private static instance: AlertMonitorWorker;
  private intervalTimer: NodeJS.Timeout | null = null;
  private intervalMs = 30000; // 30 seconds
  private isEvaluating = false;
  private latestState: CachedAlertDashboardState;

  private constructor() {
    this.latestState = this.getFallbackState();
  }

  public static getInstance(): AlertMonitorWorker {
    if (!AlertMonitorWorker.instance) {
      AlertMonitorWorker.instance = new AlertMonitorWorker();
    }
    return AlertMonitorWorker.instance;
  }

  public start(intervalMs = 30000): void {
    this.intervalMs = intervalMs;
    console.log(`[AlertMonitorWorker] Starting alert evaluation worker (Interval: ${this.intervalMs}ms)`);

    // Run initial seed and evaluation
    this.evaluate().catch((err) => {
      console.warn('[AlertMonitorWorker] Initial evaluation warning:', err.message);
    });

    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.intervalTimer = setInterval(() => {
      this.evaluate().catch((err) => {
        console.warn('[AlertMonitorWorker] Periodic evaluation warning:', err.message);
      });
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
      console.log('[AlertMonitorWorker] Stopped alert evaluation worker');
    }
  }

  public getLatestState(): CachedAlertDashboardState {
    return this.latestState;
  }

  /**
   * Main evaluation loop
   */
  public async evaluate(): Promise<CachedAlertDashboardState> {
    if (this.isEvaluating) return this.latestState;
    this.isEvaluating = true;

    try {
      // 1. Seed standard default rules and channels if empty
      await this.ensureDefaultRulesAndChannels();

      // 2. Fetch all active rules
      const rules = await AlertRule.find({ isActive: true }).lean();

      // 3. Gather latest telemetry snapshot across all subsystems
      const snapshot = await this.gatherTelemetrySnapshot();

      // 4. Evaluate each rule
      for (const rule of rules) {
        // Skip silenced rules
        if (rule.silenceUntil && new Date(rule.silenceUntil) > new Date()) {
          continue;
        }

        const metricData = this.extractMetricData(rule.metric, snapshot);
        const fingerprint = alertDeduplicator.generateFingerprint(rule as any, rule.targetResource || {});

        const evalResult = alertEngine.evaluate({
          metricName: rule.name,
          currentValue: metricData.value,
          operator: rule.operator,
          threshold: rule.threshold,
          durationSeconds: rule.durationSeconds,
          lastDataTimestamp: metricData.timestamp,
          historicalPoints: metricData.history,
          baselineValue: metricData.baseline,
        });

        if (evalResult.isBreached) {
          // Check for active open alert with same fingerprint
          const existingAlert = await Alert.findOne({
            fingerprint,
            status: { $in: ['TRIGGERED', 'ACKNOWLEDGED'] },
          });

          const dedup = alertDeduplicator.checkDeduplication(
            fingerprint,
            rule.cooldownMinutes || 15,
            existingAlert?.alertId
          );

          if (!existingAlert) {
            // New alert triggered
            const alertId = `alrt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
            const newAlert = await Alert.create({
              alertId,
              ruleId: rule.ruleId,
              title: `${rule.name}: ${evalResult.message}`,
              metricName: rule.metric,
              metricValue: evalResult.currentValue,
              threshold: rule.threshold,
              operator: rule.operator,
              severity: rule.severity,
              status: 'TRIGGERED',
              fingerprint,
              targetResource: {
                type: rule.targetResource?.type || 'SERVER',
                identifier: rule.targetResource?.identifier || 'ip-172-31-18-29',
                name: rule.name,
              },
              triggeredAt: new Date(),
              details: {
                message: evalResult.message,
                calculatedRate: evalResult.calculatedRate,
                calculatedPercentIncrease: evalResult.calculatedPercentIncrease,
              },
            });

            // Group into Incident
            const incident = await incidentManager.correlateAndUpsertIncident(newAlert);

            // Dispatch notification if not in cooldown
            if (!dedup.isInCooldown) {
              await notificationEngine.dispatch(
                {
                  eventType: 'ALERT_TRIGGERED',
                  timestamp: new Date(),
                  alert: {
                    alertId: newAlert.alertId,
                    title: newAlert.title,
                    metricName: newAlert.metricName,
                    metricValue: newAlert.metricValue,
                    threshold: newAlert.threshold,
                    operator: newAlert.operator,
                    severity: newAlert.severity,
                    status: newAlert.status,
                    triggeredAt: newAlert.triggeredAt,
                  },
                  incident: {
                    incidentId: incident.incidentId,
                    title: incident.title,
                    severity: incident.severity,
                    status: incident.status,
                    summary: incident.summary,
                    affectedResources: incident.affectedResources,
                  },
                },
                rule.channels
              );

              alertDeduplicator.recordNotification(fingerprint);
            }
          } else {
            // Update metric value on existing alert
            existingAlert.metricValue = evalResult.currentValue;
            await existingAlert.save();
          }
        } else {
          // Metric is normal - check if we should auto-resolve active alerts for this fingerprint
          const activeAlerts = await Alert.find({
            fingerprint,
            status: { $in: ['TRIGGERED', 'ACKNOWLEDGED'] },
          });

          for (const activeAlert of activeAlerts) {
            activeAlert.status = 'RESOLVED';
            activeAlert.resolvedAt = new Date();
            activeAlert.resolvedBy = 'AUTO_RECOVERY';
            await activeAlert.save();

            // Auto-resolve associated incident if no other active alerts remain
            if (activeAlert.incidentId) {
              const otherAlerts = await Alert.countDocuments({
                incidentId: activeAlert.incidentId,
                status: { $in: ['TRIGGERED', 'ACKNOWLEDGED'] },
              });

              if (otherAlerts === 0) {
                await incidentManager.resolveIncident(
                  activeAlert.incidentId,
                  'AUTO_RECOVERY',
                  `Metric "${rule.name}" returned to normal operating range (${evalResult.currentValue})`,
                  'Transient spike cleared'
                );
              }
            }

            alertDeduplicator.clearCooldown(fingerprint);
          }
        }
      }

      // 5. Run SLA Escalation check
      await incidentManager.checkEscalationSLAs();

      // 6. Build cached dashboard overview
      await this.refreshCachedState();
    } catch (err: any) {
      console.error('[AlertMonitorWorker] Evaluation cycle error:', err);
    } finally {
      this.isEvaluating = false;
    }

    return this.latestState;
  }

  /**
   * Refreshes the fast in-memory telemetry state for admin dashboard
   */
  public async refreshCachedState(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      activeCritical,
      activeWarning,
      activeInfo,
      totalOpen,
      totalResolved24h,
      totalAlerts24h,
      recentIncidents,
      recentAlerts,
      activeRulesCount,
      activeChannelsCount,
      deliveries,
      resolvedIncidents,
    ] = await Promise.all([
      Incident.countDocuments({ severity: 'CRITICAL', status: { $ne: 'RESOLVED' } }),
      Incident.countDocuments({ severity: 'WARNING', status: { $ne: 'RESOLVED' } }),
      Incident.countDocuments({ severity: 'INFO', status: { $ne: 'RESOLVED' } }),
      Incident.countDocuments({ status: { $ne: 'RESOLVED' } }),
      Incident.countDocuments({ status: 'RESOLVED', resolvedAt: { $gte: oneDayAgo } }),
      Alert.countDocuments({ triggeredAt: { $gte: oneDayAgo } }),
      Incident.find().sort({ startedAt: -1 }).limit(20).lean(),
      Alert.find().sort({ triggeredAt: -1 }).limit(20).lean(),
      AlertRule.countDocuments({ isActive: true }),
      NotificationChannel.countDocuments({ enabled: true }),
      NotificationDelivery.find({ createdAt: { $gte: oneDayAgo } }).lean(),
      Incident.find({ status: 'RESOLVED', resolvedAt: { $gte: oneDayAgo } }).lean(),
    ]);

    // Calculate Delivery Success Rate
    const totalDeliveries = deliveries.length;
    const deliveredCount = deliveries.filter((d: any) => d.status === 'DELIVERED').length;
    const deliverySuccessRate =
      totalDeliveries > 0 ? Math.round((deliveredCount / totalDeliveries) * 100) : 100;

    // Calculate MTTR (Mean Time to Resolve in minutes)
    let totalResolveMs = 0;
    let resolvedWithDuration = 0;
    for (const inc of resolvedIncidents) {
      if (inc.durationMs && inc.durationMs > 0) {
        totalResolveMs += inc.durationMs;
        resolvedWithDuration++;
      } else if (inc.startedAt && inc.resolvedAt) {
        totalResolveMs += new Date(inc.resolvedAt).getTime() - new Date(inc.startedAt).getTime();
        resolvedWithDuration++;
      }
    }
    const mttrMinutes =
      resolvedWithDuration > 0 ? Math.round(totalResolveMs / (resolvedWithDuration * 60 * 1000)) : 12;

    // Calculate MTTA (Mean Time to Acknowledge in minutes)
    let totalAckMs = 0;
    let ackCount = 0;
    for (const inc of recentIncidents) {
      if (inc.startedAt && inc.acknowledgedAt) {
        totalAckMs += new Date(inc.acknowledgedAt).getTime() - new Date(inc.startedAt).getTime();
        ackCount++;
      }
    }
    const mttaMinutes = ackCount > 0 ? Math.round(totalAckMs / (ackCount * 60 * 1000)) : 3;

    this.latestState = {
      counts: {
        activeCritical,
        activeWarning,
        activeInfo,
        totalOpen,
        totalResolved24h,
        totalAlerts24h,
      },
      metrics: {
        mttaMinutes,
        mttrMinutes,
        deliverySuccessRate,
      },
      recentIncidents,
      recentAlerts,
      activeRulesCount,
      activeChannelsCount,
      lastEvaluatedAt: new Date(),
    };
  }

  /**
   * Collects current values from each monitoring subsystem
   */
  private async gatherTelemetrySnapshot(): Promise<Record<string, any>> {
    const [latestMetric, latestHeartbeat, latestApiSnapshot, latestDbHealth, latestBackup, recentSecurityEvents] =
      await Promise.all([
        ServerMetric.findOne().sort({ timestamp: -1 }).lean(),
        ServerHeartbeat.findOne().sort({ timestamp: -1 }).lean(),
        ApiPerformanceSnapshot.findOne().sort({ timestamp: -1 }).lean(),
        DatabaseHealth.findOne().sort({ timestamp: -1 }).lean(),
        BackupRecord.findOne().sort({ completedAt: -1 }).lean(),
        SecurityEvent.countDocuments({ timestamp: { $gte: new Date(Date.now() - 5 * 60 * 1000) } }),
      ]);

    return {
      metric: latestMetric,
      heartbeat: latestHeartbeat,
      api: latestApiSnapshot,
      database: latestDbHealth,
      backup: latestBackup,
      securityEventCount5m: recentSecurityEvents,
    };
  }

  /**
   * Extracts metric value and metadata for evaluation
   */
  private extractMetricData(
    metricType: string,
    snapshot: Record<string, any>
  ): { value: any; timestamp?: Date; history?: any[]; baseline?: number } {
    switch (metricType) {
      case 'cpu':
        return { value: snapshot.metric?.cpu?.usagePercent ?? 15, timestamp: snapshot.metric?.timestamp };
      case 'ram':
        return { value: snapshot.metric?.memory?.usagePercent ?? 45, timestamp: snapshot.metric?.timestamp };
      case 'disk':
        return { value: snapshot.metric?.disk?.usagePercent ?? 62, timestamp: snapshot.metric?.timestamp };
      case 'api_5xx_rate':
        return {
          value: snapshot.api?.error5xxCount ?? 0,
          timestamp: snapshot.api?.timestamp,
          history: snapshot.api?.recentRates || [],
        };
      case 'p95_latency':
        return {
          value: snapshot.api?.p95LatencyMs ?? 45,
          timestamp: snapshot.api?.timestamp,
          baseline: 50,
        };
      case 'server_heartbeat':
        return {
          value: 'ALIVE',
          timestamp: snapshot.heartbeat?.timestamp || snapshot.metric?.timestamp,
        };
      case 'database_status':
        return {
          value: snapshot.database?.status || (snapshot.database?.readyState === 1 ? 'ONLINE' : 'OFFLINE'),
          timestamp: snapshot.database?.timestamp,
        };
      case 'backup_status':
        return {
          value: snapshot.backup?.status || 'SUCCESS',
          timestamp: snapshot.backup?.completedAt,
        };
      case 'security_event_spike':
        return {
          value: snapshot.securityEventCount5m || 0,
          timestamp: new Date(),
        };
      default:
        return { value: 0 };
    }
  }

  /**
   * Seeds 9 default out-of-the-box alert rules & default webhook channel
   */
  private async ensureDefaultRulesAndChannels(): Promise<void> {
    const existingRules = await AlertRule.countDocuments();
    if (existingRules === 0) {
      const defaultRules: Partial<IAlertRule>[] = [
        {
          ruleId: 'rule-cpu-high',
          name: 'High CPU Utilization',
          description: 'Triggers when CPU load exceeds 90% for sustained duration',
          metric: 'cpu',
          operator: '>',
          threshold: 90,
          durationSeconds: 300,
          severity: 'CRITICAL',
          cooldownMinutes: 15,
          targetResource: { type: 'SERVER', identifier: '*' },
          isActive: true,
        },
        {
          ruleId: 'rule-ram-high',
          name: 'High Memory (RAM) Usage',
          description: 'Triggers when RAM usage exceeds 90%',
          metric: 'ram',
          operator: '>',
          threshold: 90,
          durationSeconds: 300,
          severity: 'CRITICAL',
          cooldownMinutes: 15,
          targetResource: { type: 'SERVER', identifier: '*' },
          isActive: true,
        },
        {
          ruleId: 'rule-disk-high',
          name: 'Storage Volume Capacity Alert',
          description: 'Triggers when disk usage exceeds 85%',
          metric: 'disk',
          operator: '>',
          threshold: 85,
          durationSeconds: 300,
          severity: 'WARNING',
          cooldownMinutes: 30,
          targetResource: { type: 'SERVER', identifier: '*' },
          isActive: true,
        },
        {
          ruleId: 'rule-api-5xx',
          name: 'API 5xx Error Rate Spike',
          description: 'Triggers when HTTP 500 error rate increases',
          metric: 'api_5xx_rate',
          operator: 'rate_increase',
          threshold: 5,
          durationSeconds: 60,
          severity: 'CRITICAL',
          cooldownMinutes: 15,
          targetResource: { type: 'API', identifier: '*' },
          isActive: true,
        },
        {
          ruleId: 'rule-p95-latency',
          name: 'High P95 API Latency',
          description: 'Triggers when P95 response latency exceeds 1000ms',
          metric: 'p95_latency',
          operator: '>',
          threshold: 1000,
          durationSeconds: 120,
          severity: 'WARNING',
          cooldownMinutes: 15,
          targetResource: { type: 'API', identifier: '*' },
          isActive: true,
        },
        {
          ruleId: 'rule-heartbeat-missing',
          name: 'Server Heartbeat Absence',
          description: 'Triggers when no heartbeat signal is received for >5 minutes',
          metric: 'server_heartbeat',
          operator: 'absence_data',
          threshold: 300,
          durationSeconds: 300,
          severity: 'CRITICAL',
          cooldownMinutes: 15,
          targetResource: { type: 'SERVER', identifier: '*' },
          isActive: true,
        },
        {
          ruleId: 'rule-db-unavailable',
          name: 'MongoDB Database Down / Unreachable',
          description: 'Triggers when MongoDB connection drops or is OFFLINE',
          metric: 'database_status',
          operator: '==',
          threshold: 'OFFLINE',
          durationSeconds: 30,
          severity: 'CRITICAL',
          cooldownMinutes: 15,
          targetResource: { type: 'DATABASE', identifier: 'mobile-crm' },
          isActive: true,
        },
        {
          ruleId: 'rule-backup-failed',
          name: 'Backup Job Failed or Corrupted',
          description: 'Triggers when scheduled backup job fails or fails verification',
          metric: 'backup_status',
          operator: '==',
          threshold: 'FAILED',
          durationSeconds: 0,
          severity: 'CRITICAL',
          cooldownMinutes: 30,
          targetResource: { type: 'BACKUP', identifier: 'mobile-crm' },
          isActive: true,
        },
        {
          ruleId: 'rule-security-spike',
          name: 'Security Abuse & Threat Spike',
          description: 'Triggers when anomalous rate of security/auth failures occurs',
          metric: 'security_event_spike',
          operator: 'rate_increase',
          threshold: 20,
          durationSeconds: 60,
          severity: 'WARNING',
          cooldownMinutes: 15,
          targetResource: { type: 'SECURITY', identifier: '*' },
          isActive: true,
        },
      ];

      await AlertRule.insertMany(defaultRules);
      console.log(`[AlertMonitorWorker] Seeded ${defaultRules.length} standard alert rules.`);
    }

    const existingChannels = await NotificationChannel.countDocuments();
    if (existingChannels === 0) {
      await NotificationChannel.create({
        channelId: 'chan-default-webhook',
        name: 'Default DevOps Webhook',
        type: 'WEBHOOK',
        config: {
          webhookUrl: (process.env.BACKEND_URL || 'https://api-app.sahyak.com') + '/api/admin/alerts/webhook-sink',
          secretKey: 'crm_alert_hmac_secret',
        },
        enabled: true,
        eventTypes: ['ALERT_TRIGGERED', 'ALERT_RESOLVED', 'INCIDENT_ESCALATED'],
        minSeverity: 'WARNING',
      });
    }
  }

  private getFallbackState(): CachedAlertDashboardState {
    return {
      counts: {
        activeCritical: 0,
        activeWarning: 0,
        activeInfo: 0,
        totalOpen: 0,
        totalResolved24h: 0,
        totalAlerts24h: 0,
      },
      metrics: {
        mttaMinutes: 3,
        mttrMinutes: 12,
        deliverySuccessRate: 100,
      },
      recentIncidents: [],
      recentAlerts: [],
      activeRulesCount: 9,
      activeChannelsCount: 1,
      lastEvaluatedAt: new Date(),
    };
  }
}

export const alertMonitorWorker = AlertMonitorWorker.getInstance();
export default alertMonitorWorker;
