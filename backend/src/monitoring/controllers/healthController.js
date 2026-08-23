"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDetailed = exports.getReady = exports.getLive = exports.getHealth = void 0;
const HealthCheckService_1 = require("../health/HealthCheckService");
/**
 * GET /health and GET /api/health
 * Standard summary health endpoint
 */
const getHealth = async (req, res) => {
    try {
        const summary = await HealthCheckService_1.healthCheckService.getSummary();
        const statusCode = summary.status === 'UNHEALTHY' ? 503 : 200;
        return res.status(statusCode).json({
            status: summary.status,
            overallScore: summary.overallScore,
            uptimeSeconds: summary.uptimeSeconds,
            timestamp: summary.timestamp,
            components: summary.components,
        });
    }
    catch (error) {
        console.error('Error executing health check:', error);
        return res.status(503).json({
            status: 'UNHEALTHY',
            overallScore: 0,
            error: error.message || 'Health check failed',
            timestamp: new Date(),
        });
    }
};
exports.getHealth = getHealth;
/**
 * GET /health/live and GET /api/health/live
 * Kubernetes Liveness Probe
 */
const getLive = async (req, res) => {
    try {
        const liveness = await HealthCheckService_1.healthCheckService.getLiveness();
        const statusCode = liveness.status === 'UNHEALTHY' ? 500 : 200;
        return res.status(statusCode).json(liveness);
    }
    catch (error) {
        return res.status(500).json({
            status: 'UNHEALTHY',
            liveness: false,
            error: error.message || 'Liveness check failed',
            timestamp: new Date(),
        });
    }
};
exports.getLive = getLive;
/**
 * GET /health/ready and GET /api/health/ready
 * Kubernetes Readiness Probe
 */
const getReady = async (req, res) => {
    try {
        const readiness = await HealthCheckService_1.healthCheckService.getReadiness();
        const statusCode = readiness.ready ? 200 : 503;
        return res.status(statusCode).json(readiness);
    }
    catch (error) {
        return res.status(503).json({
            status: 'UNHEALTHY',
            ready: false,
            error: error.message || 'Readiness check failed',
            timestamp: new Date(),
        });
    }
};
exports.getReady = getReady;
/**
 * GET /health/detailed and GET /api/health/detailed
 * Deep diagnostics with component statuses, latency breakdown, and scores
 */
const getDetailed = async (req, res) => {
    try {
        const forceFresh = req.query.fresh === 'true';
        const detailed = await HealthCheckService_1.healthCheckService.getDetailed(forceFresh);
        const statusCode = detailed.status === 'UNHEALTHY' ? 503 : 200;
        return res.status(statusCode).json(detailed);
    }
    catch (error) {
        console.error('Error executing detailed health check:', error);
        return res.status(503).json({
            status: 'UNHEALTHY',
            overallScore: 0,
            error: error.message || 'Detailed health check failed',
            timestamp: new Date(),
        });
    }
};
exports.getDetailed = getDetailed;
exports.default = {
    getHealth: exports.getHealth,
    getLive: exports.getLive,
    getReady: exports.getReady,
    getDetailed: exports.getDetailed,
};
