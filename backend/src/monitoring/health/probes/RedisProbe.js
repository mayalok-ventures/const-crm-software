"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisProbe = exports.RedisProbe = void 0;
const net_1 = __importDefault(require("net"));
class RedisProbe {
    /**
     * Probes Redis connection if configured in environment
     */
    async probe() {
        const startTime = Date.now();
        const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
        // 1. If Redis is not configured, report NOT_CONFIGURED gracefully
        if (!redisUrl) {
            return {
                name: 'Redis Cache',
                category: 'cache',
                status: 'NOT_CONFIGURED',
                score: 100,
                latencyMs: 0,
                isCritical: false,
                message: 'Redis cache not configured in environment (MongoDB utilized for caching & state)',
                details: {
                    configured: false,
                    driver: 'in-memory / mongodb',
                },
                timestamp: new Date(),
            };
        }
        // 2. If configured, test TCP socket connection / ping
        try {
            let host = '127.0.0.1';
            let port = 6379;
            if (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://')) {
                try {
                    const parsed = new URL(redisUrl);
                    host = parsed.hostname || '127.0.0.1';
                    port = Number(parsed.port) || 6379;
                }
                catch {
                    host = redisUrl.split(':')[0] || '127.0.0.1';
                    port = Number(redisUrl.split(':')[1]) || 6379;
                }
            }
            else if (redisUrl.includes(':')) {
                const parts = redisUrl.split(':');
                host = parts[0];
                port = Number(parts[1]) || 6379;
            }
            else {
                host = redisUrl;
                port = Number(process.env.REDIS_PORT) || 6379;
            }
            const socketCheck = await new Promise((resolve, reject) => {
                const pingStart = Date.now();
                const socket = new net_1.default.Socket();
                socket.setTimeout(1500);
                socket.connect(port, host, () => {
                    const latency = Date.now() - pingStart;
                    socket.destroy();
                    resolve({ ok: true, latencyMs: latency });
                });
                socket.on('error', (err) => {
                    socket.destroy();
                    reject(err);
                });
                socket.on('timeout', () => {
                    socket.destroy();
                    reject(new Error('Redis connection timed out (1500ms)'));
                });
            });
            return {
                name: 'Redis Cache',
                category: 'cache',
                status: 'HEALTHY',
                score: 100,
                latencyMs: socketCheck.latencyMs,
                isCritical: false,
                message: `Redis connection established (${socketCheck.latencyMs}ms)`,
                details: {
                    configured: true,
                    host,
                    port,
                    pingLatencyMs: socketCheck.latencyMs,
                },
                timestamp: new Date(),
            };
        }
        catch (err) {
            return {
                name: 'Redis Cache',
                category: 'cache',
                status: 'DEGRADED',
                score: 50,
                latencyMs: Math.max(1, Date.now() - startTime),
                isCritical: false,
                message: `Redis connection issue: ${err.message}`,
                error: err.message,
                details: {
                    configured: true,
                    fallbackActive: true,
                },
                timestamp: new Date(),
            };
        }
    }
}
exports.RedisProbe = RedisProbe;
exports.redisProbe = new RedisProbe();
