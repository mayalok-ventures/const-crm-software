import { Request, Response } from 'express';
export declare class PlatformHealthController {
    private static instance;
    static getInstance(): PlatformHealthController;
    /**
     * GET /api/admin/platform-health
     * Returns current master health score, 12 components, top deductions, and trends summary.
     */
    getPlatformHealth(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/platform-health/components
     * Returns all 12 platform components with their scores, status, confidence, metricsUsed, deductions, and weights.
     */
    getAllComponents(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/platform-health/components/:componentId
     * Returns detailed score breakdown, raw metrics, and deduction log for a specific component.
     */
    getComponentDetails(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/platform-health/incidents
     * Aggregates real-time incidents, active alerts, recent deployments, recent errors, slowest APIs, server statuses, and database diagnostics.
     */
    getPlatformIncidents(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/platform-health/history?range=24h
     * Returns historical time-series data for charting.
     */
    getHistory(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/admin/platform-health/config
     * Returns configurable weights, thresholds, and circuit breaker settings.
     */
    getConfig(req: Request, res: Response): Promise<void>;
    /**
     * PUT /api/admin/platform-health/config
     * Updates health scoring weights and circuit breakers.
     */
    updateConfig(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/admin/platform-health/recalculate
     * Forces immediate on-demand evaluation and snapshot persistence.
     */
    recalculateNow(req: Request, res: Response): Promise<void>;
}
export declare const platformHealthController: PlatformHealthController;
export default platformHealthController;
