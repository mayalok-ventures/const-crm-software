"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.requestLogger = requestLogger;
exports.securityLogger = securityLogger;
exports.auditLogger = auditLogger;
exports.errorLogger = errorLogger;
const os_1 = __importDefault(require("os"));
const logSanitizer_1 = require("./logSanitizer");
const SystemLog_1 = require("../models/SystemLog");
class StructuredLogger {
    serverId;
    serviceName;
    buffer = [];
    liveRingBuffer = [];
    maxRingBufferSize = 500;
    flushIntervalMs = 1500;
    maxBatchSize = 50;
    timer = null;
    isFlushing = false;
    constructor() {
        this.serverId = process.env.SERVER_ID || os_1.default.hostname() || 'server-default';
        this.serviceName = process.env.SERVICE_NAME || 'crm-backend';
        this.startFlushWorker();
    }
    startFlushWorker() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.flush().catch((err) => {
                // Output locally without throwing uncaught exceptions
                if (process.env.NODE_ENV !== 'test') {
                    console.error('[Logger Worker] Buffer flush error:', err.message);
                }
            });
        }, this.flushIntervalMs);
        if (this.timer.unref)
            this.timer.unref();
    }
    async flush() {
        if (this.isFlushing || this.buffer.length === 0)
            return;
        this.isFlushing = true;
        const batch = this.buffer.splice(0, this.maxBatchSize);
        try {
            if (batch.length > 0) {
                await SystemLog_1.SystemLog.insertMany(batch, { ordered: false });
            }
        }
        catch (err) {
            // If DB fails temporarily, preserve batch up to limit
            if (this.buffer.length < 500) {
                this.buffer.unshift(...batch);
            }
        }
        finally {
            this.isFlushing = false;
        }
    }
    log(level, message, context = {}) {
        const now = new Date();
        const sanitizedMetadata = context.metadata
            ? (0, logSanitizer_1.sanitizeLogData)(context.metadata)
            : undefined;
        const entry = {
            timestamp: now,
            level,
            service: context.service || this.serviceName,
            module: context.module || 'general',
            serverId: context.serverId || this.serverId,
            requestId: context.requestId,
            userId: context.userId ? String(context.userId) : undefined,
            organizationId: context.organizationId ? String(context.organizationId) : undefined,
            message: String(message),
            metadata: sanitizedMetadata,
        };
        // Print to console with colored level tag
        this.printToConsole(entry);
        // Save into in-memory live stream ring buffer
        this.liveRingBuffer.unshift(entry);
        if (this.liveRingBuffer.length > this.maxRingBufferSize) {
            this.liveRingBuffer.pop();
        }
        // Queue for batch database insertion (non-blocking)
        this.buffer.push(entry);
        if (this.buffer.length >= this.maxBatchSize) {
            setImmediate(() => this.flush());
        }
    }
    printToConsole(entry) {
        const timeStr = entry.timestamp.toISOString().split('T')[1].replace('Z', '');
        let colorPrefix = '\x1b[32m'; // green for INFO
        if (entry.level === 'DEBUG')
            colorPrefix = '\x1b[36m'; // cyan
        if (entry.level === 'WARN')
            colorPrefix = '\x1b[33m'; // yellow
        if (entry.level === 'ERROR')
            colorPrefix = '\x1b[31m'; // red
        if (entry.level === 'FATAL')
            colorPrefix = '\x1b[35m'; // magenta
        const reset = '\x1b[0m';
        const reqTag = entry.requestId ? ` [${entry.requestId.slice(-6)}]` : '';
        const modTag = `[${entry.module}]`;
        console.log(`${colorPrefix}[${entry.level}]${reset} ${timeStr} ${modTag}${reqTag} ${entry.message}`);
    }
    debug(message, context) {
        this.log('DEBUG', message, context);
    }
    info(message, context) {
        this.log('INFO', message, context);
    }
    warn(message, context) {
        this.log('WARN', message, context);
    }
    error(message, context) {
        this.log('ERROR', message, context);
    }
    fatal(message, context) {
        this.log('FATAL', message, context);
    }
    audit(actor, action, target, context) {
        this.log('INFO', `[AUDIT] ${actor} performed ${action} on ${target}`, {
            ...context,
            module: 'audit',
        });
    }
    getLiveStream(limit = 100) {
        return this.liveRingBuffer.slice(0, limit);
    }
}
exports.logger = new StructuredLogger();
/**
 * Specialized Request Logger
 */
function requestLogger(req, res, durationMs, extraMeta = {}) {
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    exports.logger[level.toLowerCase()](`${req.method} ${req.originalUrl || req.url} - ${res.statusCode} (${durationMs}ms)`, {
        module: 'http',
        requestId: req.headers?.['x-request-id'] || req.requestId,
        userId: req.user?._id || req.user?.id,
        organizationId: req.user?.companyId || req.tenantId,
        metadata: {
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs,
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.headers?.['user-agent'],
            ...extraMeta,
        },
    });
}
/**
 * Specialized Security Logger (Auth failures, rate limits, access violations)
 */
function securityLogger(event, metadata = {}) {
    exports.logger.warn(`[SECURITY EVENT] ${event}`, {
        module: 'security',
        metadata: (0, logSanitizer_1.sanitizeLogData)(metadata),
    });
}
/**
 * Specialized Audit Logger
 */
function auditLogger(actor, action, target, metadata = {}) {
    exports.logger.info(`[AUDIT] ${actor} -> ${action} on ${target}`, {
        module: 'audit',
        metadata: (0, logSanitizer_1.sanitizeLogData)(metadata),
    });
}
/**
 * Specialized Error Logger
 */
function errorLogger(err, req, metadata = {}) {
    exports.logger.error(err?.message || 'Unknown Application Error', {
        module: metadata.module || 'error',
        requestId: req?.headers?.['x-request-id'] || req?.requestId,
        userId: req?.user?._id || req?.user?.id,
        organizationId: req?.user?.companyId || req?.tenantId,
        metadata: {
            errorName: err?.name,
            stack: err?.stack,
            route: req?.originalUrl || req?.url,
            method: req?.method,
            ...metadata,
        },
    });
}
exports.default = exports.logger;
