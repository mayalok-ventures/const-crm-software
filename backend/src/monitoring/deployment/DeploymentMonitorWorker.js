"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deploymentMonitorWorker = exports.DeploymentMonitorWorker = void 0;
const Deployment_1 = __importDefault(require("../models/Deployment"));
const deploymentService_1 = require("./deploymentService");
class DeploymentMonitorWorker {
    static instance;
    intervalId = null;
    isRunning = false;
    constructor() { }
    static getInstance() {
        if (!DeploymentMonitorWorker.instance) {
            DeploymentMonitorWorker.instance = new DeploymentMonitorWorker();
        }
        return DeploymentMonitorWorker.instance;
    }
    start(intervalMs = 60000) {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        console.log(`[DeploymentMonitorWorker] Starting background worker (Interval: ${intervalMs}ms)`);
        // Initial check & seed after 5s
        setTimeout(() => {
            this.seedDefaultDeployments().catch((err) => console.error('[DeploymentMonitorWorker] Error during deployment seed:', err));
            this.runEvaluationCycle().catch((err) => console.error('[DeploymentMonitorWorker] Error in initial evaluation cycle:', err));
        }, 5000);
        this.intervalId = setInterval(() => {
            this.runEvaluationCycle().catch((err) => console.error('[DeploymentMonitorWorker] Error in evaluation cycle:', err));
        }, intervalMs);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[DeploymentMonitorWorker] Stopped background worker');
    }
    async runEvaluationCycle() {
        try {
            const currentActive = await Deployment_1.default.findOne({
                environment: 'production',
                isCurrent: true,
                deploymentStatus: 'SUCCESS',
            });
            if (currentActive) {
                await deploymentService_1.DeploymentService.evaluatePostDeploymentHealth(currentActive.deploymentId);
            }
        }
        catch (err) {
            console.error('[DeploymentMonitorWorker] Evaluation cycle failed:', err.message);
        }
    }
    async seedDefaultDeployments() {
        try {
            const count = await Deployment_1.default.countDocuments({ environment: 'production' });
            if (count > 0) {
                return;
            }
            console.log('[DeploymentMonitorWorker] Seeding realistic demo deployment history...');
            // Ensure Policy
            await deploymentService_1.DeploymentService.getOrCreatePolicy('production');
            const now = new Date();
            const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000);
            const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
            const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 3600 * 1000);
            const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
            // 1. Current Live Release: v1.8.4
            await Deployment_1.default.create({
                deploymentId: 'dep_live_v1_8_4',
                version: 'v1.8.4',
                previousVersion: 'v1.8.3',
                commitHash: '9f8a3c2e1b4a',
                commitMessage: 'feat(deployments): production deployment monitoring and safe rollback engine',
                branch: 'main',
                environment: 'production',
                server: 'ip-172-31-18-29 (AWS EC2 us-east-1)',
                deployedAt: twoHoursAgo,
                deployedBy: 'DevOps Admin',
                deploymentStatus: 'SUCCESS',
                isCurrent: true,
                buildDurationMs: 24800,
                deployDurationMs: 11200,
                totalDurationMs: 36000,
                healthCheckResult: {
                    status: 'PASS',
                    healthScore: 98,
                    checks: [
                        { name: 'Database Liveness & Ping', status: 'PASS', latencyMs: 12, details: 'Connected to MongoDB primary' },
                        { name: 'Core CRM API Routes Availability', status: 'PASS', latencyMs: 18, details: '200 OK across /api endpoints' },
                        { name: 'Background Workers & Schedulers', status: 'PASS', latencyMs: 2, details: '10/10 workers nominal' },
                        { name: 'Cryptographic Subsystem & Secret Masking', status: 'PASS', latencyMs: 1, details: 'HMAC-SHA256 zero-raw-key validation verified' },
                    ],
                    evaluatedAt: twoHoursAgo,
                },
                smokeTestResult: {
                    status: 'PASS',
                    passedCount: 8,
                    totalCount: 8,
                    durationMs: 412,
                    testSuites: [
                        { name: 'Database Connectivity & ReadyState', category: 'Database', passed: true, latencyMs: 14 },
                        { name: 'Cryptographic Subsystem & HMAC Entropy', category: 'Security', passed: true, latencyMs: 3 },
                        { name: 'JWT Sign & Verify Authentication Pipeline', category: 'Authentication', passed: true, latencyMs: 5 },
                        { name: 'Time-Series Aggregation & Metric Buckets', category: 'Observability', passed: true, latencyMs: 8 },
                        { name: 'Multi-Tenant Lead Pipeline Schema', category: 'Core CRM', passed: true, latencyMs: 11 },
                        { name: 'Incident Management & Alert Engine State', category: 'Alerting', passed: true, latencyMs: 6 },
                        { name: 'Event Loop Lag & Async I/O Responsiveness', category: 'System Performance', passed: true, latencyMs: 5 },
                        { name: 'Process Memory & Heap Allocation', category: 'System Resources', passed: true, latencyMs: 1 },
                    ],
                    executedAt: twoHoursAgo,
                },
                changelog: [
                    'feat(deployments): production deployment monitoring and safe rollback engine',
                    'feat(apikeys): secure zero-raw-key API token management module',
                    'perf(mongo): compound indexes on leads, campaigns, and metrics',
                    'fix(rate-limit): sliding window precision under high concurrency',
                ],
                postDeploymentMetrics: {
                    evaluatedAt: now,
                    errorRateBefore: 0.12,
                    errorRateAfter: 0.14,
                    errorCount15m: 1,
                    errorCount1h: 3,
                    latencyP95BeforeMs: 44,
                    latencyP95AfterMs: 46,
                    topPostDeployErrors: [
                        {
                            message: 'Minor non-blocking rate limit warning on external webhook sync',
                            count: 2,
                            firstSeen: twoHoursAgo,
                        },
                    ],
                },
                isSuspicious: false,
                logs: [
                    { timestamp: twoHoursAgo, stage: 'BUILD', message: 'Build v1.8.4 initialized from commit 9f8a3c2', level: 'INFO' },
                    { timestamp: twoHoursAgo, stage: 'DEPLOY', message: 'PM2 cluster reloaded zero-downtime', level: 'INFO' },
                    { timestamp: twoHoursAgo, stage: 'HEALTH_CHECK', message: 'All health checks and 8/8 smoke tests passed', level: 'SUCCESS' },
                    { timestamp: twoHoursAgo, stage: 'SUCCESS', message: 'Deployment v1.8.4 live in production', level: 'SUCCESS' },
                ],
                cicdMetadata: {
                    ciProvider: 'GitHub Actions',
                    pipelineId: 'gh_run_8492041',
                    runNumber: 142,
                    trigger: 'Push to main',
                    repository: 'mayalok-ventures/mobile-crm',
                },
            });
            // 2. Previous Stable Release: v1.8.3
            await Deployment_1.default.create({
                deploymentId: 'dep_prod_v1_8_3',
                version: 'v1.8.3',
                previousVersion: 'v1.8.1',
                commitHash: '7e2d5a1b3c4f',
                commitMessage: 'feat(usage): multi-tenant resource capacity monitoring and limits',
                branch: 'main',
                environment: 'production',
                server: 'ip-172-31-18-29 (AWS EC2 us-east-1)',
                deployedAt: twoDaysAgo,
                deployedBy: 'CI/CD Pipeline',
                deploymentStatus: 'SUCCESS',
                isCurrent: false,
                buildDurationMs: 22400,
                deployDurationMs: 10800,
                totalDurationMs: 33200,
                healthCheckResult: {
                    status: 'PASS',
                    healthScore: 99,
                    checks: [
                        { name: 'Database Liveness & Ping', status: 'PASS', latencyMs: 10, details: 'OK' },
                        { name: 'Core CRM API Routes Availability', status: 'PASS', latencyMs: 15, details: 'OK' },
                    ],
                    evaluatedAt: twoDaysAgo,
                },
                smokeTestResult: {
                    status: 'PASS',
                    passedCount: 8,
                    totalCount: 8,
                    durationMs: 385,
                    testSuites: [],
                    executedAt: twoDaysAgo,
                },
                changelog: [
                    'feat(usage): multi-tenant resource capacity monitoring and limits',
                    'feat(integrations): external CRM integration uptime checker',
                    'fix(auth): TOTP multi-factor session grace period',
                ],
                logs: [
                    { timestamp: twoDaysAgo, stage: 'SUCCESS', message: 'Deployment v1.8.3 live in production', level: 'SUCCESS' },
                ],
                cicdMetadata: {
                    ciProvider: 'GitHub Actions',
                    pipelineId: 'gh_run_8381920',
                    runNumber: 139,
                    trigger: 'Release tag v1.8.3',
                    repository: 'mayalok-ventures/mobile-crm',
                },
            });
            // 3. Rolled-Back Release: v1.8.2
            await Deployment_1.default.create({
                deploymentId: 'dep_prod_v1_8_2',
                version: 'v1.8.2',
                previousVersion: 'v1.8.1',
                commitHash: '4b3c2a1e0f9d',
                commitMessage: 'feat(webhooks): real-time WhatsApp incoming payload streaming',
                branch: 'main',
                environment: 'production',
                server: 'ip-172-31-18-29 (AWS EC2 us-east-1)',
                deployedAt: fiveDaysAgo,
                deployedBy: 'DevOps Admin',
                deploymentStatus: 'ROLLED_BACK',
                isCurrent: false,
                buildDurationMs: 26000,
                deployDurationMs: 14000,
                totalDurationMs: 40000,
                healthCheckResult: {
                    status: 'DEGRADED',
                    healthScore: 72,
                    checks: [
                        { name: 'Database Liveness', status: 'PASS', latencyMs: 12 },
                        { name: 'Webhook Streaming Ingestion', status: 'FAIL', latencyMs: 1200, details: '503 Rate limit overflow' },
                    ],
                    evaluatedAt: fiveDaysAgo,
                },
                smokeTestResult: {
                    status: 'FAIL',
                    passedCount: 6,
                    totalCount: 8,
                    durationMs: 512,
                    testSuites: [],
                    executedAt: fiveDaysAgo,
                },
                changelog: ['feat(webhooks): real-time WhatsApp incoming payload streaming'],
                rollbackDetails: {
                    rolledBackAt: new Date(fiveDaysAgo.getTime() + 1800000),
                    rolledBackBy: 'DevOps Admin',
                    targetVersion: 'v1.8.1',
                    targetDeploymentId: 'dep_prod_v1_8_1',
                    reason: 'Elevated 503 error rate and webhook connection queue latency on node workers',
                    isAutomated: false,
                },
                logs: [
                    { timestamp: fiveDaysAgo, stage: 'DEPLOY', message: 'Deployment initialized', level: 'INFO' },
                    { timestamp: fiveDaysAgo, stage: 'HEALTH_CHECK', message: 'Degraded health score detected (72%)', level: 'WARN' },
                    { timestamp: new Date(fiveDaysAgo.getTime() + 1800000), stage: 'ROLLBACK', message: 'Safe rollback executed to v1.8.1 by DevOps Admin', level: 'WARN' },
                ],
            });
            // 4. Historical Stable Release: v1.8.1
            await Deployment_1.default.create({
                deploymentId: 'dep_prod_v1_8_1',
                version: 'v1.8.1',
                previousVersion: 'v1.8.0',
                commitHash: '3a2b1c0e9f8d',
                commitMessage: 'feat(security): IP abuse detection and rate limit shield',
                branch: 'main',
                environment: 'production',
                server: 'ip-172-31-18-29 (AWS EC2 us-east-1)',
                deployedAt: tenDaysAgo,
                deployedBy: 'CI/CD Pipeline',
                deploymentStatus: 'SUCCESS',
                isCurrent: false,
                buildDurationMs: 21000,
                deployDurationMs: 9800,
                totalDurationMs: 30800,
                healthCheckResult: {
                    status: 'PASS',
                    healthScore: 97,
                    checks: [],
                    evaluatedAt: tenDaysAgo,
                },
                smokeTestResult: {
                    status: 'PASS',
                    passedCount: 8,
                    totalCount: 8,
                    durationMs: 370,
                    testSuites: [],
                    executedAt: tenDaysAgo,
                },
                changelog: [
                    'feat(security): IP abuse detection and rate limit shield',
                    'feat(audit): immutable admin audit logging',
                ],
                logs: [
                    { timestamp: tenDaysAgo, stage: 'SUCCESS', message: 'Deployment v1.8.1 live in production', level: 'SUCCESS' },
                ],
            });
            console.log('[DeploymentMonitorWorker] Successfully seeded demo deployment records.');
        }
        catch (err) {
            console.error('[DeploymentMonitorWorker] Failed to seed demo deployments:', err.message);
        }
    }
}
exports.DeploymentMonitorWorker = DeploymentMonitorWorker;
exports.deploymentMonitorWorker = DeploymentMonitorWorker.getInstance();
exports.default = exports.deploymentMonitorWorker;
