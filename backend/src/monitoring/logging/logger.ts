import os from 'os';
import { sanitizeLogData } from './logSanitizer';
import { SystemLog, LogLevel } from '../models/SystemLog';

export interface LogContext {
  service?: string;
  module?: string;
  serverId?: string;
  requestId?: string;
  userId?: any;
  organizationId?: any;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface StructuredLogEntry {
  timestamp: Date;
  level: LogLevel;
  service: string;
  module: string;
  serverId: string;
  requestId?: string;
  userId?: any;
  organizationId?: any;
  message: string;
  metadata?: Record<string, any>;
}

class StructuredLogger {
  private serverId: string;
  private serviceName: string;
  private buffer: StructuredLogEntry[] = [];
  private liveRingBuffer: StructuredLogEntry[] = [];
  private maxRingBufferSize = 500;
  private flushIntervalMs = 1500;
  private maxBatchSize = 50;
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor() {
    this.serverId = process.env.SERVER_ID || os.hostname() || 'server-default';
    this.serviceName = process.env.SERVICE_NAME || 'crm-backend';
    this.startFlushWorker();
  }

  private startFlushWorker() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.flush().catch((err) => {
        // Output locally without throwing uncaught exceptions
        if (process.env.NODE_ENV !== 'test') {
          console.error('[Logger Worker] Buffer flush error:', err.message);
        }
      });
    }, this.flushIntervalMs);

    if (this.timer.unref) this.timer.unref();
  }

  public async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) return;
    this.isFlushing = true;
    const batch = this.buffer.splice(0, this.maxBatchSize);

    try {
      if (batch.length > 0) {
        await SystemLog.insertMany(batch, { ordered: false });
      }
    } catch (err: any) {
      // If DB fails temporarily, preserve batch up to limit
      if (this.buffer.length < 500) {
        this.buffer.unshift(...batch);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  private log(level: LogLevel, message: string, context: LogContext = {}) {
    const now = new Date();
    const sanitizedMetadata = context.metadata
      ? sanitizeLogData(context.metadata)
      : undefined;

    const entry: StructuredLogEntry = {
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

  private printToConsole(entry: StructuredLogEntry) {
    const timeStr = entry.timestamp.toISOString().split('T')[1].replace('Z', '');
    let colorPrefix = '\x1b[32m'; // green for INFO
    if (entry.level === 'DEBUG') colorPrefix = '\x1b[36m'; // cyan
    if (entry.level === 'WARN') colorPrefix = '\x1b[33m'; // yellow
    if (entry.level === 'ERROR') colorPrefix = '\x1b[31m'; // red
    if (entry.level === 'FATAL') colorPrefix = '\x1b[35m'; // magenta
    const reset = '\x1b[0m';

    const reqTag = entry.requestId ? ` [${entry.requestId.slice(-6)}]` : '';
    const modTag = `[${entry.module}]`;

    console.log(
      `${colorPrefix}[${entry.level}]${reset} ${timeStr} ${modTag}${reqTag} ${entry.message}`
    );
  }

  public debug(message: string, context?: LogContext) {
    this.log('DEBUG', message, context);
  }

  public info(message: string, context?: LogContext) {
    this.log('INFO', message, context);
  }

  public warn(message: string, context?: LogContext) {
    this.log('WARN', message, context);
  }

  public error(message: string, context?: LogContext) {
    this.log('ERROR', message, context);
  }

  public fatal(message: string, context?: LogContext) {
    this.log('FATAL', message, context);
  }

  public getLiveStream(limit = 100): StructuredLogEntry[] {
    return this.liveRingBuffer.slice(0, limit);
  }
}

export const logger = new StructuredLogger();

/**
 * Specialized Request Logger
 */
export function requestLogger(req: any, res: any, durationMs: number, extraMeta: Record<string, any> = {}) {
  const level: LogLevel = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
  logger[level.toLowerCase() as 'info' | 'warn' | 'error'](
    `${req.method} ${req.originalUrl || req.url} - ${res.statusCode} (${durationMs}ms)`,
    {
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
    }
  );
}

/**
 * Specialized Security Logger (Auth failures, rate limits, access violations)
 */
export function securityLogger(event: string, metadata: Record<string, any> = {}) {
  logger.warn(`[SECURITY EVENT] ${event}`, {
    module: 'security',
    metadata: sanitizeLogData(metadata),
  });
}

/**
 * Specialized Audit Logger
 */
export function auditLogger(actor: string, action: string, target: string, metadata: Record<string, any> = {}) {
  logger.info(`[AUDIT] ${actor} -> ${action} on ${target}`, {
    module: 'audit',
    metadata: sanitizeLogData(metadata),
  });
}

/**
 * Specialized Error Logger
 */
export function errorLogger(err: any, req?: any, metadata: Record<string, any> = {}) {
  logger.error(err?.message || 'Unknown Application Error', {
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

export default logger;
