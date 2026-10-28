import crypto from 'crypto';
import mongoose from 'mongoose';
import { Incident, IIncident, IncidentSeverity, IncidentStatus } from '../models/Incident';
import { Alert, IAlert } from '../models/Alert';
import { ErrorGroup } from '../models/ErrorGroup';
import { SystemLog } from '../models/SystemLog';
import { alertDeduplicator } from './alertDeduplicator';
import { notificationEngine } from './notificationEngine';

const getIncidentLookupQuery = (incidentId: string) => {
  return mongoose.Types.ObjectId.isValid(incidentId)
    ? { $or: [{ incidentId }, { _id: incidentId }] }
    : { incidentId };
};

export class IncidentManager {
  private static instance: IncidentManager;

  private constructor() {}

  public static getInstance(): IncidentManager {
    if (!IncidentManager.instance) {
      IncidentManager.instance = new IncidentManager();
    }
    return IncidentManager.instance;
  }

  /**
   * Correlates an alert into an existing active incident or spawns a new grouped incident
   */
  public async correlateAndUpsertIncident(alert: IAlert): Promise<IIncident> {
    const now = new Date();
    const resourceKey = alert.targetResource?.identifier || 'default';
    const serverId = alert.targetResource?.type === 'SERVER' ? resourceKey : '';
    const endpoint = alert.targetResource?.type === 'API' ? resourceKey : '';

    // 1. Search for existing active (unresolved) incident for this resource
    const existingIncident = await Incident.findOne({
      status: { $in: ['OPEN', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING'] },
      $or: [
        { 'affectedResources.serverId': serverId ? serverId : { $exists: false } },
        { 'affectedResources.endpoint': endpoint ? endpoint : { $exists: false } },
        { fingerprint: alert.fingerprint },
      ],
    });

    if (existingIncident) {
      // 2. Correlate alert into existing incident
      const alreadyAttached = existingIncident.relatedAlerts?.some(
        (a: any) => a.alertId === alert.alertId
      );

      if (!alreadyAttached) {
        existingIncident.relatedAlerts = existingIncident.relatedAlerts || [];
        existingIncident.relatedAlerts.push({
          alertId: alert.alertId,
          title: alert.title,
          metricName: alert.metricName,
          metricValue: alert.metricValue,
          severity: alert.severity,
          triggeredAt: alert.triggeredAt || now,
        });

        // Escalate severity if new alert is more severe
        if (alert.severity === 'CRITICAL' && existingIncident.severity !== 'CRITICAL') {
          existingIncident.severity = 'CRITICAL';
        }

        existingIncident.timeline.push({
          timestamp: now,
          event: 'ALERT_ATTACHED',
          description: `Correlated alert "${alert.title}" (${alert.metricName} = ${alert.metricValue}) into active incident`,
          actor: 'INCIDENT_CORRELATOR',
        });

        await existingIncident.save();
      }

      // Link alert to incident
      await Alert.updateOne({ alertId: alert.alertId }, { $set: { incidentId: existingIncident.incidentId } });
      return existingIncident;
    }

    // 3. Spawning a new Incident: Correlate related recent errors & logs
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    let relatedErrors: any[] = [];
    let relatedLogs: any[] = [];

    try {
      // Find recent high-count error groups
      const errorDocs = await ErrorGroup.find({
        lastSeen: { $gte: fifteenMinsAgo },
        status: { $ne: 'RESOLVED' },
      })
        .sort({ count: -1 })
        .limit(5)
        .lean();

      relatedErrors = errorDocs.map((e: any) => ({
        errorGroupId: e.groupId || e._id?.toString(),
        name: e.name,
        message: e.message,
        count: e.count || 1,
        lastSeen: e.lastSeen,
      }));

      // Find recent ERROR / WARN structured logs
      const logDocs = await SystemLog.find({
        level: { $in: ['error', 'warn', 'fatal'] },
        timestamp: { $gte: fifteenMinsAgo },
      })
        .sort({ timestamp: -1 })
        .limit(8)
        .lean();

      relatedLogs = logDocs.map((l: any) => ({
        logId: l.logId || l._id?.toString(),
        level: l.level,
        message: l.message,
        timestamp: l.timestamp,
        module: l.module,
      }));
    } catch (corrErr: any) {
      console.warn('[IncidentManager] Correlation lookup notice:', corrErr.message);
    }

    const incidentId = `inc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const initialSummary = `${alert.title} - Metric ${alert.metricName} is ${alert.metricValue} (Threshold: ${alert.operator} ${alert.threshold})`;

    const newIncident = await Incident.create({
      incidentId,
      title: `${alert.severity} Incident: ${alert.title}`,
      summary: initialSummary,
      severity: alert.severity,
      status: 'OPEN',
      startedAt: now,
      triggeredAt: now,
      trigger: {
        metric: alert.metricName,
        operator: alert.operator,
        threshold: alert.threshold,
        value: alert.metricValue,
        ruleId: alert.ruleId,
        alertId: alert.alertId,
      },
      affectedResources: {
        serverId,
        endpoint,
        database: alert.targetResource?.type === 'DATABASE' ? resourceKey : '',
        service: 'crm-backend',
        component: alert.targetResource?.type || 'SYSTEM',
      },
      serverId: serverId || 'ip-172-31-18-29',
      type: alert.severity === 'CRITICAL' ? 'OFFLINE' : 'DEGRADED',
      events: [
        {
          status: 'OPEN',
          timestamp: now,
          reason: alert.title,
        },
      ],
      relatedAlerts: [
        {
          alertId: alert.alertId,
          title: alert.title,
          metricName: alert.metricName,
          metricValue: alert.metricValue,
          severity: alert.severity,
          triggeredAt: alert.triggeredAt || now,
        },
      ],
      relatedErrors,
      relatedLogs,
      timeline: [
        {
          timestamp: now,
          event: 'INCIDENT_TRIGGERED',
          description: `Incident created by alert "${alert.title}" (${alert.metricName} = ${alert.metricValue})`,
          actor: 'SYSTEM',
        },
      ],
      escalationLevel: 1,
      fingerprint: alert.fingerprint,
    });

    // Link alert to incident
    await Alert.updateOne({ alertId: alert.alertId }, { $set: { incidentId } });

    return newIncident;
  }

  /**
   * Acknowledge an active incident
   */
  public async acknowledgeIncident(
    incidentId: string,
    user: string = 'ADMIN_OPERATOR'
  ): Promise<IIncident | null> {
    const now = new Date();
    const incident = await Incident.findOne(getIncidentLookupQuery(incidentId));

    if (!incident) return null;

    incident.status = 'INVESTIGATING';
    incident.acknowledgedAt = now;
    incident.acknowledgedBy = user;
    incident.timeline.push({
      timestamp: now,
      event: 'ACKNOWLEDGED',
      description: `Incident acknowledged by ${user}`,
      actor: user,
    });

    await incident.save();

    // Mark related alerts as ACKNOWLEDGED
    await Alert.updateMany(
      { incidentId: incident.incidentId, status: 'TRIGGERED' },
      { $set: { status: 'ACKNOWLEDGED', acknowledgedAt: now, acknowledgedBy: user } }
    );

    return incident;
  }

  /**
   * Resolve an incident
   */
  public async resolveIncident(
    incidentId: string,
    user: string = 'ADMIN_OPERATOR',
    resolutionNotes: string = 'Metric returned to nominal operating thresholds',
    rootCause: string = 'Transient workload spike resolved'
  ): Promise<IIncident | null> {
    const now = new Date();
    const incident = await Incident.findOne(getIncidentLookupQuery(incidentId));

    if (!incident) return null;

    const durationMs = incident.startedAt ? now.getTime() - new Date(incident.startedAt).getTime() : 0;

    incident.status = 'RESOLVED';
    incident.resolvedAt = now;
    incident.resolvedBy = user;
    incident.durationMs = durationMs;
    incident.resolutionNotes = resolutionNotes;
    incident.rootCause = rootCause;
    incident.timeline.push({
      timestamp: now,
      event: 'RESOLVED',
      description: `Incident marked RESOLVED by ${user}. Notes: ${resolutionNotes}`,
      actor: user,
    });

    await incident.save();

    // Mark related alerts as RESOLVED
    await Alert.updateMany(
      { incidentId: incident.incidentId, status: { $ne: 'RESOLVED' } },
      { $set: { status: 'RESOLVED', resolvedAt: now, resolvedBy: user } }
    );

    // Clear deduplicator cooldown if fingerprint exists
    if (incident.fingerprint) {
      alertDeduplicator.clearCooldown(incident.fingerprint);
    }

    // Dispatch recovery / resolution notification
    await notificationEngine.dispatch({
      eventType: 'ALERT_RESOLVED',
      timestamp: now,
      incident: {
        incidentId: incident.incidentId,
        title: incident.title,
        severity: incident.severity,
        status: 'RESOLVED',
        summary: resolutionNotes,
      },
    });

    return incident;
  }

  /**
   * Escalate an incident to next tier
   */
  public async escalateIncident(
    incidentId: string,
    reason: string = 'SLA response deadline exceeded'
  ): Promise<IIncident | null> {
    const now = new Date();
    const incident = await Incident.findOne(getIncidentLookupQuery(incidentId));

    if (!incident || incident.status === 'RESOLVED') return null;

    incident.escalationLevel = (incident.escalationLevel || 1) + 1;
    incident.timeline.push({
      timestamp: now,
      event: 'ESCALATED',
      description: `Escalated to Tier ${incident.escalationLevel}: ${reason}`,
      actor: 'ESCALATION_ENGINE',
    });

    await incident.save();

    // Dispatch escalation notification
    await notificationEngine.dispatch({
      eventType: 'INCIDENT_ESCALATED',
      timestamp: now,
      incident: {
        incidentId: incident.incidentId,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        summary: incident.summary,
        escalationLevel: incident.escalationLevel,
      },
    });

    return incident;
  }

  /**
   * Evaluates SLAs for unacknowledged incidents and triggers automatic escalation
   */
  public async checkEscalationSLAs(): Promise<number> {
    const unacknowledgedThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes SLA

    const staleCriticals = await Incident.find({
      status: 'OPEN',
      severity: 'CRITICAL',
      escalationLevel: 1,
      startedAt: { $lte: unacknowledgedThreshold },
    });

    for (const inc of staleCriticals) {
      await this.escalateIncident(inc.incidentId, 'Critical incident unacknowledged for >15 minutes');
    }

    return staleCriticals.length;
  }
}

export const incidentManager = IncidentManager.getInstance();
export default incidentManager;
