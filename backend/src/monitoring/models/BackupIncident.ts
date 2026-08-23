import mongoose, { Schema, Document, Types } from 'mongoose';

export type BackupIncidentType =
  | 'BACKUP_MISSED'
  | 'BACKUP_FAILED'
  | 'BACKUP_TOO_OLD'
  | 'VERIFICATION_FAILED'
  | 'STORAGE_UNAVAILABLE'
  | 'CORRUPTED_CHECKSUM';

export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentResolutionStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface IBackupIncident extends Document {
  incidentId: string;
  type: BackupIncidentType;
  severity: IncidentSeverity;
  status: IncidentResolutionStatus;
  policyId?: Types.ObjectId;
  backupId?: string;
  title: string;
  message: string;
  details: Record<string, any>;
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BackupIncidentSchema = new Schema<IBackupIncident>(
  {
    incidentId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: [
        'BACKUP_MISSED',
        'BACKUP_FAILED',
        'BACKUP_TOO_OLD',
        'VERIFICATION_FAILED',
        'STORAGE_UNAVAILABLE',
        'CORRUPTED_CHECKSUM',
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'HIGH',
    },
    status: {
      type: String,
      enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'],
      default: 'OPEN',
      index: true,
    },
    policyId: { type: Schema.Types.ObjectId, ref: 'BackupPolicy' },
    backupId: { type: String },
    title: { type: String, required: true },
    message: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    detectedAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
    resolutionNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

BackupIncidentSchema.index({ status: 1, detectedAt: -1 });

export default mongoose.models.BackupIncident ||
  mongoose.model<IBackupIncident>('BackupIncident', BackupIncidentSchema);
