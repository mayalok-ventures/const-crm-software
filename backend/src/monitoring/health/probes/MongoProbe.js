"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongoProbe = exports.MongoProbe = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
class MongoProbe {
    /**
     * Probes MongoDB connection and ping response
     */
    async probe() {
        const startTime = Date.now();
        try {
            const readyState = mongoose_1.default.connection.readyState;
            const stateMap = {
                0: 'disconnected',
                1: 'connected',
                2: 'connecting',
                3: 'disconnecting',
            };
            const stateStr = stateMap[readyState] || 'unknown';
            if (readyState !== 1 || !mongoose_1.default.connection.db) {
                return {
                    name: 'MongoDB',
                    category: 'database',
                    status: 'UNHEALTHY',
                    score: 0,
                    latencyMs: Math.max(1, Date.now() - startTime),
                    isCritical: true,
                    message: `MongoDB connection state is ${stateStr} (readyState: ${readyState})`,
                    details: {
                        connectionState: stateStr,
                        readyState,
                        databaseName: mongoose_1.default.connection.name || 'mobile-crm',
                        isOperational: false,
                    },
                    error: 'Database disconnected or not ready',
                    timestamp: new Date(),
                };
            }
            // Execute ping
            const pingStart = Date.now();
            const pingResult = await mongoose_1.default.connection.db.admin().ping();
            const pingLatencyMs = Math.max(1, Date.now() - pingStart);
            let score = 100;
            let status = 'HEALTHY';
            const issues = [];
            if (pingLatencyMs > 1000) {
                score = 50;
                status = 'DEGRADED';
                issues.push(`High database ping latency: ${pingLatencyMs}ms`);
            }
            else if (pingLatencyMs > 400) {
                score = 80;
                status = 'DEGRADED';
                issues.push(`Elevated ping latency: ${pingLatencyMs}ms`);
            }
            const latencyMs = Math.max(1, Date.now() - startTime);
            return {
                name: 'MongoDB',
                category: 'database',
                status,
                score,
                latencyMs: pingLatencyMs,
                isCritical: true,
                message: issues.length > 0 ? issues.join(', ') : `MongoDB connected and responsive (${pingLatencyMs}ms)`,
                details: {
                    connectionState: stateStr,
                    readyState,
                    pingLatencyMs,
                    databaseName: mongoose_1.default.connection.name || 'mobile-crm',
                    host: mongoose_1.default.connection.host || 'mongodb-cluster',
                    isOperational: true,
                    pingOk: pingResult?.ok === 1,
                },
                timestamp: new Date(),
            };
        }
        catch (err) {
            return {
                name: 'MongoDB',
                category: 'database',
                status: 'UNHEALTHY',
                score: 0,
                latencyMs: Math.max(1, Date.now() - startTime),
                isCritical: true,
                message: 'MongoDB ping failed or timed out',
                error: err.message || 'Database ping error',
                details: {
                    readyState: mongoose_1.default.connection.readyState,
                    isOperational: false,
                },
                timestamp: new Date(),
            };
        }
    }
}
exports.MongoProbe = MongoProbe;
exports.mongoProbe = new MongoProbe();
