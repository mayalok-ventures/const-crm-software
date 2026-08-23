import mongoose from 'mongoose';
import { DeploymentStatus } from '../models/Deployment';
import { IDeploymentPolicy } from '../models/DeploymentPolicy';
export interface IStartDeploymentParams {
    version: string;
    previousVersion?: string;
    commitHash: string;
    commitMessage?: string;
    branch?: string;
    environment?: 'production' | 'staging' | 'development';
    server?: string;
    deployedBy?: string;
    changelog?: string[];
    cicdMetadata?: {
        ciProvider: string;
        pipelineId?: string;
        runNumber?: number;
        prNumber?: number;
        trigger?: string;
        repository?: string;
    };
}
export declare class DeploymentService {
    /**
     * Returns current active live release, previous version, overall health score,
     * deployment status, and fleet KPIs for the dashboard header.
     */
    static getCurrentOverview(environment?: string): Promise<{
        currentVersion: any;
        currentDeployment: any;
        previousVersion: any;
        deploymentStatus: any;
        healthScore: any;
        environment: string;
        server: any;
        deployedAt: any;
        deployedBy: any;
        commitHash: any;
        branch: any;
        buildDurationSec: number;
        deployDurationSec: number;
        totalDurationSec: number;
        smokeTestsStatus: string;
        isSuspicious: boolean;
        suspiciousReason: any;
        activeIncidentsCount: number;
        activeIncidents: any[];
        summary: {
            totalDeployments: number;
            successfulDeployments: number;
            failedDeployments: number;
            rolledBackDeployments: number;
            avgBuildSec: number;
            avgDeploySec: number;
            autoRollbackEnabled: boolean;
        };
        recentDeployments: any[];
    }>;
    /**
     * Retrieves paginated deployment history with filtering.
     */
    static getDeploymentHistory(filters?: {
        environment?: string;
        status?: string;
        search?: string;
    }, limit?: number, offset?: number): Promise<{
        deployments: (mongoose.FlattenMaps<any> & Required<{
            _id: unknown;
        }> & {
            __v: number;
        })[];
        total: number;
        limit: number;
        offset: number;
        page: number;
    }>;
    /**
     * Retrieves deep details of a specific deployment.
     */
    static getDeploymentById(deploymentId: string): Promise<{
        deployment: any;
        incidents: (mongoose.FlattenMaps<any> & Required<{
            _id: unknown;
        }> & {
            __v: number;
        })[];
    } | null>;
    /**
     * Starts a new deployment pipeline in BUILDING stage.
     */
    static startDeployment(params: IStartDeploymentParams): Promise<any>;
    /**
     * Advances the deployment stage (e.g. BUILDING -> DEPLOYING -> HEALTH_CHECK -> SUCCESS/FAILED)
     */
    static advanceDeploymentStage(deploymentId: string, stage: DeploymentStatus, metadata?: {
        buildDurationMs?: number;
        deployDurationMs?: number;
        logMessage?: string;
        errorMessage?: string;
    }): Promise<any>;
    /**
     * Executes health check probes and automated smoke tests for a deployment.
     * If passing, sets as current active live release; if failing, marks as FAILED.
     */
    static runHealthAndSmokeTests(deploymentId: string): Promise<any>;
    /**
     * Executes a safe rollback workflow to a target version.
     * Adheres to safety directive: never auto-rolls back without policy.
     */
    static triggerRollback(deploymentId: string, targetVersion: string, performedBy?: string, reason?: string, isAutomated?: boolean): Promise<{
        success: boolean;
        rolledBackVersion: any;
        activeVersion: any;
        rolledBackAt: Date;
        smokeTestResult: import("../models/Deployment").ISmokeTestResult;
    }>;
    /**
     * Evaluates post-deployment error rates and latency anomalies (called by worker).
     */
    static evaluatePostDeploymentHealth(deploymentId: string): Promise<any>;
    /**
     * CI/CD Webhook pipeline progress intake.
     */
    static recordCiCdStage(payload: {
        version: string;
        commitHash: string;
        commitMessage?: string;
        branch?: string;
        environment?: 'production' | 'staging';
        server?: string;
        stage: 'building' | 'deploying' | 'health_check' | 'complete' | 'failed';
        buildDurationMs?: number;
        deployDurationMs?: number;
        changelog?: string[];
        errorMessage?: string;
        cicdMetadata?: any;
    }): Promise<any>;
    /**
     * Manages deployment incidents.
     */
    static getIncidents(environment?: string): Promise<(mongoose.FlattenMaps<any> & Required<{
        _id: unknown;
    }> & {
        __v: number;
    })[]>;
    static resolveIncident(incidentId: string, resolvedBy?: string, resolutionNotes?: string): Promise<any>;
    /**
     * Retrieves or creates default policy for environment.
     */
    static getOrCreatePolicy(environment?: string): Promise<IDeploymentPolicy>;
    static updatePolicy(environment: string | undefined, updates: Partial<IDeploymentPolicy>): Promise<IDeploymentPolicy>;
}
export declare const deploymentService: typeof DeploymentService;
export default DeploymentService;
