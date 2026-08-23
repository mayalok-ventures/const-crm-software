"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateAnomaly = exports.getNotificationDeliveries = exports.testNotificationChannel = exports.deleteNotificationChannel = exports.updateNotificationChannel = exports.createNotificationChannel = exports.getNotificationChannels = exports.toggleAlertRule = exports.deleteAlertRule = exports.updateAlertRule = exports.createAlertRule = exports.getAlertRules = exports.escalateIncident = exports.resolveIncident = exports.acknowledgeIncident = exports.getIncidentById = exports.getIncidents = exports.getAlertOverview = void 0;
const crypto_1 = __importDefault(require("crypto"));
const AlertRule_1 = require("../models/AlertRule");
const Alert_1 = require("../models/Alert");
const Incident_1 = require("../models/Incident");
const NotificationChannel_1 = require("../models/NotificationChannel");
const NotificationDelivery_1 = require("../models/NotificationDelivery");
const AlertMonitorWorker_1 = require("../alerts/AlertMonitorWorker");
const incidentManager_1 = require("../alerts/incidentManager");
const notificationEngine_1 = require("../alerts/notificationEngine");
const alertDeduplicator_1 = require("../alerts/alertDeduplicator");
/**
 * GET /api/admin/alerts/overview
 */
const getAlertOverview = async (req, res) => {
    try {
        const cached = AlertMonitorWorker_1.alertMonitorWorker.getLatestState();
        return res.json({
            success: true,
            data: cached,
        });
    }
    catch (error) {
        console.error('Error fetching alert overview:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch alert overview' });
    }
};
exports.getAlertOverview = getAlertOverview;
/**
 * GET /api/admin/alerts/incidents
 */
const getIncidents = async (req, res) => {
    try {
        const { status, severity, search, limit = '50', skip = '0' } = req.query;
        const query = {};
        if (status && status !== 'ALL') {
            if (status === 'RESOLVED') {
                query.status = 'RESOLVED';
            }
            else {
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
            Incident_1.Incident.find(query)
                .sort({ startedAt: -1 })
                .skip(Number(skip))
                .limit(Number(limit))
                .lean(),
            Incident_1.Incident.countDocuments(query),
        ]);
        return res.json({
            success: true,
            incidents,
            total,
        });
    }
    catch (error) {
        console.error('Error fetching incidents:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch incidents' });
    }
};
exports.getIncidents = getIncidents;
/**
 * GET /api/admin/alerts/incidents/:id
 */
const getIncidentById = async (req, res) => {
    try {
        const { id } = req.params;
        const incident = await Incident_1.Incident.findOne({
            $or: [{ incidentId: id }, { _id: id }],
        }).lean();
        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }
        return res.json({
            success: true,
            incident,
        });
    }
    catch (error) {
        console.error('Error fetching incident details:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch incident details' });
    }
};
exports.getIncidentById = getIncidentById;
/**
 * POST /api/admin/alerts/incidents/:id/acknowledge
 */
const acknowledgeIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user?.name || req.user?.email || 'ADMIN_OPERATOR';
        const incident = await incidentManager_1.incidentManager.acknowledgeIncident(id, user);
        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }
        // Refresh cached state
        await AlertMonitorWorker_1.alertMonitorWorker.refreshCachedState();
        return res.json({
            success: true,
            message: 'Incident acknowledged successfully',
            incident,
        });
    }
    catch (error) {
        console.error('Error acknowledging incident:', error);
        return res.status(500).json({ success: false, message: 'Failed to acknowledge incident' });
    }
};
exports.acknowledgeIncident = acknowledgeIncident;
/**
 * POST /api/admin/alerts/incidents/:id/resolve
 */
const resolveIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionNotes, rootCause } = req.body;
        const user = req.user?.name || req.user?.email || 'ADMIN_OPERATOR';
        const incident = await incidentManager_1.incidentManager.resolveIncident(id, user, resolutionNotes || 'Manually marked as resolved by admin', rootCause || 'Root cause verified and rectified');
        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }
        // Refresh cached state
        await AlertMonitorWorker_1.alertMonitorWorker.refreshCachedState();
        return res.json({
            success: true,
            message: 'Incident resolved successfully',
            incident,
        });
    }
    catch (error) {
        console.error('Error resolving incident:', error);
        return res.status(500).json({ success: false, message: 'Failed to resolve incident' });
    }
};
exports.resolveIncident = resolveIncident;
/**
 * POST /api/admin/alerts/incidents/:id/escalate
 */
const escalateIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const incident = await incidentManager_1.incidentManager.escalateIncident(id, reason || 'Manual escalation triggered by admin operator');
        if (!incident) {
            return res.status(404).json({ success: false, message: 'Incident not found' });
        }
        // Refresh cached state
        await AlertMonitorWorker_1.alertMonitorWorker.refreshCachedState();
        return res.json({
            success: true,
            message: `Incident escalated to Tier ${incident.escalationLevel}`,
            incident,
        });
    }
    catch (error) {
        console.error('Error escalating incident:', error);
        return res.status(500).json({ success: false, message: 'Failed to escalate incident' });
    }
};
exports.escalateIncident = escalateIncident;
/**
 * GET /api/admin/alerts/rules
 */
const getAlertRules = async (req, res) => {
    try {
        const rules = await AlertRule_1.AlertRule.find().sort({ createdAt: -1 }).lean();
        return res.json({
            success: true,
            rules,
        });
    }
    catch (error) {
        console.error('Error fetching alert rules:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch alert rules' });
    }
};
exports.getAlertRules = getAlertRules;
/**
 * POST /api/admin/alerts/rules
 */
const createAlertRule = async (req, res) => {
    try {
        const { name, description, metric, operator, threshold, durationSeconds = 0, severity = 'WARNING', cooldownMinutes = 15, channels = [], targetResource = { type: 'ALL', identifier: '*' }, } = req.body;
        if (!name || !metric || !operator || threshold === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required rule fields' });
        }
        const ruleId = `rule-${metric}-${Date.now().toString(36)}`;
        const rule = await AlertRule_1.AlertRule.create({
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
    }
    catch (error) {
        console.error('Error creating alert rule:', error);
        return res.status(500).json({ success: false, message: 'Failed to create alert rule' });
    }
};
exports.createAlertRule = createAlertRule;
/**
 * PUT /api/admin/alerts/rules/:id
 */
const updateAlertRule = async (req, res) => {
    try {
        const { id } = req.params;
        const rule = await AlertRule_1.AlertRule.findOneAndUpdate({ $or: [{ ruleId: id }, { _id: id }] }, { $set: req.body }, { new: true });
        if (!rule) {
            return res.status(404).json({ success: false, message: 'Alert rule not found' });
        }
        return res.json({
            success: true,
            message: 'Alert rule updated successfully',
            rule,
        });
    }
    catch (error) {
        console.error('Error updating alert rule:', error);
        return res.status(500).json({ success: false, message: 'Failed to update alert rule' });
    }
};
exports.updateAlertRule = updateAlertRule;
/**
 * DELETE /api/admin/alerts/rules/:id
 */
const deleteAlertRule = async (req, res) => {
    try {
        const { id } = req.params;
        const rule = await AlertRule_1.AlertRule.findOneAndDelete({ $or: [{ ruleId: id }, { _id: id }] });
        if (!rule) {
            return res.status(404).json({ success: false, message: 'Alert rule not found' });
        }
        return res.json({
            success: true,
            message: 'Alert rule deleted successfully',
        });
    }
    catch (error) {
        console.error('Error deleting alert rule:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete alert rule' });
    }
};
exports.deleteAlertRule = deleteAlertRule;
/**
 * POST /api/admin/alerts/rules/:id/toggle
 */
const toggleAlertRule = async (req, res) => {
    try {
        const { id } = req.params;
        const rule = await AlertRule_1.AlertRule.findOne({ $or: [{ ruleId: id }, { _id: id }] });
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
    }
    catch (error) {
        console.error('Error toggling alert rule:', error);
        return res.status(500).json({ success: false, message: 'Failed to toggle alert rule' });
    }
};
exports.toggleAlertRule = toggleAlertRule;
/**
 * GET /api/admin/alerts/channels
 */
const getNotificationChannels = async (req, res) => {
    try {
        const channels = await NotificationChannel_1.NotificationChannel.find().sort({ createdAt: -1 }).lean();
        return res.json({
            success: true,
            channels,
        });
    }
    catch (error) {
        console.error('Error fetching notification channels:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch notification channels' });
    }
};
exports.getNotificationChannels = getNotificationChannels;
/**
 * POST /api/admin/alerts/channels
 */
