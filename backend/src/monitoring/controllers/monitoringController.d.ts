import { Request, Response } from 'express';
export declare class MonitoringController {
    private healthCalculator;
    /**
     * Public Heartbeat Ingestion Endpoint
     * POST /api/monitoring/heartbeat
     */
    handleHeartbeat: (req: Request, res: Response) => Promise<void>;
    /**
     * List all registered servers
     * GET /api/admin/monitoring/servers and GET /api/admin/servers
     */
    getServers: (req: Request, res: Response) => Promise<void>;
    /**
     * Get server details
     * GET /api/admin/monitoring/servers/:serverId
     */
    getServerDetails: (req: Request, res: Response) => Promise<void>;
    /**
     * Get current server metric
     * GET /api/admin/monitoring/servers/:serverId/current
     */
    getCurrentMetric: (req: Request, res: Response) => Promise<void>;
    /**
     * Get server metric history
     * GET /api/admin/monitoring/servers/:serverId/history
     */
    getMetricHistory: (req: Request, res: Response) => Promise<void>;
    /**
     * Get server health calculation breakdown
     * GET /api/admin/monitoring/servers/:serverId/health and GET /api/admin/servers/:id/health
     */
    getServerHealth: (req: Request, res: Response) => Promise<void>;
    /**
     * Get server heartbeat logs
     * GET /api/admin/servers/:id/heartbeat-history
     */
    getHeartbeatHistory: (req: Request, res: Response) => Promise<void>;
    /**
     * Get server transition events logs
     * GET /api/admin/servers/:id/status-events
     */
    getStatusEvents: (req: Request, res: Response) => Promise<void>;
    /**
     * Get system-wide API performance dashboards metrics
     * GET /api/admin/monitoring/api-performance
     */
    getApiPerformance: (req: Request, res: Response) => Promise<void>;
    /**
     * Helper: Calculate server uptime statistics from incidents
     */
    private calculateServerUptimeStats;
}
declare const controller: MonitoringController;
export default controller;
export declare const handleHeartbeat: (req: Request, res: Response) => Promise<void>;
export declare const getServers: (req: Request, res: Response) => Promise<void>;
export declare const getServerDetails: (req: Request, res: Response) => Promise<void>;
export declare const getCurrentMetric: (req: Request, res: Response) => Promise<void>;
export declare const getMetricHistory: (req: Request, res: Response) => Promise<void>;
export declare const getServerHealth: (req: Request, res: Response) => Promise<void>;
export declare const getHeartbeatHistory: (req: Request, res: Response) => Promise<void>;
export declare const getStatusEvents: (req: Request, res: Response) => Promise<void>;
export declare const getApiPerformance: (req: Request, res: Response) => Promise<void>;
