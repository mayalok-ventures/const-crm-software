import mongoose, { Document } from 'mongoose';
export type DeploymentStatus = 'BUILDING' | 'DEPLOYING' | 'HEALTH_CHECK' | 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
export interface IHealthCheckItem {
    name: string;
    status: 'PASS' | 'FAIL' | 'DEGRADED';
    latencyMs?: number;
    details?: string;
}
export interface IHealthCheckResult {
    status: 'PASS' | 'FAIL' | 'DEGRADED';
    healthScore: number;
    checks: IHealthCheckItem[];
    evaluatedAt: Date;
}
export interface ISmokeTestSuiteItem {
    name: string;
    category: string;
    passed: boolean;
    latencyMs?: number;
    assertion?: string;
    error?: string;
}
export interface ISmokeTestResult {
    status: 'PASS' | 'FAIL';
    passedCount: number;
    totalCount: number;
    durationMs: number;
    testSuites: ISmokeTestSuiteItem[];
    executedAt: Date;
}
export interface IPostDeploymentMetrics {
    evaluatedAt: Date;
    errorRateBefore: number;
    errorRateAfter: number;
    errorCount15m: number;
    errorCount1h: number;
    latencyP95BeforeMs: number;
    latencyP95AfterMs: number;
    topPostDeployErrors: Array<{
        message: string;
        count: number;
        firstSeen: Date;
    }>;
}
export interface IRollbackDetails {
    rolledBackAt: Date;
    rolledBackBy: string;
    targetVersion: string;
    targetDeploymentId?: string;
    reason: string;
    isAutomated: boolean;
}
export interface IDeploymentLog {
    timestamp: Date;
    stage: string;
    message: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
}
export interface ICiCdMetadata {
    ciProvider: string;
    pipelineId?: string;
    runNumber?: number;
    prNumber?: number;
    trigger?: string;
    repository?: string;
}
export interface IDeployment extends Document {
    deploymentId: string;
    version: string;
    previousVersion?: string;
    commitHash: string;
    commitMessage?: string;
    branch: string;
    environment: 'production' | 'staging' | 'development';
    server: string;
    deployedAt: Date;
    deployedBy: string;
    deploymentStatus: DeploymentStatus;
    isCurrent: boolean;
    buildDurationMs: number;
    deployDurationMs: number;
    totalDurationMs: number;
    healthCheckResult?: IHealthCheckResult;
    smokeTestResult?: ISmokeTestResult;
    changelog: string[];
    postDeploymentMetrics?: IPostDeploymentMetrics;
    isSuspicious: boolean;
    suspiciousReason?: string;
    rollbackDetails?: IRollbackDetails;
    logs: IDeploymentLog[];
    cicdMetadata?: ICiCdMetadata;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
