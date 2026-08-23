import mongoose, { Document } from 'mongoose';
export type ApiKeyAuditAction = 'KEY_CREATED' | 'KEY_ROTATED' | 'KEY_REVOKED' | 'KEY_SUSPENDED' | 'KEY_REACTIVATED' | 'PERMISSIONS_UPDATED' | 'RATE_LIMIT_UPDATED' | 'RATE_LIMIT_EXCEEDED' | 'UNUSUAL_IP_DETECTED' | 'EXPIRED_KEY_ATTEMPT' | 'REVOKED_KEY_ATTEMPT' | 'SUSPENDED_KEY_ATTEMPT' | 'FAILED_AUTH_ATTEMPT';
export interface IApiKeyAuditLog extends Document {
    auditId: string;
    keyId: string;
    keyPrefix: string;
    organizationId: mongoose.Types.ObjectId;
    action: ApiKeyAuditAction;
    performedBy?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}
declare const ApiKeyAuditLog: mongoose.Model<any, {}, {}, {}, any, any>;
export default ApiKeyAuditLog;
