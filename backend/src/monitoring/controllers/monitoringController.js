"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiPerformance = exports.getStatusEvents = exports.getHeartbeatHistory = exports.getServerHealth = exports.getMetricHistory = exports.getCurrentMetric = exports.getServerDetails = exports.getServers = exports.handleHeartbeat = exports.MonitoringController = void 0;
const Server_1 = require("../models/Server");
const ServerMetric_1 = require("../models/ServerMetric");
const ServerHeartbeat_1 = require("../models/ServerHeartbeat");
const ServerStatusEvent_1 = require("../models/ServerStatusEvent");
const Incident_1 = require("../models/Incident");
const ApiEndpointSummary_1 = require("../models/ApiEndpointSummary");
const ApiPerformanceSnapshot_1 = require("../models/ApiPerformanceSnapshot");
const HealthScoreCalculator_1 = require("../HealthScoreCalculator");
class MonitoringController {
    healthCalculator = new HealthScoreCalculator_1.HealthScoreCalculator();
    /**
     * Public Heartbeat Ingestion Endpoint
     * POST /api/monitoring/heartbeat
     */
    handleHeartbeat = async (req, res) => {
        try {
            const { serverId, applicationId, environment, timestamp, agentVersion, healthStatus, applicationVersion, } = req.body;
            if (!serverId || !environment || !healthStatus) {
                res.status(400).json({ success: false, message: 'Missing required metadata' });
                return;
            }
            const clientTime = new Date(timestamp || Date.now());
            const now = new Date();
            const latencyMs = now.getTime() - clientTime.getTime();
            // Find or create Server document
            let server = await Server_1.Server.findOne({ serverId });
            const isNew = !server;
            if (isNew) {
                server = await Server_1.Server.create({
                    serverId,
                    name: serverId,
                    hostname: serverId, // fallback
                    environment,
                    status: healthStatus,
                    lastHeartbeat: now,
                    firstSeenAt: now,
                    lastSeenAt: now,
                    nodeVersion: 'unknown',
                    os: 'unknown',
                });
            }
            else {
                server.lastHeartbeat = now;
                server.lastSeenAt = now;
                server.status = healthStatus;
                await server.save();
            }
            // Record Heartbeat ping
            await ServerHeartbeat_1.ServerHeartbeat.create({
                serverId,
                applicationId,
                environment,
                timestamp: now,
                agentVersion,
                healthStatus,
                applicationVersion,
                latencyMs,
            });
            res.status(200).json({ success: true, message: 'Heartbeat registered', latencyMs });
        }
        catch (error) {
            console.error('[MonitoringController] Heartbeat error:', error);
            res.status(500).json({ success: false, message: error?.message || 'Server error' });
        }
    };
    /**
     * List all registered servers
     * GET /api/admin/monitoring/servers and GET /api/admin/servers
     */
    getServers = async (req, res) => {
        try {
            const servers = await Server_1.Server.find({}).sort({ serverId: 1 }).lean();
            // Calculate uptime statistics for each server
            const serversWithUptime = await Promise.all(servers.map(async (server) => {
                // Uptime percentage is based on incident histories
                const uptimeStats = await this.calculateServerUptimeStats(server.serverId);
                return {
                    ...server,
                    ...uptimeStats
                };
            }));
            res.status(200).json({ success: true, servers: serversWithUptime });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
    /**
     * Get server details
     * GET /api/admin/monitoring/servers/:serverId
     */
    getServerDetails = async (req, res) => {
        try {
            const { serverId } = req.params;
            const server = await Server_1.Server.findOne({ serverId }).lean();
            if (!server) {
                res.status(404).json({ success: false, message: 'Server not found' });
                return;
            }
            const uptimeStats = await this.calculateServerUptimeStats(serverId);
            res.status(200).json({ success: true, server: { ...server, ...uptimeStats } });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
    /**
     * Get current server metric
     * GET /api/admin/monitoring/servers/:serverId/current
     */
    getCurrentMetric = async (req, res) => {
        try {
            const { serverId } = req.params;
            const metric = await ServerMetric_1.ServerMetric.findOne({ serverId })
                .sort({ timestamp: -1 })
                .lean();
            if (!metric) {
                res.status(404).json({ success: false, message: 'No metrics found for server' });
                return;
            }
            res.status(200).json({ success: true, metric });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
    /**
     * Get server metric history
     * GET /api/admin/monitoring/servers/:serverId/history
     */
    getMetricHistory = async (req, res) => {
        try {
            const { serverId } = req.params;
            const { range } = req.query; // '1h' | '6h' | '24h' | '7d' | '30d'
            let cutoff = new Date();
            let useHourly = false;
            if (range === '30d') {
                cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                useHourly = true;
            }
            else if (range === '7d') {
                cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                useHourly = true;
            }
            else if (range === '24h') {
                cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
                useHourly = false;
            }
            else if (range === '6h') {
                cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
                useHourly = false;
            }
            else {
                // default 1h
                cutoff = new Date(Date.now() - 60 * 60 * 1000);
                useHourly = false;
            }
            // Query raw or hourly metrics
            const metrics = await ServerMetric_1.ServerMetric.find({
                serverId,
                timestamp: { $gte: cutoff },
                aggregationType: useHourly ? 'hourly' : 'raw',
            })
                .sort({ timestamp: 1 })
                .lean();
            // If hourly returned nothing, fallback to raw
            if (useHourly && metrics.length === 0) {
                const fallbackRaw = await ServerMetric_1.ServerMetric.find({
                    serverId,
                    timestamp: { $gte: cutoff },
                    aggregationType: 'raw',
                })
                    .sort({ timestamp: 1 })
                    .limit(300)
                    .lean();
                res.status(200).json({ success: true, history: fallbackRaw });
                return;
            }
            res.status(200).json({ success: true, history: metrics });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
    /**
     * Get server health calculation breakdown
     * GET /api/admin/monitoring/servers/:serverId/health and GET /api/admin/servers/:id/health
     */
    getServerHealth = async (req, res) => {
        try {
            const serverId = req.params.serverId || req.params.id;
            const server = (await Server_1.Server.findOne({ serverId }).lean());
            if (!server) {
                res.status(404).json({ success: false, message: 'Server not found' });
                return;
            }
            const lastMetric = (await ServerMetric_1.ServerMetric.findOne({ serverId }).sort({ timestamp: -1 }).lean());
            const weights = { cpu: 0.20, ram: 0.20, disk: 0.15, process: 0.15, uptime: 0.15, network: 0.15 };
            const thresholds = HealthScoreCalculator_1.DEFAULT_THRESHOLDS;
            let scoreBreakdown = { overall: 100, cpu: 100, ram: 100, disk: 100, process: 100, network: 100, uptime: 100 };
            if (lastMetric) {
                scoreBreakdown = this.healthCalculator.calculate({
                    cpuUsage: lastMetric.cpu.usagePercent,
                    ramUsage: lastMetric.ram.usagePercent,
                    diskUsage: lastMetric.disk.usagePercent,
                    processCpu: lastMetric.process.cpuPercent,
                    networkActive: lastMetric.network.uploadBytesSec + lastMetric.network.downloadBytesSec > 0,
                    uptimeSeconds: lastMetric.uptime,
                });
            }
            res.status(200).json({
                success: true,
                health: {
                    serverId,
                    status: server.status,
                    healthScore: scoreBreakdown.overall,
                    breakdown: scoreBreakdown,
                    weights,
                    thresholds,
                    lastSeenAt: server.lastSeenAt,
                },
            });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
    /**
     * Get server heartbeat logs
     * GET /api/admin/servers/:id/heartbeat-history
     */
    getHeartbeatHistory = async (req, res) => {
        try {
            const serverId = req.params.id;
            const heartbeats = await ServerHeartbeat_1.ServerHeartbeat.find({ serverId })
                .sort({ timestamp: -1 })
                .limit(100)
                .lean();
            res.status(200).json({ success: true, heartbeats });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
    /**
     * Get server transition events logs
     * GET /api/admin/servers/:id/status-events
     */
    getStatusEvents = async (req, res) => {
        try {
            const serverId = req.params.id;
            const events = await ServerStatusEvent_1.ServerStatusEvent.find({ serverId })
                .sort({ timestamp: -1 })
                .limit(100)
                .lean();
            res.status(200).json({ success: true, events });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
    /**
     * Get system-wide API performance dashboards metrics
     * GET /api/admin/monitoring/api-performance
     */
    getApiPerformance = async (req, res) => {
        try {
            const { range } = req.query; // '1h' | '6h' | '24h' | '7d'
            let cutoff = new Date();
            if (range === '7d')
                cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            else if (range === '24h')
                cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
            else if (range === '6h')
                cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
            else
                cutoff = new Date(Date.now() - 60 * 60 * 1000); // default 1h
            // Get latest snapshot score
            const latestSnapshot = await ApiPerformanceSnapshot_1.ApiPerformanceSnapshot.findOne({})
                .sort({ timestamp: -1 })
                .lean();
            // Retrieve route aggregated table
            const endpointSummary = await ApiEndpointSummary_1.ApiEndpointSummary.aggregate([
                { $match: { timeBucket: { $gte: cutoff } } },
                {
                    $group: {
                        _id: { route: '$route', method: '$method' },
                        requests: { $sum: '$requests' },
                        avgResponseTime: { $avg: '$avgResponseTime' },
                        p95: { $max: '$p95' },
                        errorsCount: { $sum: '$errorsCount' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        route: '$_id.route',
                        method: '$_id.method',
                        requests: 1,
                        avgResponseTime: { $round: ['$avgResponseTime', 2] },
                        p95: 1,
                        errorsCount: 1,
                        errorRate: {
                            $cond: [
                                { $eq: ['$requests', 0] },
                                0,
                                { $round: [{ $multiply: [{ $divide: ['$errorsCount', '$requests'] }, 100] }, 2] },
                            ],
                        },
                    },
                },
                { $sort: { requests: -1 } },
            ]);
            // Map a health rating for endpoints
            const endpointDetails = endpointSummary.map((ep) => {
                // Simple health: subtract points for high latency and error rate
                let score = 100;
                score -= ep.errorRate * 5; // e.g. 5% error = -25 score
                score -= ep.avgResponseTime / 15; // e.g. 300ms = -20 score
                score = Math.max(0, Math.min(100, Math.round(score)));
                return {
                    ...ep,
                    healthScore: score,
                };
            });
            // Get snapshots list for historical chart
            const snapshotsHistory = await ApiPerformanceSnapshot_1.ApiPerformanceSnapshot.find({
                timestamp: { $gte: cutoff },
            })
                .sort({ timestamp: 1 })
                .lean();
            res.status(200).json({
                success: true,
                performance: {
                    snapshot: latestSnapshot || {
                        overallScore: 100,
                        latencyScore: 100,
                        reliabilityScore: 100,
                        errorRateScore: 100,
                        availabilityScore: 100,
                    },
                    endpoints: endpointDetails,
                    history: snapshotsHistory,
                },
            });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
    /**
     * Helper: Calculate server uptime statistics from incidents
     */
    async calculateServerUptimeStats(serverId) {
        const now = new Date();
        // We'll calculate uptime over the last 30 days
        const rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const incidents = await Incident_1.Incident.find({
            serverId,
            startedAt: { $gte: rangeStart },
        }).lean();
        const totalDurationMs = now.getTime() - rangeStart.getTime();
        let totalDowntimeMs = 0;
        let incidentCount = 0;
        for (const incident of incidents) {
            const start = incident.startedAt.getTime();
            const end = incident.resolvedAt ? incident.resolvedAt.getTime() : now.getTime();
            totalDowntimeMs += (end - start);
            if (incident.type === 'OFFLINE') {
                incidentCount++;
            }
        }
        const uptimePercent = Math.max(0, Math.min(100, 100 - (totalDowntimeMs / totalDurationMs) * 100));
        return {
            uptimePercentage: parseFloat(uptimePercent.toFixed(3)),
            availabilityPercentage: parseFloat(uptimePercent.toFixed(3)),
            downtimeMs: totalDowntimeMs,
            incidentCount,
            incidents: incidents.slice(0, 10), // Limit payload size
        };
    }
}
exports.MonitoringController = MonitoringController;
const controller = new MonitoringController();
exports.default = controller;
exports.handleHeartbeat = controller.handleHeartbeat;
exports.getServers = controller.getServers;
exports.getServerDetails = controller.getServerDetails;
exports.getCurrentMetric = controller.getCurrentMetric;
exports.getMetricHistory = controller.getMetricHistory;
exports.getServerHealth = controller.getServerHealth;
exports.getHeartbeatHistory = controller.getHeartbeatHistory;
exports.getStatusEvents = controller.getStatusEvents;
exports.getApiPerformance = controller.getApiPerformance;
