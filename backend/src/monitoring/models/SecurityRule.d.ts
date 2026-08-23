import mongoose, { Document } from 'mongoose';
import { SecurityEventType, SecuritySeverity } from './SecurityEvent';
export type SecurityRuleAction = 'FLAG_INCIDENT' | 'AUTO_BLOCK_IP' | 'ALERT_ADMIN';
export interface ISecurityRule extends Document {
    ruleId: string;
    name: string;
    description: string;
    eventType: SecurityEventType;
    threshold: number;
    windowSeconds: number;
    action: SecurityRuleAction;
    severity: SecuritySeverity;
    isActive: boolean;
    isConfigurable: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SecurityRule: mongoose.Model<any, {}, {}, {}, any, any>;
