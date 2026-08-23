import { Request } from 'express';
import { AuditAction, IFieldChange } from '../models/AuditLog';
export interface RecordAuditParams {
    actor?: {
        id?: string;
        _id?: any;
        name?: string;
        email?: string;
        role?: string;
        companyId?: any;
        isAdmin?: boolean;
    } | null;
    organizationId?: string | any;
    action: AuditAction;
    resourceType: string;
    resourceId?: string | any;
    resourceName?: string;
    before?: Record<string, any> | null;
    after?: Record<string, any> | null;
    changes?: Record<string, IFieldChange>;
    req?: Request;
    requestId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
}
declare class AuditServiceEngine {
    /**
     * Universal Audit Log recorder
     * Append-only, fully sanitized, field-level diffing enabled
     */
    record(params: RecordAuditParams): Promise<void>;
}
export declare const auditService: AuditServiceEngine;
export {};
