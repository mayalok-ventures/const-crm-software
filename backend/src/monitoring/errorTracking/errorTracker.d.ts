import { Request, Response, NextFunction } from 'express';
import { ErrorSeverity } from '../models/ErrorGroup';
export interface ErrorContext {
    req?: Request | any;
    route?: string;
    method?: string;
    statusCode?: number;
    userId?: any;
    organizationId?: any;
    metadata?: Record<string, any>;
    severity?: ErrorSeverity;
}
declare class ErrorTrackerEngine {
    private serverId;
    private environment;
    private appVersion;
    private recentErrorTimestamps;
    private spikeThreshold;
    private rollingWindowMs;
    constructor();
    recordError(error: any, context?: ErrorContext): Promise<string>;
    private checkErrorSpike;
    /**
     * Express middleware to intercept and log unhandled route errors
     */
    expressMiddleware: (err: any, req: Request, res: Response, next: NextFunction) => void;
}
export declare const errorTracker: ErrorTrackerEngine;
export default errorTracker;
