import { Request, Response } from 'express';
export declare class BackupController {
    /**
     * GET /api/admin/backups/overview
     * Returns instantaneous 0ms cached telemetry state
     */
    getBackupOverview(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/backups/history
     * Filterable historical backup executions
     */
    getBackupHistory(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/backups/records/:id
     * Deep record inspection
     */
    getBackupRecordById(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/backups/policies
     * List backup policies
     */
    getBackupPolicies(req: Request, res: Response): Promise<void>;
    /**
     * PUT /api/admin/backups/policies/:id
     * Update policy schedule, retention, or active status
     */
    updateBackupPolicy(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/backups/incidents
     * List detected backup incidents & anomalies
     */
    getBackupIncidents(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/backups/incidents/:id/acknowledge
     */
    acknowledgeIncident(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/backups/incidents/:id/resolve
     */
    resolveIncident(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/backups/trigger
     * Trigger on-demand backup execution
     */
    triggerManualBackup(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/backups/verify/:id
     * Execute on-demand 4-tier integrity & restore verification
     */
    verifyBackupIntegrity(req: Request, res: Response): Promise<void>;
}
export declare const backupController: BackupController;
export default backupController;
