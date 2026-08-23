import { Request, Response } from 'express';
export declare const auditController: {
    /**
     * GET /api/admin/audit/timeline
     * Returns filterable, paginated audit log timeline
     */
    getAuditTimeline: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/audit/stats
     * Returns audit statistics and breakdown
     */
    getAuditStats: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/audit/:id
     * Returns single audit log detail with full diffs
     */
    getAuditLogById: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/audit/export
     * Exports filtered audit log trail as CSV or JSON
     */
    exportAuditLogs: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/admin/audit/archive
     * Triggers cold storage archive with SHA256 integrity seal
     */
    archiveAuditLogs: (req: Request, res: Response) => Promise<void>;
};
