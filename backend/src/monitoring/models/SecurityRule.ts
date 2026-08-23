import mongoose, { Schema, Document } from 'mongoose';
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

const SecurityRuleSchema: Schema = new Schema(
  {
    ruleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'LOGIN_FAILED',
        'LOGIN_SUCCESS',
        'TOKEN_INVALID',
        'TOKEN_EXPIRED',
        'PERMISSION_DENIED',
        'RATE_LIMIT',
        'OTP_ABUSE',
        'PASSWORD_RESET',
        'ADMIN_ACTION',
        'SUSPICIOUS_ACTIVITY',
      ],
      index: true,
    },
    threshold: {
      type: Number,
      required: true,
      min: 1,
    },
    windowSeconds: {
      type: Number,
      required: true,
      min: 10,
    },
    action: {
      type: String,
      required: true,
      enum: ['FLAG_INCIDENT', 'AUTO_BLOCK_IP', 'ALERT_ADMIN'],
      default: 'FLAG_INCIDENT',
    },
    severity: {
      type: String,
      required: true,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isConfigurable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SecurityRule =
  mongoose.models.SecurityRule ||
  mongoose.model<ISecurityRule>('SecurityRule', SecurityRuleSchema);
