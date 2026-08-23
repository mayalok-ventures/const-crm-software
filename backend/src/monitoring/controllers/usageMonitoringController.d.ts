import { Request, Response } from 'express';
export declare class UsageMonitoringController {
    /**
     * GET /api/admin/usage/overview
     * Returns high-level capacity fleet metrics, top consumers, fastest growing, and near limits
     */
    getOverview(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/usage/organizations
     * Returns filterable/searchable organizations with resource usage bars
     */
    getOrganizations(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/usage/organizations/:id
     * Deep drill-down for single organization including 30-day historical time-series
     */
    getOrganizationById(req: Request, res: Response): Promise<void>;
    /**
     * PUT /api/admin/usage/organizations/:id/limits
     * Updates plan limits or custom overrides for an organization
     */
    updateOrganizationLimits(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/usage/alerts
     * Returns active or all usage threshold alerts
     */
    getAlerts(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/usage/alerts/:id/acknowledge
     * Marks a usage alert as acknowledged
     */
    acknowledgeAlert(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/usage/recalculate
     * Manually triggers full fleet usage aggregation
     */
    triggerRecalculate(req: Request, res: Response): Promise<void>;
}
export declare const usageMonitoringController: UsageMonitoringController;
export default usageMonitoringController;
