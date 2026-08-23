"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deploymentController = exports.DeploymentController = void 0;
const deploymentService_1 = require("../deployment/deploymentService");
class DeploymentController {
    /**
     * GET /api/admin/deployments/current
     */
    static async getCurrentOverview(req, res) {
        try {
            const environment = req.query.environment || 'production';
            const overview = await deploymentService_1.DeploymentService.getCurrentOverview(environment);
            res.json({
                success: true,
                ...overview,
            });
        }
        catch (err) {
            console.error('[DeploymentController] getCurrentOverview error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to fetch current deployment overview',
            });
        }
    }
    /**
     * GET /api/admin/deployments/history
     */
    static async getHistory(req, res) {
        try {
            const environment = req.query.environment;
            const status = req.query.status;
            const search = req.query.search;
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;
            const result = await deploymentService_1.DeploymentService.getDeploymentHistory({ environment, status, search }, limit, offset);
            res.json({
                success: true,
                ...result,
            });
        }
        catch (err) {
            console.error('[DeploymentController] getHistory error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to fetch deployment history',
            });
        }
    }
    /**
     * GET /api/admin/deployments/:id
     */
    static async getDeploymentById(req, res) {
        try {
            const { id } = req.params;
            const result = await deploymentService_1.DeploymentService.getDeploymentById(id);
            if (!result) {
                res.status(404).json({
                    success: false,
                    message: `Deployment ${id} not found`,
                });
                return;
            }
            res.json({
                success: true,
                ...result,
            });
        }
        catch (err) {
            console.error('[DeploymentController] getDeploymentById error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to fetch deployment details',
            });
        }
    }
    /**
     * POST /api/admin/deployments
     */
    static async createDeployment(req, res) {
        try {
            const { version, previousVersion, commitHash, commitMessage, branch, environment, server, changelog, cicdMetadata, } = req.body;
            if (!version || !commitHash) {
                res.status(400).json({
                    success: false,
                    message: 'Version and commitHash are required',
                });
                return;
            }
            const deployedBy = req.user?.name || req.user?.email || 'DevOps Admin';
            const deployment = await deploymentService_1.DeploymentService.startDeployment({
                version,
                previousVersion,
                commitHash,
                commitMessage,
                branch,
                environment,
                server,
                deployedBy,
                changelog,
                cicdMetadata,
            });
            res.status(201).json({
                success: true,
                message: `Deployment ${version} initiated successfully in BUILDING stage`,
                deployment,
            });
        }
        catch (err) {
            console.error('[DeploymentController] createDeployment error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to create deployment',
            });
        }
    }
    /**
     * POST /api/admin/deployments/:id/stage
     */
    static async updateStage(req, res) {
        try {
            const { id } = req.params;
            const { stage, buildDurationMs, deployDurationMs, logMessage, errorMessage } = req.body;
            if (!stage) {
                res.status(400).json({
                    success: false,
                    message: 'Target stage is required',
                });
                return;
            }
            const deployment = await deploymentService_1.DeploymentService.advanceDeploymentStage(id, stage, {
                buildDurationMs,
                deployDurationMs,
                logMessage,
                errorMessage,
            });
            res.json({
                success: true,
                message: `Deployment transitioned to ${stage}`,
                deployment,
            });
        }
        catch (err) {
            console.error('[DeploymentController] updateStage error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to update deployment stage',
            });
        }
    }
    /**
     * POST /api/admin/deployments/:id/smoke-tests
     */
    static async runSmokeTests(req, res) {
        try {
            const { id } = req.params;
            const deployment = await deploymentService_1.DeploymentService.runHealthAndSmokeTests(id);
            res.json({
                success: true,
                message: `Health checks and smoke tests executed for ${deployment.version} (Status: ${deployment.deploymentStatus})`,
                deployment,
            });
        }
        catch (err) {
            console.error('[DeploymentController] runSmokeTests error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to execute smoke tests',
            });
        }
    }
    /**
     * POST /api/admin/deployments/:id/rollback
     */
    static async triggerRollback(req, res) {
        try {
            const { id } = req.params;
            const { targetVersion, reason } = req.body;
            const performedBy = req.user?.name || req.user?.email || 'DevOps Admin';
            if (!targetVersion) {
                res.status(400).json({
                    success: false,
                    message: 'Target version to rollback to is required',
                });
                return;
            }
            const result = await deploymentService_1.DeploymentService.triggerRollback(id, targetVersion, performedBy, reason || 'Manual administrator rollback triggered from dashboard', false);
            res.json({
                message: `Successfully rolled back ${result.rolledBackVersion} to ${result.activeVersion}`,
                ...result,
            });
        }
        catch (err) {
            console.error('[DeploymentController] triggerRollback error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to execute rollback',
            });
        }
    }
    /**
     * GET /api/admin/deployments/incidents
     */
    static async getIncidents(req, res) {
        try {
            const environment = req.query.environment || 'production';
            const incidents = await deploymentService_1.DeploymentService.getIncidents(environment);
            res.json({
                success: true,
                incidents,
            });
        }
        catch (err) {
            console.error('[DeploymentController] getIncidents error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to fetch deployment incidents',
            });
        }
    }
    /**
     * POST /api/admin/deployments/incidents/:id/resolve
     */
    static async resolveIncident(req, res) {
        try {
            const { id } = req.params;
            const { resolutionNotes } = req.body;
            const resolvedBy = req.user?.name || req.user?.email || 'DevOps Admin';
            const incident = await deploymentService_1.DeploymentService.resolveIncident(id, resolvedBy, resolutionNotes || 'Marked resolved by admin');
            res.json({
                success: true,
                message: 'Deployment incident resolved successfully',
                incident,
            });
        }
        catch (err) {
            console.error('[DeploymentController] resolveIncident error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to resolve incident',
            });
        }
    }
    /**
     * GET /api/admin/deployments/policy
     */
    static async getPolicy(req, res) {
        try {
            const environment = req.query.environment || 'production';
            const policy = await deploymentService_1.DeploymentService.getOrCreatePolicy(environment);
            res.json({
                success: true,
                policy,
            });
        }
        catch (err) {
            console.error('[DeploymentController] getPolicy error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to fetch deployment policy',
            });
        }
    }
    /**
     * PUT /api/admin/deployments/policy
     */
    static async updatePolicy(req, res) {
        try {
            const environment = req.body.environment || 'production';
            const updates = req.body;
            const updatedBy = req.user?.name || req.user?.email || 'DevOps Admin';
            const policy = await deploymentService_1.DeploymentService.updatePolicy(environment, {
                ...updates,
                updatedBy,
            });
            res.json({
                success: true,
                message: 'Deployment and safe rollback policy updated successfully',
                policy,
            });
        }
        catch (err) {
            console.error('[DeploymentController] updatePolicy error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to update deployment policy',
            });
        }
    }
    /**
     * POST /api/admin/deployments/webhook (CI/CD Pipeline intake)
     */
    static async ciCdWebhook(req, res) {
        try {
            const { version, commitHash, commitMessage, branch, environment, server, stage, buildDurationMs, deployDurationMs, changelog, errorMessage, cicdMetadata, } = req.body;
            if (!version || !commitHash || !stage) {
                res.status(400).json({
                    success: false,
                    message: 'version, commitHash, and stage are required in CI/CD webhook',
                });
                return;
            }
            const deployment = await deploymentService_1.DeploymentService.recordCiCdStage({
                version,
                commitHash,
                commitMessage,
                branch,
                environment,
                server,
                stage,
                buildDurationMs,
                deployDurationMs,
                changelog,
                errorMessage,
                cicdMetadata,
            });
            res.json({
                success: true,
                message: `CI/CD stage "${stage}" processed for deployment ${version}`,
                deployment,
            });
        }
        catch (err) {
            console.error('[DeploymentController] ciCdWebhook error:', err);
            res.status(500).json({
                success: false,
                message: err.message || 'Failed to process CI/CD webhook',
            });
        }
    }
}
exports.DeploymentController = DeploymentController;
exports.deploymentController = DeploymentController;
exports.default = DeploymentController;
