import mongoose, { Schema, Document, Types } from 'mongoose';

export type BackupStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'VERIFICATION_FAILED' | 'EXPIRED';
export type BackupJobType = 'FULL_SNAPSHOT' | 'INCREMENTAL' | 'OPLOG' | 'COLLECTION_EXPORT';

export interface IBackupJob extends Document {
  jobId: string;
  policyId?: Types.ObjectId;
  name: string;
  jobType: BackupJobType;
  lastRunAt?: Date;
  lastStatus: BackupStatus;
  nextScheduledAt?: Date;
  consecutiveFailures: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BackupJobSchema = new Schema<IBackupJob>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    policyId: { type: Schema.Types.ObjectId, ref: 'BackupPolicy' },
    name: { type: String, required: true, trim: true },
    jobType: {
      type: String,
      enum: ['FULL_SNAPSHOT', 'INCREMENTAL', 'OPLOG', 'COLLECTION_EXPORT'],
      default: 'FULL_SNAPSHOT',
    },
    lastRunAt: { type: Date },
    lastStatus: {
      type: String,
      enum: ['RUNNING', 'SUCCESS', 'FAILED', 'VERIFICATION_FAILED', 'EXPIRED'],
      default: 'SUCCESS',
    },
    nextScheduledAt: { type: Date },
    consecutiveFailures: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.BackupJob ||
  mongoose.model<IBackupJob>('BackupJob', BackupJobSchema);
