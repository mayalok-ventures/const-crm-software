import mongoose, { Schema, Document } from 'mongoose';
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

const SecurityIncidentSchema: Schema = new Schema(
  {
    incidentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    type: {
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
    severity: {
      type: String,
      required: true,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'],
      default: 'OPEN',
      index: true,
    },
    targetIp: {
      type: String,
      default: null,
      index: true,
    },
    targetUserId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    targetUserEmail: {
      type: String,
      default: null,
      index: true,
    },
    targetTenantId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    eventCount: {
      type: Number,
      default: 1,
    },
    firstSeen: {
      type: Date,
      default: Date.now,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true,
    },
    triggerRuleId: {
      type: String,
      default: null,
    },
    riskScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    adminNotes: [
      {
        author: { type: String, required: true },
        note: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    resolvedBy: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
SecurityIncidentSchema.index({ status: 1, severity: 1, lastSeen: -1 });
SecurityIncidentSchema.index({ targetIp: 1, status: 1 });

export const SecurityIncident =
  mongoose.models.SecurityIncident ||
  mongoose.model<ISecurityIncident>('SecurityIncident', SecurityIncidentSchema);
