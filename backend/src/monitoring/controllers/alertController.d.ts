import { Request, Response } from 'express';
/**
 * GET /api/admin/alerts/overview
 */
export declare const getAlertOverview: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/admin/alerts/incidents
 */
export declare const getIncidents: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/admin/alerts/incidents/:id
 */
export declare const getIncidentById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/admin/alerts/incidents/:id/acknowledge
 */
export declare const acknowledgeIncident: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/admin/alerts/incidents/:id/resolve
 */
export declare const resolveIncident: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/admin/alerts/incidents/:id/escalate
 */
export declare const escalateIncident: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/admin/alerts/rules
 */
export declare const getAlertRules: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/admin/alerts/rules
 */
export declare const createAlertRule: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * PUT /api/admin/alerts/rules/:id
 */
export declare const updateAlertRule: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * DELETE /api/admin/alerts/rules/:id
 */
export declare const deleteAlertRule: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/admin/alerts/rules/:id/toggle
 */
export declare const toggleAlertRule: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/admin/alerts/channels
 */
export declare const getNotificationChannels: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/admin/alerts/channels
 */
export declare const createNotificationChannel: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * PUT /api/admin/alerts/channels/:id
 */
export declare const updateNotificationChannel: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * DELETE /api/admin/alerts/channels/:id
 */
export declare const deleteNotificationChannel: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/admin/alerts/channels/:id/test
 */
export declare const testNotificationChannel: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/admin/alerts/deliveries
 */
export declare const getNotificationDeliveries: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/admin/alerts/simulate
 * Simulates a metric anomaly to verify end-to-end alert triggering, incident correlation, and notification dispatch
 */
export declare const simulateAnomaly: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
