import mongoose, { Document } from 'mongoose';
import { SecurityEventType, SecuritySeverity } from './SecurityEvent';
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED';
export interface ISecurityIncidentAdminNote {
    author: string;
    note: string;
    createdAt: Date;
}
export interface ISecurityIncident extends Document {
    incidentId: string;
    title: string;
    description: string;
    type: SecurityEventType;
    severity: SecuritySeverity;
    status: IncidentStatus;
    targetIp?: string;
    targetUserId?: mongoose.Types.ObjectId | string;
    targetUserEmail?: string;
    targetTenantId?: mongoose.Types.ObjectId | string;
    eventCount: number;
    firstSeen: Date;
    lastSeen: Date;
    triggerRuleId?: string;
    riskScore: number;
    metadata?: Record<string, any>;
    adminNotes: ISecurityIncidentAdminNote[];
    resolvedBy?: string;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SecurityIncident: mongoose.Model<any, {}, {}, {}, any, any>;
