import mongoose, { Schema, Document } from 'mongoose';

export type StorageTarget = 'S3' | 'GCS' | 'AZURE' | 'OFFSITE_REMOTE' | 'LOCAL_STAGING';

export interface IBackupPolicy extends Document {
  name: string;
  description?: string;
  scheduleCron: string;
  maxAgeHours: number;
  retentionDays: number;
  storageTarget: StorageTarget;
  isExternalRequired: boolean;
  mandatoryVerification: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BackupPolicySchema = new Schema<IBackupPolicy>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: '' },
    scheduleCron: { type: String, required: true, default: '0 2 * * *' },
    maxAgeHours: { type: Number, required: true, default: 26 },
    retentionDays: { type: Number, required: true, default: 30 },
    storageTarget: {
      type: String,
      enum: ['S3', 'GCS', 'AZURE', 'OFFSITE_REMOTE', 'LOCAL_STAGING'],
      default: 'S3',
    },
    isExternalRequired: { type: Boolean, default: true },
    mandatoryVerification: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.BackupPolicy ||
  mongoose.model<IBackupPolicy>('BackupPolicy', BackupPolicySchema);
