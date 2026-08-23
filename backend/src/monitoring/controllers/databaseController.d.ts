import { Request, Response } from 'express';
/**
 * GET /health/database & GET /api/health/database
 * Dedicated health check for MongoDB database status.
 * Responds with HTTP 200 when operational, or HTTP 503 if disconnected.
 */
export declare function getDatabaseHealthEndpoint(req: Request, res: Response): Promise<void>;
/**
 * GET /api/admin/database/overview
 * Returns complete database health metrics, score breakdown, connection counts, and cluster state.
 */
export declare function getDatabaseOverview(req: Request, res: Response): Promise<void>;
/**
 * GET /api/admin/database/collections
 * Returns collections table with document count, size, index count, and storage breakdown.
 */
export declare function getDatabaseCollections(req: Request, res: Response): Promise<void>;
/**
 * GET /api/admin/database/metrics?range=1h|24h|7d
 * Returns historical time-series database metrics (ping latency, connections, DB size).
 */
export declare function getDatabaseMetrics(req: Request, res: Response): Promise<void>;
/**
 * GET /api/admin/database/slow-queries
 * Returns list of recent slow operations.
 */
export declare function getSlowQueries(req: Request, res: Response): Promise<void>;
/**
 * POST /api/admin/database/ping
 * Executes live manual ping against MongoDB and returns round-trip latency.
 */
export declare function pingDatabase(req: Request, res: Response): Promise<void>;
declare const _default: {
    getDatabaseHealthEndpoint: typeof getDatabaseHealthEndpoint;
    getDatabaseOverview: typeof getDatabaseOverview;
    getDatabaseCollections: typeof getDatabaseCollections;
    getDatabaseMetrics: typeof getDatabaseMetrics;
    getSlowQueries: typeof getSlowQueries;
    pingDatabase: typeof pingDatabase;
};
export default _default;
