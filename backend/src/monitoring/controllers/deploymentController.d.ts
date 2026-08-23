import { Request, Response } from 'express';
export declare class DeploymentController {
    /**
     * GET /api/admin/deployments/current
     */
    static getCurrentOverview(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/deployments/history
     */
    static getHistory(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/deployments/:id
     */
    static getDeploymentById(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/deployments
     */
    static createDeployment(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/deployments/:id/stage
     */
    static updateStage(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/deployments/:id/smoke-tests
     */
    static runSmokeTests(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/deployments/:id/rollback
     */
    static triggerRollback(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/deployments/incidents
     */
    static getIncidents(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/deployments/incidents/:id/resolve
     */
    static resolveIncident(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/deployments/policy
     */
    static getPolicy(req: Request, res: Response): Promise<void>;
    /**
     * PUT /api/admin/deployments/policy
     */
    static updatePolicy(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/deployments/webhook (CI/CD Pipeline intake)
     */
    static ciCdWebhook(req: Request, res: Response): Promise<void>;
}
export declare const deploymentController: typeof DeploymentController;
export default DeploymentController;
