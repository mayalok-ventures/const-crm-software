import { Request, Response } from 'express';
export declare class ErrorTrackingController {
    /**
     * GET /api/admin/errors/groups
     * List grouped errors with search, status filters, and pagination
     */
    getErrorGroups: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/errors/groups/:fingerprint
     * Get detailed group overview and recent occurrences
     */
    getErrorGroupDetails: (req: Request, res: Response) => Promise<void>;
    /**
     * PATCH /api/admin/errors/groups/:fingerprint/status
     * Update resolution status: OPEN, ACKNOWLEDGED, RESOLVED, IGNORED
     */
    updateErrorGroupStatus: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/admin/errors/groups/:fingerprint/notes
     * Add an admin comment or note to the error group
     */
    addErrorGroupNote: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/errors/stats
     * Summary metrics & Error Health Score (0-100)
     */
    getErrorStats: (req: Request, res: Response) => Promise<void>;
}
export declare const errorTrackingController: ErrorTrackingController;
export default errorTrackingController;
