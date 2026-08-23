import { Request, Response } from 'express';
/**
 * GET /api/admin/integrations/overview
 * Returns dashboard summary and all monitored third-party integrations
 */
export declare const getOverview: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/admin/integrations/:id
 * Drill-down detail with request counts, success rate, latency timeline, recent error logs, and health score history
 */
export declare const getIntegrationById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/admin/integrations/:id/check
 * Runs safe on-demand probe for integration without consuming metered billable quota
 */
export declare const checkIntegration: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/admin/integrations/record-telemetry
 * Records telemetry from application services or synthetic test harnesses
 */
export declare const recordTelemetry: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * PUT /api/admin/integrations/:id/thresholds
 * Updates alert thresholds for an integration
 */
export declare const updateThresholds: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
declare const _default: {
    getOverview: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    getIntegrationById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    checkIntegration: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    recordTelemetry: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    updateThresholds: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
};
export default _default;
