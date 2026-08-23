"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateThresholds = exports.recordTelemetry = exports.checkIntegration = exports.getIntegrationById = exports.getOverview = void 0;
const ExternalIntegration_1 = require("../models/ExternalIntegration");
const integrationTelemetryService_1 = require("../integrations/integrationTelemetryService");
/**
 * GET /api/admin/integrations/overview
 * Returns dashboard summary and all monitored third-party integrations
 */
const getOverview = async (req, res) => {
    try {
        const integrations = await ExternalIntegration_1.ExternalIntegration.find().sort({ category: 1, name: 1 });
        const total = integrations.length;
        const healthy = integrations.filter((i) => i.status === 'HEALTHY').length;
        const degraded = integrations.filter((i) => i.status === 'DEGRADED').length;
        const down = integrations.filter((i) => i.status === 'DOWN').length;
        const totalRequests = integrations.reduce((acc, curr) => acc + (curr.totalRequests || 0), 0);
        const avgScore = total > 0 ? Math.round(integrations.reduce((acc, curr) => acc + (curr.healthScore || 0), 0) / total) : 100;
        const avgErrorRate = total > 0 ? Math.round((integrations.reduce((acc, curr) => acc + (curr.errorRate || 0), 0) / total) * 10) / 10 : 0;
        return res.status(200).json({
            success: true,
            summary: {
                totalIntegrations: total,
                healthyCount: healthy,
                degradedCount: degraded,
                downCount: down,
                overallHealthScore: avgScore,
                totalRequests,
                avgErrorRate,
                lastChecked: new Date(),
            },
            integrations,
        });
    }
    catch (error) {
        console.error('Error fetching external integration overview:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch integration overview',
            error: error.message,
        });
    }
};
exports.getOverview = getOverview;
/**
 * GET /api/admin/integrations/:id
 * Drill-down detail with request counts, success rate, latency timeline, recent error logs, and health score history
 */
const getIntegrationById = async (req, res) => {
    try {
        const { id } = req.params;
        let integration = null;
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            integration = await ExternalIntegration_1.ExternalIntegration.findById(id);
        }
        if (!integration) {
            integration = await ExternalIntegration_1.ExternalIntegration.findOne({ provider: id.toLowerCase().trim() });
        }
        if (!integration) {
            return res.status(404).json({
                success: false,
                message: 'External integration not found',
            });
        }
        return res.status(200).json({
            success: true,
            integration,
        });
    }
    catch (error) {
        console.error('Error fetching integration detail:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch integration details',
            error: error.message,
        });
    }
};
exports.getIntegrationById = getIntegrationById;
/**
 * POST /api/admin/integrations/:id/check
 * Runs safe on-demand probe for integration without consuming metered billable quota
 */
const checkIntegration = async (req, res) => {
    try {
        const { id } = req.params;
        let integration = null;
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            integration = await ExternalIntegration_1.ExternalIntegration.findById(id);
        }
        if (!integration) {
            integration = await ExternalIntegration_1.ExternalIntegration.findOne({ provider: id.toLowerCase().trim() });
        }
        if (!integration) {
            return res.status(404).json({
                success: false,
                message: 'External integration not found',
            });
        }
        const probeResult = await integrationTelemetryService_1.integrationTelemetryService.performSafeProbe(integration.provider);
        // Record probe telemetry
        const updated = await integrationTelemetryService_1.integrationTelemetryService.recordCall(integration.provider, integration.service, {
            success: probeResult.ok,
            latencyMs: probeResult.latencyMs,
            statusCode: probeResult.statusCode,
            error: probeResult.ok ? undefined : probeResult.message,
            isRealTraffic: false,
        });
        return res.status(200).json({
            success: true,
            message: `Safe probe completed for ${integration.name}: ${probeResult.message}`,
            probeResult,
            integration: updated || integration,
        });
    }
    catch (error) {
        console.error('Error checking integration:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to execute integration probe',
            error: error.message,
        });
    }
};
exports.checkIntegration = checkIntegration;
/**
 * POST /api/admin/integrations/record-telemetry
 * Records telemetry from application services or synthetic test harnesses
 */
const recordTelemetry = async (req, res) => {
    try {
        const { provider, service, success, latencyMs, error, statusCode, isRealTraffic } = req.body;
        if (!provider) {
            return res.status(400).json({
                success: false,
                message: 'Provider name is required',
            });
        }
        const integration = await integrationTelemetryService_1.integrationTelemetryService.recordCall(provider, service, {
            success: Boolean(success),
            latencyMs: Number(latencyMs) || 0,
            error,
            statusCode,
            isRealTraffic: isRealTraffic !== false,
        });
        return res.status(200).json({
            success: true,
            integration,
        });
    }
    catch (error) {
        console.error('Error recording integration telemetry:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to record telemetry',
            error: error.message,
        });
    }
};
exports.recordTelemetry = recordTelemetry;
/**
 * PUT /api/admin/integrations/:id/thresholds
 * Updates alert thresholds for an integration
 */
const updateThresholds = async (req, res) => {
    try {
        const { id } = req.params;
        const { errorRatePercent, maxLatencyMs, consecutiveFailures } = req.body;
        const integration = await ExternalIntegration_1.ExternalIntegration.findById(id);
        if (!integration) {
            return res.status(404).json({
                success: false,
                message: 'External integration not found',
            });
        }
        if (errorRatePercent !== undefined)
            integration.alertThresholds.errorRatePercent = Number(errorRatePercent);
        if (maxLatencyMs !== undefined)
            integration.alertThresholds.maxLatencyMs = Number(maxLatencyMs);
        if (consecutiveFailures !== undefined)
            integration.alertThresholds.consecutiveFailures = Number(consecutiveFailures);
        await integration.save();
        return res.status(200).json({
            success: true,
            message: 'Integration alert thresholds updated successfully',
            integration,
        });
    }
    catch (error) {
        console.error('Error updating integration thresholds:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update alert thresholds',
            error: error.message,
        });
    }
};
exports.updateThresholds = updateThresholds;
exports.default = {
    getOverview: exports.getOverview,
    getIntegrationById: exports.getIntegrationById,
    checkIntegration: exports.checkIntegration,
    recordTelemetry: exports.recordTelemetry,
    updateThresholds: exports.updateThresholds,
};
