"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiPerformanceInstance = exports.apiPerformance = exports.ApiPerformanceMiddleware = void 0;
const os_1 = __importDefault(require("os"));
const ApiMetric_1 = require("./models/ApiMetric");
class ApiPerformanceMiddleware {
    buffer = [];
    serverId;
    environment;
    flushInterval = null;
    maxBufferSize = 100;
    flushIntervalMs = 5000;
    constructor() {
        this.serverId = process.env.SERVER_ID || os_1.default.hostname() || 'use-setu-server';
        this.environment = process.env.NODE_ENV || 'development';
        // Periodically flush buffer
        this.flushInterval = setInterval(() => {
            this.flush().catch(err => console.error('[ApiPerformance] Error flushing metrics buffer:', err));
        }, this.flushIntervalMs);
        // Bind flush on exit
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }
    getMiddleware() {
        return (req, res, next) => {
            const requestId = req.headers['x-request-id'] ||
                `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            req.requestId = requestId;
            res.setHeader('X-Request-ID', requestId);
            const startTime = process.hrtime();
            res.on('finish', () => {
                const diff = process.hrtime(startTime);
                const responseTimeMs = (diff[0] * 1e9 + diff[1]) / 1e6;
                let route = req.path;
                if (req.route && req.route.path) {
                    route = req.baseUrl + req.route.path;
                }
                // Avoid logging monitoring routes recursively
                if (route.includes('/monitoring') || route.includes('/heartbeat')) {
                    return;
                }
                const organizationId = req.user?.tenantId || req.user?.companyId || undefined;
                const metric = {
                    route,
                    method: req.method,
                    statusCode: res.statusCode,
                    responseTime: parseFloat(responseTimeMs.toFixed(2)),
                    timestamp: new Date(),
                    requestId,
                    serverId: this.serverId,
                    organizationId: organizationId ? organizationId.toString() : undefined,
                    environment: this.environment,
                };
                this.buffer.push(metric);
                if (this.buffer.length >= this.maxBufferSize) {
                    this.flush().catch(err => console.error('[ApiPerformance] Buffer limit flush error:', err));
                }
            });
            next();
        };
    }
    async flush() {
        if (this.buffer.length === 0)
            return;
        const metricsToSave = [...this.buffer];
        this.buffer = [];
        try {
            await ApiMetric_1.ApiMetric.insertMany(metricsToSave, { ordered: false });
        }
        catch (error) {
            console.error(`[ApiPerformance] Failed to bulk write ${metricsToSave.length} API metrics:`, error?.message || error);
        }
    }
    async shutdown() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        console.log('[ApiPerformance] Shutting down, flushing remaining buffer...');
        await this.flush();
    }
}
exports.ApiPerformanceMiddleware = ApiPerformanceMiddleware;
const instance = new ApiPerformanceMiddleware();
exports.apiPerformance = instance.getMiddleware();
exports.apiPerformanceInstance = instance;
exports.default = exports.apiPerformance;
