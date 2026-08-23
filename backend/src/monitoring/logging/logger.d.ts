import { LogLevel } from '../models/SystemLog';
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
declare class StructuredLogger {
    private serverId;
    private serviceName;
    private buffer;
    private liveRingBuffer;
    private maxRingBufferSize;
    private flushIntervalMs;
    private maxBatchSize;
    private timer;
    private isFlushing;
    constructor();
    private startFlushWorker;
    flush(): Promise<void>;
    private log;
    private printToConsole;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    fatal(message: string, context?: LogContext): void;
    getLiveStream(limit?: number): StructuredLogEntry[];
}
export declare const logger: StructuredLogger;
/**
 * Specialized Request Logger
 */
export declare function requestLogger(req: any, res: any, durationMs: number, extraMeta?: Record<string, any>): void;
/**
 * Specialized Security Logger (Auth failures, rate limits, access violations)
 */
export declare function securityLogger(event: string, metadata?: Record<string, any>): void;
/**
 * Specialized Audit Logger
 */
export declare function auditLogger(actor: string, action: string, target: string, metadata?: Record<string, any>): void;
/**
 * Specialized Error Logger
 */
export declare function errorLogger(err: any, req?: any, metadata?: Record<string, any>): void;
export default logger;
