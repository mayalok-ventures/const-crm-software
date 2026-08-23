import { Request, Response } from 'express';
import crypto from 'crypto';
import { AlertRule } from '../models/AlertRule';
import { Alert } from '../models/Alert';
import { Incident } from '../models/Incident';
import { NotificationChannel } from '../models/NotificationChannel';
import { NotificationDelivery } from '../models/NotificationDelivery';
import { alertMonitorWorker } from '../alerts/AlertMonitorWorker';
import { incidentManager } from '../alerts/incidentManager';
import { notificationEngine } from '../alerts/notificationEngine';
import { alertEngine } from '../alerts/alertEngine';
import { alertDeduplicator } from '../alerts/alertDeduplicator';

/**
 * GET /api/admin/alerts/overview
 */
export const getAlertOverview = async (req: Request, res: Response) => {
  try {
    const cached = alertMonitorWorker.getLatestState();
    return res.json({
      success: true,
      data: cached,
    });
  } catch (error: any) {
    console.error('Error fetching alert overview:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch alert overview' });
  }
};

/**
 * GET /api/admin/alerts/incidents
 */
export const getIncidents = async (req: Request, res: Response) => {
  try {
    const { status, severity, search, limit = '50', skip = '0' } = req.query;

    const query: Record<string, any> = {};
    if (status && status !== 'ALL') {
      if (status === 'RESOLVED') {
        query.status = 'RESOLVED';
      } else {
        query.status = status;
      }
    }
    if (severity && severity !== 'ALL') {
      query.severity = severity;
    }
    if (search) {
      query.$or = [
        { title: { $regex: String(search), $options: 'i' } },
        { summary: { $regex: String(search), $options: 'i' } },
        { incidentId: { $regex: String(search), $options: 'i' } },
      ];
    }

    const [incidents, total] = await Promise.all([
      Incident.find(query)
        .sort({ startedAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean(),
      Incident.countDocuments(query),
    ]);

    return res.json({
      success: true,
      incidents,
      total,
    });
  } catch (error: any) {
    console.error('Error fetching incidents:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch incidents' });
  }
};

/**
 * GET /api/admin/alerts/incidents/:id
 */
export const getIncidentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const incident = await Incident.findOne({
      $or: [{ incidentId: id }, { _id: id }],
    }).lean();

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    return res.json({
      success: true,
      incident,
    });
  } catch (error: any) {
    console.error('Error fetching incident details:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch incident details' });
  }
};

/**
 * POST /api/admin/alerts/incidents/:id/acknowledge
 */
export const acknowledgeIncident = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user?.name || (req as any).user?.email || 'ADMIN_OPERATOR';

    const incident = await incidentManager.acknowledgeIncident(id, user);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Refresh cached state
    await alertMonitorWorker.refreshCachedState();

    return res.json({
      success: true,
      message: 'Incident acknowledged successfully',
      incident,
    });
  } catch (error: any) {
    console.error('Error acknowledging incident:', error);
    return res.status(500).json({ success: false, message: 'Failed to acknowledge incident' });
  }
};

/**
 * POST /api/admin/alerts/incidents/:id/resolve
 */
export const resolveIncident = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolutionNotes, rootCause } = req.body;
    const user = (req as any).user?.name || (req as any).user?.email || 'ADMIN_OPERATOR';

    const incident = await incidentManager.resolveIncident(
      id,
      user,
      resolutionNotes || 'Manually marked as resolved by admin',
      rootCause || 'Root cause verified and rectified'
    );

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Refresh cached state
    await alertMonitorWorker.refreshCachedState();

    return res.json({
      success: true,
      message: 'Incident resolved successfully',
      incident,
    });
  } catch (error: any) {
    console.error('Error resolving incident:', error);
    return res.status(500).json({ success: false, message: 'Failed to resolve incident' });
  }
};

/**
 * POST /api/admin/alerts/incidents/:id/escalate
 */
export const escalateIncident = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const incident = await incidentManager.escalateIncident(
      id,
      reason || 'Manual escalation triggered by admin operator'
    );

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    // Refresh cached state
    await alertMonitorWorker.refreshCachedState();

    return res.json({
      success: true,
      message: `Incident escalated to Tier ${incident.escalationLevel}`,
      incident,
    });
  } catch (error: any) {
    console.error('Error escalating incident:', error);
    return res.status(500).json({ success: false, message: 'Failed to escalate incident' });
  }
};

/**
 * GET /api/admin/alerts/rules
 */
export const getAlertRules = async (req: Request, res: Response) => {
  try {
    const rules = await AlertRule.find().sort({ createdAt: -1 }).lean();
    return res.json({
      success: true,
      rules,
    });
  } catch (error: any) {
    console.error('Error fetching alert rules:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch alert rules' });
  }
};

