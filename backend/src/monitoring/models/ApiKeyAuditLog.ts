import mongoose, { Document, Schema } from 'mongoose';

export type ApiKeyAuditAction =
  | 'KEY_CREATED'
  | 'KEY_ROTATED'
  | 'KEY_REVOKED'
  | 'KEY_SUSPENDED'
  | 'KEY_REACTIVATED'
  | 'PERMISSIONS_UPDATED'
  | 'RATE_LIMIT_UPDATED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNUSUAL_IP_DETECTED'
  | 'EXPIRED_KEY_ATTEMPT'
  | 'REVOKED_KEY_ATTEMPT'
  | 'SUSPENDED_KEY_ATTEMPT'
  | 'FAILED_AUTH_ATTEMPT';

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

const ApiKeyAuditLogSchema = new Schema<IApiKeyAuditLog>(
  {
    auditId: { type: String, required: true, unique: true, index: true },
    keyId: { type: String, required: true, index: true },
    keyPrefix: { type: String, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
      type: String,
      required: true,
      index: true,
    },
    performedBy: { type: String, default: 'System' },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ApiKeyAuditLogSchema.index({ keyId: 1, createdAt: -1 });
ApiKeyAuditLogSchema.index({ organizationId: 1, createdAt: -1 });

const ApiKeyAuditLog =
  mongoose.models.ApiKeyAuditLog ||
  mongoose.model<IApiKeyAuditLog>('ApiKeyAuditLog', ApiKeyAuditLogSchema);
export default ApiKeyAuditLog;
