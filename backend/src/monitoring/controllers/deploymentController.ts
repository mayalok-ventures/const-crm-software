import { Request, Response } from 'express';
import { DeploymentService } from '../deployment/deploymentService';

export class DeploymentController {
  /**
   * GET /api/admin/deployments/current
   */
  public static async getCurrentOverview(req: Request, res: Response): Promise<void> {
    try {
      const environment = (req.query.environment as string) || 'production';
      const overview = await DeploymentService.getCurrentOverview(environment);
      res.json({
        success: true,
        ...overview,
      });
    } catch (err: any) {
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
  public static async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const environment = req.query.environment as string;
      const status = req.query.status as string;
      const search = req.query.search as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await DeploymentService.getDeploymentHistory(
        { environment, status, search },
        limit,
        offset
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
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
  public static async getDeploymentById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await DeploymentService.getDeploymentById(id);
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
    } catch (err: any) {
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
  public static async createDeployment(req: Request, res: Response): Promise<void> {
    try {
      const {
        version,
        previousVersion,
        commitHash,
        commitMessage,
        branch,
        environment,
        server,
        changelog,
        cicdMetadata,
      } = req.body;

      if (!version || !commitHash) {
        res.status(400).json({
          success: false,
          message: 'Version and commitHash are required',
        });
        return;
      }

      const deployedBy = (req as any).user?.name || (req as any).user?.email || 'DevOps Admin';

      const deployment = await DeploymentService.startDeployment({
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
    } catch (err: any) {
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
  public static async updateStage(req: Request, res: Response): Promise<void> {
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

      const deployment = await DeploymentService.advanceDeploymentStage(id, stage, {
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
    } catch (err: any) {
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
  public static async runSmokeTests(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deployment = await DeploymentService.runHealthAndSmokeTests(id);

      res.json({
        success: true,
        message: `Health checks and smoke tests executed for ${deployment.version} (Status: ${deployment.deploymentStatus})`,
        deployment,
      });
    } catch (err: any) {
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
  public static async triggerRollback(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { targetVersion, reason } = req.body;
      const performedBy = (req as any).user?.name || (req as any).user?.email || 'DevOps Admin';

      if (!targetVersion) {
        res.status(400).json({
          success: false,
          message: 'Target version to rollback to is required',
        });
        return;
      }

      const result = await DeploymentService.triggerRollback(
        id,
        targetVersion,
        performedBy,
        reason || 'Manual administrator rollback triggered from dashboard',
        false
      );

      res.json({
        message: `Successfully rolled back ${result.rolledBackVersion} to ${result.activeVersion}`,
        ...result,
      });
    } catch (err: any) {
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
  public static async getIncidents(req: Request, res: Response): Promise<void> {
    try {
      const environment = (req.query.environment as string) || 'production';
      const incidents = await DeploymentService.getIncidents(environment);
      res.json({
        success: true,
        incidents,
      });
    } catch (err: any) {
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
  public static async resolveIncident(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { resolutionNotes } = req.body;
      const resolvedBy = (req as any).user?.name || (req as any).user?.email || 'DevOps Admin';

      const incident = await DeploymentService.resolveIncident(
        id,
        resolvedBy,
        resolutionNotes || 'Marked resolved by admin'
      );

      res.json({
        success: true,
        message: 'Deployment incident resolved successfully',
        incident,
      });
    } catch (err: any) {
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
  public static async getPolicy(req: Request, res: Response): Promise<void> {
    try {
      const environment = (req.query.environment as string) || 'production';
      const policy = await DeploymentService.getOrCreatePolicy(environment);
      res.json({
        success: true,
        policy,
      });
    } catch (err: any) {
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
  public static async updatePolicy(req: Request, res: Response): Promise<void> {
    try {
      const environment = (req.body.environment as string) || 'production';
      const updates = req.body;
      const updatedBy = (req as any).user?.name || (req as any).user?.email || 'DevOps Admin';

      const policy = await DeploymentService.updatePolicy(environment, {
        ...updates,
        updatedBy,
      });

      res.json({
        success: true,
        message: 'Deployment and safe rollback policy updated successfully',
        policy,
      });
    } catch (err: any) {
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
  public static async ciCdWebhook(req: Request, res: Response): Promise<void> {
    try {
      const {
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
      } = req.body;

      if (!version || !commitHash || !stage) {
        res.status(400).json({
          success: false,
          message: 'version, commitHash, and stage are required in CI/CD webhook',
        });
        return;
      }

      const deployment = await DeploymentService.recordCiCdStage({
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
    } catch (err: any) {
      console.error('[DeploymentController] ciCdWebhook error:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to process CI/CD webhook',
      });
    }
  }
}

export const deploymentController = DeploymentController;
export default DeploymentController;
