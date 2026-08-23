import { Request, Response } from 'express';
export declare class LoggingController {
    /**
     * GET /api/admin/logs
     * Query filterable structured system logs with pagination
     */
    getLogs: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/logs/stream
     * Fetch in-memory ring-buffer for live stream visualization
     */
    getLiveStream: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/admin/logs/:id
     * Get complete log item by ID
     */
    getLogById: (req: Request, res: Response) => Promise<void>;
}
export declare const loggingController: LoggingController;
export default loggingController;
