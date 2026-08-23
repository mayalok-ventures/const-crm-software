import mongoose, { Document } from 'mongoose';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT' | 'ROLE_CHANGE' | 'PERMISSION_CHANGE' | 'PASSWORD_CHANGE' | 'SETTINGS_CHANGE' | 'API_KEY_CREATE' | 'API_KEY_REVOKE';
export interface IFieldChange {
    from: any;
    to: any;
}
export interface IAuditLog extends Document {
    actorId?: mongoose.Types.ObjectId | string;
    actorName?: string;
    actorEmail?: string;
    actorRole?: string;
    organizationId?: mongoose.Types.ObjectId | string;
    action: AuditAction;
    resourceType: string;
    resourceId?: string;
    resourceName?: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
    changes?: Record<string, IFieldChange>;
    requestId?: string;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
    retentionCategory: 'ACTIVE' | 'ARCHIVED';
    createdAt: Date;
}
export declare const AuditLog: mongoose.Model<any, {}, {}, {}, any, any>;
