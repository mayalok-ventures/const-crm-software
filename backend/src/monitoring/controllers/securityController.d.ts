import { Request, Response } from 'express';
export declare const securityController: {
    /**
     * GET /api/admin/security/stats
     * Returns Overall Security Score & Category Breakdown
     */
    getSecurityStats: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/security/events
     * Returns filterable security event stream
     */
    getSecurityEvents: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/security/incidents
     * Returns security incidents
     */
    getSecurityIncidents: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/security/incidents/:id
     */
    getSecurityIncidentDetails: (req: Request, res: Response) => Promise<void>;
    /**
     * PATCH /api/admin/security/incidents/:id/status
     */
    updateIncidentStatus: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/admin/security/incidents/:id/notes
     */
    addIncidentNote: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/security/blocked-ips
     */
    getBlockedIps: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/admin/security/blocked-ips
     */
    blockIp: (req: Request, res: Response) => Promise<void>;
    /**
     * DELETE /api/admin/security/blocked-ips/:ip
     */
    unblockIp: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/security/rules
     */
    getSecurityRules: (req: Request, res: Response) => Promise<void>;
    /**
     * PATCH /api/admin/security/rules/:ruleId
     */
    updateSecurityRule: (req: Request, res: Response) => Promise<void>;
};
