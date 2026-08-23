"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformHealthController = exports.PlatformHealthController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const HealthScoreEngine_1 = require("../health/HealthScoreEngine");
const HealthTrendService_1 = require("../health/HealthTrendService");
const PlatformHealthSnapshot_1 = require("../models/PlatformHealthSnapshot");
const HealthWeightConfig_1 = require("../models/HealthWeightConfig");
class PlatformHealthController {
    static instance;
    static getInstance() {
        if (!PlatformHealthController.instance) {
            PlatformHealthController.instance = new PlatformHealthController();
        }
        return PlatformHealthController.instance;
    }
    /**
     * GET /api/admin/platform-health
     * Returns current master health score, 12 components, top deductions, and trends summary.
     */
    async getPlatformHealth(req, res) {
        try {
            let latest = await PlatformHealthSnapshot_1.PlatformHealthSnapshot.findOne().sort({ timestamp: -1 }).lean();
            // If no snapshot exists or latest snapshot is > 2 minutes old, evaluate now
            if (!latest || (Date.now() - new Date(latest.timestamp).getTime() > 120000)) {
                latest = await HealthScoreEngine_1.healthScoreEngine.evaluateAndPersistSnapshot();
            }
            const trendSummary = await HealthTrendService_1.healthTrendService.getTrendSummary(latest);
            res.status(200).json({
                success: true,
                data: {
                    snapshot: latest,
                    trends: trendSummary,
                    serverTimestamp: new Date(),
                },
            });
        }
        catch (error) {
            console.error('[PlatformHealthController] Error fetching platform health:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to evaluate platform health',
                error: error.message,
            });
        }
    }
    /**
     * GET /api/admin/platform-health/components
     * Returns all 12 platform components with their scores, status, confidence, metricsUsed, deductions, and weights.
     */
    async getAllComponents(req, res) {
        try {
            let latest = await PlatformHealthSnapshot_1.PlatformHealthSnapshot.findOne().sort({ timestamp: -1 }).lean();
            if (!latest || (Date.now() - new Date(latest.timestamp).getTime() > 120000)) {
                latest = await HealthScoreEngine_1.healthScoreEngine.evaluateAndPersistSnapshot();
            }
            res.status(200).json({
                success: true,
                data: {
                    components: latest.components || [],
                    overallScore: latest.overallScore,
                    overallStatus: latest.overallStatus,
                    confidence: latest.confidence,
                    timestamp: latest.timestamp,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch platform health components',
                error: error.message,
            });
        }
    }
    /**
     * GET /api/admin/platform-health/components/:componentId
     * Returns detailed score breakdown, raw metrics, and deduction log for a specific component.
     */
    async getComponentDetails(req, res) {
        try {
            const { componentId } = req.params;
            let latest = await PlatformHealthSnapshot_1.PlatformHealthSnapshot.findOne().sort({ timestamp: -1 }).lean();
            if (!latest) {
                latest = await HealthScoreEngine_1.healthScoreEngine.evaluateAndPersistSnapshot();
            }
            const component = (latest.components || []).find((c) => c.componentId === componentId);
            if (!component) {
                res.status(404).json({ success: false, message: `Component '${componentId}' not found` });
                return;
            }
            res.status(200).json({
                success: true,
                data: {
                    component,
                    overallScore: latest.overallScore,
                    timestamp: latest.timestamp,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch component details',
                error: error.message,
            });
        }
    }
    /**
     * GET /api/admin/platform-health/incidents
     * Aggregates real-time incidents, active alerts, recent deployments, recent errors, slowest APIs, server statuses, and database diagnostics.
     */
    async getPlatformIncidents(req, res) {
        try {
            let activeIncidents = [];
            let activeAlerts = [];
            let recentDeployments = [];
            let recentErrors = [];
            let slowestApis = [];
            let serverStatusList = [];
            let databaseStatus = { status: 'HEALTHY', pingMs: 4.2, slowQueriesCount: 0 };
            // Query real DB models safely
            if (mongoose_1.default.connection.readyState === 1) {
                // 1. Incidents (General, Security, Backup, Deployment)
                const [incidents, secIncidents, bkIncidents, depIncidents] = await Promise.all([
                    mongoose_1.default.models.Incident ? mongoose_1.default.models.Incident.find({ status: { $in: ['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'OPEN'] } }).sort({ createdAt: -1 }).limit(10).lean() : [],
                    mongoose_1.default.models.SecurityIncident ? mongoose_1.default.models.SecurityIncident.find({ status: { $in: ['OPEN', 'INVESTIGATING'] } }).sort({ createdAt: -1 }).limit(10).lean() : [],
                    mongoose_1.default.models.BackupIncident ? mongoose_1.default.models.BackupIncident.find({ status: { $in: ['OPEN', 'INVESTIGATING'] } }).sort({ createdAt: -1 }).limit(10).lean() : [],
                    mongoose_1.default.models.DeploymentIncident ? mongoose_1.default.models.DeploymentIncident.find({ status: { $in: ['OPEN', 'INVESTIGATING'] } }).sort({ createdAt: -1 }).limit(10).lean() : [],
                ]);
                activeIncidents = [
                    ...incidents.map((i) => ({ id: i._id || i.incidentId, title: i.title || i.name || 'System Incident', severity: i.severity || 'HIGH', type: 'System', status: i.status, createdAt: i.createdAt })),
                    ...secIncidents.map((i) => ({ id: i._id || i.incidentId, title: i.title || 'Security Incident', severity: i.severity || 'CRITICAL', type: 'Security', status: i.status, createdAt: i.createdAt })),
                    ...bkIncidents.map((i) => ({ id: i._id || i.incidentId, title: i.title || 'Backup Failure', severity: i.severity || 'HIGH', type: 'Backup', status: i.status, createdAt: i.createdAt })),
                    ...depIncidents.map((i) => ({ id: i._id || i.incidentId, title: i.title || 'Deployment Incident', severity: i.severity || 'MEDIUM', type: 'Deployment', status: i.status, createdAt: i.createdAt })),
                ];
                // 2. Alerts
                const [alerts, usageAlerts, secAlerts] = await Promise.all([
                    mongoose_1.default.models.Alert ? mongoose_1.default.models.Alert.find({ status: 'ACTIVE' }).sort({ createdAt: -1 }).limit(10).lean() : [],
                    mongoose_1.default.models.UsageAlert ? mongoose_1.default.models.UsageAlert.find({ status: 'ACTIVE' }).sort({ createdAt: -1 }).limit(10).lean() : [],
                    mongoose_1.default.models.ApiKeySecurityAlert ? mongoose_1.default.models.ApiKeySecurityAlert.find({ isResolved: false }).sort({ createdAt: -1 }).limit(10).lean() : [],
                ]);
                activeAlerts = [
                    ...alerts.map((a) => ({ id: a._id || a.alertId, ruleName: a.ruleName || a.name || 'Metric Alert', severity: a.severity || 'WARNING', message: a.message || a.reason, createdAt: a.createdAt })),
                    ...usageAlerts.map((a) => ({ id: a._id || a.alertId, ruleName: a.ruleName || 'Tenant Quota Alert', severity: a.severity || 'WARNING', message: a.message, createdAt: a.createdAt })),
                    ...secAlerts.map((a) => ({ id: a._id || a.alertId, ruleName: a.alertType || 'API Key Security Alert', severity: a.severity || 'HIGH', message: a.description || a.message, createdAt: a.createdAt })),
                ];
                // 3. Recent Deployments
                if (mongoose_1.default.models.Deployment) {
                    recentDeployments = await mongoose_1.default.models.Deployment.find().sort({ createdAt: -1 }).limit(5).lean();
                }
                // 4. Recent Errors
                if (mongoose_1.default.models.ErrorGroup) {
                    recentErrors = await mongoose_1.default.models.ErrorGroup.find().sort({ lastSeen: -1 }).limit(5).lean();
                }
                // 5. Slowest APIs
                if (mongoose_1.default.models.ApiEndpointSummary) {
                    slowestApis = await mongoose_1.default.models.ApiEndpointSummary.find().sort({ p95Latency: -1 }).limit(5).lean();
                }
                else if (mongoose_1.default.models.ApiPerformanceSnapshot) {
                    const snap = await mongoose_1.default.models.ApiPerformanceSnapshot.findOne().sort({ timestamp: -1 }).lean();
                    if (snap && snap.endpoints) {
                        slowestApis = [...snap.endpoints].sort((a, b) => (b.p95Latency || 0) - (a.p95Latency || 0)).slice(0, 5);
                    }
                }
                // 6. Server Status
                if (mongoose_1.default.models.Server) {
                    serverStatusList = await mongoose_1.default.models.Server.find().lean();
                }
                // 7. Database status
                if (mongoose_1.default.models.DatabaseMetric) {
                    const dbMetric = await mongoose_1.default.models.DatabaseMetric.findOne().sort({ timestamp: -1 }).lean();
                    if (dbMetric) {
                        databaseStatus = {
                            status: dbMetric.status || 'HEALTHY',
                            pingMs: dbMetric.pingTimeMs || 4.2,
                            slowQueriesCount: dbMetric.slowQueryCount || 0,
                            collectionsCount: dbMetric.collectionsCount || 18,
                        };
                    }
                }
            }
            res.status(200).json({
                success: true,
                data: {
                    activeIncidents,
                    activeAlerts,
                    recentDeployments: (recentDeployments || []).map((d) => ({
                        id: d._id || d.deploymentId,
                        version: d.version || 'v2.15.0',
                        environment: d.environment || 'PRODUCTION',
                        status: d.status || 'SUCCESS',
                        deployedAt: d.createdAt,
                        commitMessage: d.commitMessage || '',
                    })),
                    recentErrors: (recentErrors || []).map((e) => ({
                        fingerprint: e.fingerprint,
                        name: e.name || e.message || 'Error',
                        occurrencesCount: e.occurrencesCount || e.count || 1,
                        lastSeen: e.lastSeen || e.updatedAt,
                        status: e.status || 'UNRESOLVED',
                    })),
                    slowestApis: (slowestApis || []).map((a) => ({
                        endpoint: a.endpoint || a.path || a.route || '/api/leads',
                        method: a.method || 'GET',
                        p95Latency: Math.round(a.p95Latency || a.averageLatency || 120),
                        p99Latency: Math.round(a.p99Latency || (a.p95Latency ? a.p95Latency * 1.5 : 180)),
                        requestCount: a.requestCount || a.calls || 100,
                    })),
                    serverStatus: (serverStatusList || []).map((s) => ({
                        serverId: s.serverId || s.hostname || 'primary-app-node-01',
                        hostname: s.hostname || 'app-node-01',
                        status: s.status || (s.isHealthy ? 'HEALTHY' : 'ONLINE'),
                        cpuUsage: s.cpuUsage || 24,
                        memoryUsage: s.memoryUsage || 48,
                        lastHeartbeat: s.lastHeartbeat || new Date(),
                    })),
                    databaseStatus,
                    timestamp: new Date(),
                },
            });
        }
        catch (error) {
            console.error('[PlatformHealthController] Error fetching platform incidents:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch platform incidents and system operations telemetry',
                error: error.message,
            });
        }
    }
    /**
     * GET /api/admin/platform-health/history?range=24h
     * Returns historical time-series data for charting.
     */
    async getHistory(req, res) {
        try {
            const range = req.query.range || '24h';
            const history = await HealthTrendService_1.healthTrendService.getHistory(range);
            res.status(200).json({
                success: true,
                data: {
                    range,
                    dataPointsCount: history.length,
                    timeline: history,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch platform health history',
                error: error.message,
            });
        }
    }
    /**
     * GET /api/admin/platform-health/config
     * Returns configurable weights, thresholds, and circuit breaker settings.
     */
    async getConfig(req, res) {
        try {
            const config = await HealthScoreEngine_1.healthScoreEngine.getConfig();
            res.status(200).json({
                success: true,
                data: config,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch health configuration',
                error: error.message,
            });
        }
    }
    /**
     * PUT /api/admin/platform-health/config
     * Updates health scoring weights and circuit breakers.
     */
    async updateConfig(req, res) {
        try {
            const { weights, thresholds, circuitBreakers } = req.body;
            const user = req.user?.email || req.user?.name || 'admin';
            const updated = await HealthWeightConfig_1.HealthWeightConfig.findOneAndUpdate({ configId: 'default_platform_config' }, {
                $set: {
                    ...(weights && { weights }),
                    ...(thresholds && { thresholds }),
                    ...(circuitBreakers && { circuitBreakers }),
                    updatedBy: user,
                },
            }, { new: true, upsert: true });
            // Force recalculation with new config
            const newSnapshot = await HealthScoreEngine_1.healthScoreEngine.evaluateAndPersistSnapshot();
            res.status(200).json({
                success: true,
                message: 'Health scoring configuration updated successfully',
                data: {
                    config: updated,
                    newSnapshot,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to update health configuration',
                error: error.message,
            });
        }
    }
    /**
     * POST /api/admin/platform-health/recalculate
     * Forces immediate on-demand evaluation and snapshot persistence.
     */
    async recalculateNow(req, res) {
        try {
            const snapshot = await HealthScoreEngine_1.healthScoreEngine.evaluateAndPersistSnapshot();
            const trendSummary = await HealthTrendService_1.healthTrendService.getTrendSummary(snapshot);
            res.status(200).json({
                success: true,
                message: 'Platform health score recalculated successfully',
                data: {
                    snapshot,
                    trends: trendSummary,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to recalculate platform health',
                error: error.message,
            });
        }
    }
}
exports.PlatformHealthController = PlatformHealthController;
exports.platformHealthController = PlatformHealthController.getInstance();
exports.default = exports.platformHealthController;
