import mongoose, { Document, Schema } from 'mongoose';

export type ApiKeyAlertType =
  | 'UNUSUAL_IP_OR_GEO'
  | 'EXCESSIVE_REQUESTS'
  | 'EXPIRED_KEY_ATTEMPT'
  | 'REVOKED_KEY_ATTEMPT'
  | 'SUSPENDED_KEY_ATTEMPT'
  | 'RATE_LIMIT_SPIKE';

export type ApiKeyAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IApiKeySecurityAlert extends Document {
  alertId: string;
  keyId: string;
  keyName: string;
  keyPrefix: string;
  organizationId: mongoose.Types.ObjectId;
  organizationName: string;
  alertType: ApiKeyAlertType;
  severity: ApiKeyAlertSeverity;
  title: string;
  description: string;
  metadata: Record<string, any>;
  isResolved: boolean;
  resolvedAt?: Date | null;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySecurityAlertSchema = new Schema<IApiKeySecurityAlert>(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    keyId: { type: String, required: true, index: true },
    keyName: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationName: { type: String, default: 'Organization' },
    alertType: {
      type: String,
      enum: [
        'UNUSUAL_IP_OR_GEO',
        'EXCESSIVE_REQUESTS',
        'EXPIRED_KEY_ATTEMPT',
        'REVOKED_KEY_ATTEMPT',
        'SUSPENDED_KEY_ATTEMPT',
        'RATE_LIMIT_SPIKE',
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    isResolved: { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

ApiKeySecurityAlertSchema.index({ organizationId: 1, isResolved: 1, createdAt: -1 });

const ApiKeySecurityAlert =
  mongoose.models.ApiKeySecurityAlert ||
  mongoose.model<IApiKeySecurityAlert>('ApiKeySecurityAlert', ApiKeySecurityAlertSchema);
export default ApiKeySecurityAlert;
