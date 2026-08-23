import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
