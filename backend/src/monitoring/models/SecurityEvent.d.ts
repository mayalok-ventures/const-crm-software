import mongoose, { Document } from 'mongoose';
export type SecurityEventType = 'LOGIN_FAILED' | 'LOGIN_SUCCESS' | 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'PERMISSION_DENIED' | 'RATE_LIMIT' | 'OTP_ABUSE' | 'PASSWORD_RESET' | 'ADMIN_ACTION' | 'SUSPICIOUS_ACTIVITY';
export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface ISecurityEvent extends Document {
    type: SecurityEventType;
    severity: SecuritySeverity;
    userId?: mongoose.Types.ObjectId | string;
    userEmail?: string;
    tenantId?: mongoose.Types.ObjectId | string;
    ip: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
    riskScore: number;
    metadata?: Record<string, any>;
    timestamp: Date;
}
export declare const SecurityEvent: mongoose.Model<any, {}, {}, {}, any, any>;
