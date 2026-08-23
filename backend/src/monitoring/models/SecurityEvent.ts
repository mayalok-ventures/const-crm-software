import mongoose, { Schema, Document } from 'mongoose';

export type SecurityEventType =
  | 'LOGIN_FAILED'
  | 'LOGIN_SUCCESS'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMIT'
  | 'OTP_ABUSE'
  | 'PASSWORD_RESET'
  | 'ADMIN_ACTION'
  | 'SUSPICIOUS_ACTIVITY';

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

const SecurityEventSchema: Schema = new Schema(
  {
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
      default: 'LOW',
      index: true,
    },
    userId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    userEmail: {
      type: String,
      default: null,
      index: true,
    },
    tenantId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    ip: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: {
      type: String,
      default: null,
    },
    endpoint: {
      type: String,
      default: null,
      index: true,
    },
    method: {
      type: String,
      default: null,
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
      // 90-day auto-purge TTL
      expires: 90 * 24 * 60 * 60,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for rapid admin telemetry queries
SecurityEventSchema.index({ type: 1, timestamp: -1 });
SecurityEventSchema.index({ severity: 1, timestamp: -1 });
SecurityEventSchema.index({ ip: 1, timestamp: -1 });
SecurityEventSchema.index({ userId: 1, timestamp: -1 });

export const SecurityEvent =
  mongoose.models.SecurityEvent ||
  mongoose.model<ISecurityEvent>('SecurityEvent', SecurityEventSchema);
