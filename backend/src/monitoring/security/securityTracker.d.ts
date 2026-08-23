import { Request } from 'express';
import { SecurityEventType } from '../models/SecurityEvent';
declare class SecurityTrackerEngine {
    private eventWindow;
    private rulesCache;
    private isRulesLoaded;
    constructor();
    initDefaultRules(): Promise<void>;
    loadRules(): Promise<void>;
    private pruneWindow;
    /**
     * Records a security event with sanitization, multi-factor risk calculation,
     * sliding window aggregation, and automated rule evaluation.
     */
    recordEvent(params: {
        type: SecurityEventType;
        req?: Request;
        userId?: string | null;
        userEmail?: string | null;
        tenantId?: string | null;
        ip?: string;
        userAgent?: string;
        endpoint?: string;
        method?: string;
        metadata?: Record<string, any>;
        isAdminUser?: boolean;
    }): Promise<void>;
    private evaluateRules;
    private upsertIncident;
}
export declare const securityTracker: SecurityTrackerEngine;
export {};