const createNotificationChannel = async (req, res) => {
    try {
        const { name, type, config, enabled = true, eventTypes, minSeverity = 'WARNING' } = req.body;
        if (!name || !type) {
            return res.status(400).json({ success: false, message: 'Missing name or channel type' });
        }
        const channelId = `chan-${type.toLowerCase()}-${Date.now().toString(36)}`;
        const channel = await NotificationChannel_1.NotificationChannel.create({
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
    }
    catch (error) {
        console.error('Error creating notification channel:', error);
        return res.status(500).json({ success: false, message: 'Failed to create notification channel' });
    }
};
exports.createNotificationChannel = createNotificationChannel;
/**
 * PUT /api/admin/alerts/channels/:id
 */
const updateNotificationChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const channel = await NotificationChannel_1.NotificationChannel.findOneAndUpdate({ $or: [{ channelId: id }, { _id: id }] }, { $set: req.body }, { new: true });
        if (!channel) {
            return res.status(404).json({ success: false, message: 'Notification channel not found' });
        }
        return res.json({
            success: true,
            message: 'Notification channel updated successfully',
            channel,
        });
    }
    catch (error) {
        console.error('Error updating notification channel:', error);
        return res.status(500).json({ success: false, message: 'Failed to update notification channel' });
    }
};
exports.updateNotificationChannel = updateNotificationChannel;
/**
 * DELETE /api/admin/alerts/channels/:id
 */
const deleteNotificationChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const channel = await NotificationChannel_1.NotificationChannel.findOneAndDelete({ $or: [{ channelId: id }, { _id: id }] });
        if (!channel) {
            return res.status(404).json({ success: false, message: 'Notification channel not found' });
        }
        return res.json({
            success: true,
            message: 'Notification channel deleted successfully',
        });
    }
    catch (error) {
        console.error('Error deleting notification channel:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete notification channel' });
    }
};
exports.deleteNotificationChannel = deleteNotificationChannel;
/**
 * POST /api/admin/alerts/channels/:id/test
 */
const testNotificationChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const channel = await NotificationChannel_1.NotificationChannel.findOne({ $or: [{ channelId: id }, { _id: id }] });
        if (!channel) {
            return res.status(404).json({ success: false, message: 'Notification channel not found' });
        }
        const testEvent = {
            eventType: 'TEST',
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
        const results = await notificationEngine_1.notificationEngine.dispatch(testEvent, [channel.channelId]);
        const outcome = results[0]?.result;
        return res.json({
            success: outcome?.success ?? false,
            message: outcome?.success
                ? `Test notification delivered successfully to ${channel.name}`
                : `Delivery attempt notice: ${outcome?.error || 'Provider execution complete'}`,
            outcome,
        });
    }
    catch (error) {
        console.error('Error testing notification channel:', error);
        return res.status(500).json({ success: false, message: 'Failed to dispatch test notification' });
    }
};
exports.testNotificationChannel = testNotificationChannel;
/**
 * GET /api/admin/alerts/deliveries
 */
const getNotificationDeliveries = async (req, res) => {
    try {
        const { limit = '50', skip = '0' } = req.query;
        const [deliveries, total] = await Promise.all([
            NotificationDelivery_1.NotificationDelivery.find()
                .sort({ createdAt: -1 })
                .skip(Number(skip))
                .limit(Number(limit))
                .lean(),
            NotificationDelivery_1.NotificationDelivery.countDocuments(),
        ]);
        return res.json({
            success: true,
            deliveries,
            total,
        });
    }
    catch (error) {
        console.error('Error fetching notification deliveries:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch notification deliveries' });
    }
};
exports.getNotificationDeliveries = getNotificationDeliveries;
/**
 * POST /api/admin/alerts/simulate
 * Simulates a metric anomaly to verify end-to-end alert triggering, incident correlation, and notification dispatch
 */
const simulateAnomaly = async (req, res) => {
    try {
        const { metric = 'cpu', value = 96, severity = 'CRITICAL' } = req.body;
        const ruleId = `rule-${metric}-high`;
        let rule = await AlertRule_1.AlertRule.findOne({ metric });
        if (!rule) {
            rule = await AlertRule_1.AlertRule.findOne({ ruleId });
        }
        const alertId = `alrt-sim-${Date.now()}-${crypto_1.default.randomBytes(3).toString('hex')}`;
        const fingerprint = alertDeduplicator_1.alertDeduplicator.generateFingerprint(rule || { ruleId: 'rule-sim', metric }, { type: 'SERVER', identifier: 'ip-172-31-18-29' });
        const alert = await Alert_1.Alert.create({
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
        const incident = await incidentManager_1.incidentManager.correlateAndUpsertIncident(alert);
        // Dispatch notification
        await notificationEngine_1.notificationEngine.dispatch({
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
        }, rule?.channels || []);
        // Refresh cached state
        await AlertMonitorWorker_1.alertMonitorWorker.refreshCachedState();
        return res.json({
            success: true,
            message: 'Simulated anomaly processed successfully! Alert triggered & incident correlated.',
            alert,
            incident,
        });
    }
    catch (error) {
        console.error('Error simulating anomaly:', error);
        return res.status(500).json({ success: false, message: 'Failed to simulate anomaly' });
    }
};
exports.simulateAnomaly = simulateAnomaly;
