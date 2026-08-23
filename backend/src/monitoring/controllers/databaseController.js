"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseHealthEndpoint = getDatabaseHealthEndpoint;
exports.getDatabaseOverview = getDatabaseOverview;
exports.getDatabaseCollections = getDatabaseCollections;
exports.getDatabaseMetrics = getDatabaseMetrics;
exports.getSlowQueries = getSlowQueries;
exports.pingDatabase = pingDatabase;
const DatabaseMonitorWorker_1 = __importDefault(require("../database/DatabaseMonitorWorker"));
const DatabaseMetric_1 = __importDefault(require("../models/DatabaseMetric"));
const SlowQueryMetric_1 = __importDefault(require("../models/SlowQueryMetric"));
const slowQueryInterceptor_1 = __importDefault(require("../database/slowQueryInterceptor"));
/**
 * GET /health/database & GET /api/health/database
 * Dedicated health check for MongoDB database status.
 * Responds with HTTP 200 when operational, or HTTP 503 if disconnected.
 */
async function getDatabaseHealthEndpoint(req, res) {
    const state = DatabaseMonitorWorker_1.default.getLatestState();
    const isHealthy = state.readyState === 1 && state.status !== 'DOWN';
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json({
        status: isHealthy ? 'ok' : 'degraded',
        database: {
            connection: state.connectionState,
            readyState: state.readyState,
            healthScore: state.healthScore,
            status: state.status,
            pingLatencyMs: state.pingLatencyMs,
            availability: `${state.availabilityPercentage.toFixed(2)}%`,
            databaseSize: state.databaseSize.formattedStorageSize,
            collectionsCount: state.totalCollections,
            documentsCount: state.totalDocuments,
            activeConnections: state.connectionCount.current,
            diagnostics: {
                mode: state.diagnostics.mode,
                title: state.diagnostics.title,
                message: state.diagnostics.message,
                isOperational: state.diagnostics.isOperational,
            },
        },
        timestamp: new Date().toISOString(),
    });
}
/**
 * GET /api/admin/database/overview
 * Returns complete database health metrics, score breakdown, connection counts, and cluster state.
 */
async function getDatabaseOverview(req, res) {
    try {
        const state = DatabaseMonitorWorker_1.default.getLatestState();
        res.json({
            success: true,
            database: state,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve database monitoring overview',
            error: err.message,
        });
    }
}
/**
 * GET /api/admin/database/collections
 * Returns collections table with document count, size, index count, and storage breakdown.
 */
async function getDatabaseCollections(req, res) {
    try {
        const state = DatabaseMonitorWorker_1.default.getLatestState();
        res.json({
            success: true,
            totalCollections: state.totalCollections,
            totalDocuments: state.totalDocuments,
            totalStorageSize: state.databaseSize.formattedStorageSize,
            collections: state.collections,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve database collections stats',
            error: err.message,
        });
    }
}
/**
 * GET /api/admin/database/metrics?range=1h|24h|7d
 * Returns historical time-series database metrics (ping latency, connections, DB size).
 */
async function getDatabaseMetrics(req, res) {
    try {
        const range = req.query.range || '1h';
        let durationHours = 1;
        if (range === '6h')
            durationHours = 6;
        if (range === '24h')
            durationHours = 24;
        if (range === '7d')
            durationHours = 168;
        if (range === '30d')
            durationHours = 720;
        const cutoff = new Date(Date.now() - durationHours * 60 * 60 * 1000);
        const metrics = await DatabaseMetric_1.default.find({
            timestamp: { $gte: cutoff },
        })
            .sort({ timestamp: 1 })
            .limit(300)
            .lean();
        res.json({
            success: true,
            range,
            count: metrics.length,
            metrics,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve database metrics history',
            error: err.message,
        });
    }
}
/**
 * GET /api/admin/database/slow-queries
 * Returns list of recent slow operations.
 */
async function getSlowQueries(req, res) {
    try {
        const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
        // Combine recent in-memory buffer with DB records
        const inMemorySlow = slowQueryInterceptor_1.default.getRecentSlowQueries();
        const dbSlow = await SlowQueryMetric_1.default.find()
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
        // Deduplicate by collectionName, timestamp, and durationMs
        const map = new Map();
        for (const q of inMemorySlow) {
            map.set(`${q.collectionName}_${new Date(q.timestamp).getTime()}_${q.durationMs}`, q);
        }
        for (const q of dbSlow) {
            map.set(`${q.collectionName}_${new Date(q.timestamp).getTime()}_${q.durationMs}`, q);
        }
        const queries = Array.from(map.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
        res.json({
            success: true,
            thresholdMs: slowQueryInterceptor_1.default.getThreshold(),
            count: queries.length,
            queries,
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve slow queries',
            error: err.message,
        });
    }
}
/**
 * POST /api/admin/database/ping
 * Executes live manual ping against MongoDB and returns round-trip latency.
 */
async function pingDatabase(req, res) {
    try {
        const result = await DatabaseMonitorWorker_1.default.pingLive();
        res.json({
            success: result.success,
            latencyMs: result.latencyMs,
            message: result.success
                ? `Database ping successful (${result.latencyMs}ms)`
                : `Database ping failed: ${result.error}`,
            error: result.error,
            timestamp: new Date(),
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: 'Database ping test failed',
            error: err.message,
        });
    }
}
exports.default = {
    getDatabaseHealthEndpoint,
    getDatabaseOverview,
    getDatabaseCollections,
    getDatabaseMetrics,
    getSlowQueries,
    pingDatabase,
};
