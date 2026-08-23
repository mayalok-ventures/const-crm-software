import mongoose, { Document, Schema } from 'mongoose';

export interface IDeploymentPolicy extends Document {
  environment: 'production' | 'staging' | 'development';
  autoRollbackEnabled: boolean;
  requireHealthCheckPass: boolean;
  requireSmokeTestsPass: boolean;
  minHealthScore: number;
  maxErrorRateThreshold: number; // e.g. 5.0%
  maxLatencyP95Ms: number; // e.g. 500ms
  evaluationWindowMinutes: number; // e.g. 15m
  allowAutoRollbackOnlyIfHealthBelow: number; // e.g. 50%
  requireAdminApproval: boolean;
  notificationChannels: string[];
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeploymentPolicySchema = new Schema<IDeploymentPolicy>(
  {
    environment: {
      type: String,
      enum: ['production', 'staging', 'development'],
      default: 'production',
      unique: true,
      index: true,
    },
    autoRollbackEnabled: { type: Boolean, default: false }, // Explicit default false per user safety requirement
    requireHealthCheckPass: { type: Boolean, default: true },
    requireSmokeTestsPass: { type: Boolean, default: true },
    minHealthScore: { type: Number, default: 90 },
    maxErrorRateThreshold: { type: Number, default: 5.0 },
    maxLatencyP95Ms: { type: Number, default: 500 },
    evaluationWindowMinutes: { type: Number, default: 15 },
    allowAutoRollbackOnlyIfHealthBelow: { type: Number, default: 50 },
    requireAdminApproval: { type: Boolean, default: true },
    notificationChannels: [{ type: String }],
    updatedBy: { type: String, default: 'DevOps Admin' },
  },
  { timestamps: true }
);

export default mongoose.models.DeploymentPolicy ||
  mongoose.model<IDeploymentPolicy>('DeploymentPolicy', DeploymentPolicySchema);
