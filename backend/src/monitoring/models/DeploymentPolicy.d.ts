import mongoose, { Document } from 'mongoose';
export interface IDeploymentPolicy extends Document {
    environment: 'production' | 'staging' | 'development';
    autoRollbackEnabled: boolean;
    requireHealthCheckPass: boolean;
    requireSmokeTestsPass: boolean;
    minHealthScore: number;
    maxErrorRateThreshold: number;
    maxLatencyP95Ms: number;
    evaluationWindowMinutes: number;
    allowAutoRollbackOnlyIfHealthBelow: number;
    requireAdminApproval: boolean;
    notificationChannels: string[];
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