/**
 * POST /api/admin/alerts/rules
 */
export const createAlertRule = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      metric,
      operator,
      threshold,
      durationSeconds = 0,
      severity = 'WARNING',
      cooldownMinutes = 15,
      channels = [],
      targetResource = { type: 'ALL', identifier: '*' },
    } = req.body;

    if (!name || !metric || !operator || threshold === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required rule fields' });
    }

    const ruleId = `rule-${metric}-${Date.now().toString(36)}`;
    const rule = await AlertRule.create({
      ruleId,
      name,
      description,
      metric,
      operator,
      threshold,
      durationSeconds: Number(durationSeconds),
      severity,
      cooldownMinutes: Number(cooldownMinutes),
      channels,
      targetResource,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Alert rule created successfully',
      rule,
    });
  } catch (error: any) {
    console.error('Error creating alert rule:', error);
    return res.status(500).json({ success: false, message: 'Failed to create alert rule' });
  }
};

/**
 * PUT /api/admin/alerts/rules/:id
 */
export const updateAlertRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await AlertRule.findOneAndUpdate(
      { $or: [{ ruleId: id }, { _id: id }] },
      { $set: req.body },
      { new: true }
    );

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Alert rule not found' });
    }

    return res.json({
      success: true,
      message: 'Alert rule updated successfully',
      rule,
    });
  } catch (error: any) {
    console.error('Error updating alert rule:', error);
    return res.status(500).json({ success: false, message: 'Failed to update alert rule' });
  }
};

/**
 * DELETE /api/admin/alerts/rules/:id
 */
export const deleteAlertRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await AlertRule.findOneAndDelete({ $or: [{ ruleId: id }, { _id: id }] });

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Alert rule not found' });
    }

    return res.json({
      success: true,
      message: 'Alert rule deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting alert rule:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete alert rule' });
  }
};

/**
 * POST /api/admin/alerts/rules/:id/toggle
 */
export const toggleAlertRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await AlertRule.findOne({ $or: [{ ruleId: id }, { _id: id }] });

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Alert rule not found' });
    }

    rule.isActive = !rule.isActive;
    await rule.save();

    return res.json({
      success: true,
      message: `Rule ${rule.isActive ? 'activated' : 'deactivated'}`,
      rule,
    });
  } catch (error: any) {
    console.error('Error toggling alert rule:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle alert rule' });
  }
};

/**
 * GET /api/admin/alerts/channels
 */
export const getNotificationChannels = async (req: Request, res: Response) => {
  try {
    const channels = await NotificationChannel.find().sort({ createdAt: -1 }).lean();
    return res.json({
      success: true,
      channels,
    });
  } catch (error: any) {
    console.error('Error fetching notification channels:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notification channels' });
  }
};

/**
 * POST /api/admin/alerts/channels
 */
export const createNotificationChannel = async (req: Request, res: Response) => {
  try {
    const { name, type, config, enabled = true, eventTypes, minSeverity = 'WARNING' } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'Missing name or channel type' });
    }

    const channelId = `chan-${type.toLowerCase()}-${Date.now().toString(36)}`;
    const channel = await NotificationChannel.create({
      channelId,
      name,
      type,
      config: config || {},
      enabled,
      eventTypes: eventTypes || ['ALERT_TRIGGERED', 'ALERT_RESOLVED', 'INCIDENT_ESCALATED'],
      minSeverity,
    });

    return res.status(201).json({
      success: true,
      message: 'Notification channel created successfully',
      channel,
    });
  } catch (error: any) {
    console.error('Error creating notification channel:', error);
    return res.status(500).json({ success: false, message: 'Failed to create notification channel' });
  }
};

/**
 * PUT /api/admin/alerts/channels/:id
 */
export const updateNotificationChannel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const channel = await NotificationChannel.findOneAndUpdate(
      { $or: [{ channelId: id }, { _id: id }] },
      { $set: req.body },
      { new: true }
    );

    if (!channel) {
      return res.status(404).json({ success: false, message: 'Notification channel not found' });
    }

    return res.json({
      success: true,
      message: 'Notification channel updated successfully',
      channel,
    });
  } catch (error: any) {
    console.error('Error updating notification channel:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notification channel' });
  }
};

/**
 * DELETE /api/admin/alerts/channels/:id
 */
export const deleteNotificationChannel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const channel = await NotificationChannel.findOneAndDelete({ $or: [{ channelId: id }, { _id: id }] });

    if (!channel) {
      return res.status(404).json({ success: false, message: 'Notification channel not found' });
    }

    return res.json({
      success: true,
      message: 'Notification channel deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting notification channel:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete notification channel' });
  }
};

