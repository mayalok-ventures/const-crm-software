import mongoose, { Document, Schema } from 'mongoose';

export type ApiKeyStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';

export interface IRotationRecord {
  rotatedAt: Date;
  previousPrefix: string;
  gracePeriodEndsAt?: Date;
}

export interface IApiKey extends Document {
  keyId: string;
  name: string;
  organizationId: mongoose.Types.ObjectId;
  organizationName: string;
  createdBy: mongoose.Types.ObjectId;
  createdByName?: string;
  createdByEmail?: string;
  keyPrefix: string;
  keyHash: string;
  status: ApiKeyStatus;
  permissions: string[];
  rateLimitPerMinute: number;
  ipWhitelist: string[];
  expiresAt?: Date | null;
  lastUsedAt?: Date | null;
  lastUsedIp?: string;
  lastUsedUserAgent?: string;
  lastUsedGeo?: {
    country?: string;
    city?: string;
  };
  totalRequests: number;
  monthlyRequests: number;
  dailyRequests: number;
  failedAuthCount: number;
  rateLimitViolationsCount: number;
  unusualUsageScore: number;
  revokedAt?: Date | null;
  revokedBy?: string;
  revocationReason?: string;
  suspendedAt?: Date | null;
  suspensionReason?: string;
  rotationHistory: IRotationRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    keyId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationName: { type: String, default: 'Organization' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, default: 'Admin' },
    createdByEmail: { type: String, default: '' },
    keyPrefix: { type: String, required: true, index: true },
    keyHash: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
    permissions: [{ type: String, trim: true }],
    rateLimitPerMinute: { type: Number, default: 120 },
    ipWhitelist: [{ type: String, trim: true }],
    expiresAt: { type: Date, default: null, index: true },
    lastUsedAt: { type: Date, default: null, index: true },
    lastUsedIp: { type: String, default: '' },
    lastUsedUserAgent: { type: String, default: '' },
    lastUsedGeo: {
      country: { type: String, default: '' },
      city: { type: String, default: '' },
    },
    totalRequests: { type: Number, default: 0 },
    monthlyRequests: { type: Number, default: 0 },
    dailyRequests: { type: Number, default: 0 },
    failedAuthCount: { type: Number, default: 0 },
    rateLimitViolationsCount: { type: Number, default: 0 },
    unusualUsageScore: { type: Number, default: 0 },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: String, default: '' },
    revocationReason: { type: String, default: '' },
    suspendedAt: { type: Date, default: null },
    suspensionReason: { type: String, default: '' },
    rotationHistory: [
      {
        rotatedAt: { type: Date, default: Date.now },
        previousPrefix: { type: String },
        gracePeriodEndsAt: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

ApiKeySchema.index({ organizationId: 1, status: 1 });
ApiKeySchema.index({ expiresAt: 1, status: 1 });

const ApiKey = mongoose.models.ApiKey || mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
export default ApiKey;
