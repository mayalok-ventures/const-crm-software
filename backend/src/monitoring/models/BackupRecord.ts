import mongoose, { Schema, Document, Types } from 'mongoose';
import { BackupStatus } from './BackupJob';

export type VerificationStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED';

export interface IBackupRecord extends Document {
  backupId: string;
  jobId: string;
  policyId?: Types.ObjectId;
  status: BackupStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  sizeBytes: number;
  formattedSize: string;
  location: {
    target: string;
    path: string;
    bucket?: string;
    region?: string;
    isExternal: boolean;
  };
  checksum: {
    algorithm: string;
    value: string;
    verified: boolean;
  };
  verification: {
    status: VerificationStatus;
    fileHeaderValid: boolean;
    archiveIntegrityValid: boolean;
    decompressionTestValid: boolean;
    simulatedRestoreValid: boolean;
    verifiedAt?: Date;
    failureReason?: string;
    verifiedBy?: string;
  };
  retentionExpiresAt: Date;
  isRetained: boolean;
  metadata: {
    databaseName: string;
    collectionsCount: number;
    documentsCount: number;
    storageEngine: string;
    backupEngineVersion: string;
  };
  failureDetails?: {
    code: string;
    message: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BackupRecordSchema = new Schema<IBackupRecord>(
  {
    backupId: { type: String, required: true, unique: true, index: true },
    jobId: { type: String, required: true, index: true },
    policyId: { type: Schema.Types.ObjectId, ref: 'BackupPolicy' },
    status: {
      type: String,
      enum: ['RUNNING', 'SUCCESS', 'FAILED', 'VERIFICATION_FAILED', 'EXPIRED'],
      default: 'RUNNING',
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    durationMs: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
    formattedSize: { type: String, default: '0 MB' },
    location: {
      target: { type: String, default: 'S3' },
      path: { type: String, required: true },
      bucket: { type: String, default: '' },
      region: { type: String, default: 'us-east-1' },
      isExternal: { type: Boolean, default: true },
    },
    checksum: {
      algorithm: { type: String, default: 'SHA256' },
      value: { type: String, default: '' },
      verified: { type: Boolean, default: false },
    },
    verification: {
      status: {
        type: String,
        enum: ['PENDING', 'PASSED', 'FAILED', 'SKIPPED'],
        default: 'PENDING',
        index: true,
      },
      fileHeaderValid: { type: Boolean, default: false },
      archiveIntegrityValid: { type: Boolean, default: false },
      decompressionTestValid: { type: Boolean, default: false },
      simulatedRestoreValid: { type: Boolean, default: false },
      verifiedAt: { type: Date },
      failureReason: { type: String, default: '' },
      verifiedBy: { type: String, default: 'SYSTEM_VERIFIER' },
    },
    retentionExpiresAt: { type: Date, required: true, index: true },
    isRetained: { type: Boolean, default: true },
    metadata: {
      databaseName: { type: String, default: 'mobile-crm' },
      collectionsCount: { type: Number, default: 0 },
      documentsCount: { type: Number, default: 0 },
      storageEngine: { type: String, default: 'WiredTiger' },
      backupEngineVersion: { type: String, default: '1.0.0' },
    },
    failureDetails: {
      code: { type: String },
      message: { type: String },
    },
  },
  { timestamps: true }
);

BackupRecordSchema.index({ completedAt: -1, status: 1 });
BackupRecordSchema.index({ createdAt: -1 });

export default mongoose.models.BackupRecord ||
  mongoose.model<IBackupRecord>('BackupRecord', BackupRecordSchema);