/**
 * POST /api/admin/alerts/channels/:id/test
 */
export const testNotificationChannel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const channel = await NotificationChannel.findOne({ $or: [{ channelId: id }, { _id: id }] });

    if (!channel) {
      return res.status(404).json({ success: false, message: 'Notification channel not found' });
    }

    const testEvent = {
      eventType: 'TEST' as const,
      timestamp: new Date(),
      alert: {
        alertId: `alrt-test-${Date.now().toString(36)}`,
        title: 'Simulated Test Alert Notification',
        metricName: 'cpu',
        metricValue: 94.2,
        threshold: 90,
        operator: '>',
        severity: 'WARNING',
        status: 'TRIGGERED',
        triggeredAt: new Date(),
      },
      incident: {
        incidentId: `inc-test-${Date.now().toString(36)}`,
        title: 'Simulated High CPU Load Incident',
        severity: 'WARNING',
        status: 'OPEN',
        summary: 'This is a test notification generated from the Admin Alert Management Console.',
      },
    };

    const results = await notificationEngine.dispatch(testEvent, [channel.channelId]);
    const outcome = results[0]?.result;

    return res.json({
      success: outcome?.success ?? false,
      message: outcome?.success
        ? `Test notification delivered successfully to ${channel.name}`
        : `Delivery attempt notice: ${outcome?.error || 'Provider execution complete'}`,
      outcome,
    });
  } catch (error: any) {
    console.error('Error testing notification channel:', error);
    return res.status(500).json({ success: false, message: 'Failed to dispatch test notification' });
  }
};

/**
 * GET /api/admin/alerts/deliveries
 */
export const getNotificationDeliveries = async (req: Request, res: Response) => {
  try {
    const { limit = '50', skip = '0' } = req.query;
    const [deliveries, total] = await Promise.all([
      NotificationDelivery.find()
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean(),
      NotificationDelivery.countDocuments(),
    ]);

    return res.json({
      success: true,
      deliveries,
      total,
    });
  } catch (error: any) {
    console.error('Error fetching notification deliveries:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notification deliveries' });
  }
};

/**
 * POST /api/admin/alerts/simulate
 * Simulates a metric anomaly to verify end-to-end alert triggering, incident correlation, and notification dispatch
 */
export const simulateAnomaly = async (req: Request, res: Response) => {
  try {
    const { metric = 'cpu', value = 96, severity = 'CRITICAL' } = req.body;

    const ruleId = `rule-${metric}-high`;
    let rule = await AlertRule.findOne({ metric });
    if (!rule) {
      rule = await AlertRule.findOne({ ruleId });
    }

    const alertId = `alrt-sim-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const fingerprint = alertDeduplicator.generateFingerprint(
      rule || { ruleId: 'rule-sim', metric },
      { type: 'SERVER', identifier: 'ip-172-31-18-29' }
    );

    const alert = await Alert.create({
      alertId,
      ruleId: rule?.ruleId || 'rule-sim',
      title: `Simulated Anomaly: ${metric.toUpperCase()} load at ${value}%`,
      metricName: metric,
      metricValue: value,
      threshold: rule?.threshold || 90,
      operator: rule?.operator || '>',
      severity: severity || 'CRITICAL',
      status: 'TRIGGERED',
      fingerprint,
      targetResource: {
        type: 'SERVER',
        identifier: 'ip-172-31-18-29',
        name: 'Production AWS EC2 Primary Node',
      },
      triggeredAt: new Date(),
      details: {
        message: `Simulation injected: ${metric} = ${value}`,
      },
    });

    const incident = await incidentManager.correlateAndUpsertIncident(alert);

    // Dispatch notification
    await notificationEngine.dispatch(
      {
        eventType: 'ALERT_TRIGGERED',
        timestamp: new Date(),
        alert: {
          alertId: alert.alertId,
          title: alert.title,
          metricName: alert.metricName,
          metricValue: alert.metricValue,
          threshold: alert.threshold,
          operator: alert.operator,
          severity: alert.severity,
          status: alert.status,
          triggeredAt: alert.triggeredAt,
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
      rule?.channels || []
    );

    // Refresh cached state
    await alertMonitorWorker.refreshCachedState();

    return res.json({
      success: true,
      message: 'Simulated anomaly processed successfully! Alert triggered & incident correlated.',
      alert,
      incident,
    });
  } catch (error: any) {
    console.error('Error simulating anomaly:', error);
    return res.status(500).json({ success: false, message: 'Failed to simulate anomaly' });
  }
};
