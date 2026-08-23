import { Request, Response } from 'express';
/**
 * GET /health and GET /api/health
 * Standard summary health endpoint
 */
export declare const getHealth: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /health/live and GET /api/health/live
 * Kubernetes Liveness Probe
 */
export declare const getLive: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /health/ready and GET /api/health/ready
 * Kubernetes Readiness Probe
 */
export declare const getReady: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /health/detailed and GET /api/health/detailed
 * Deep diagnostics with component statuses, latency breakdown, and scores
 */
export declare const getDetailed: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
declare const _default: {
    getHealth: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    getLive: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    getReady: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    getDetailed: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
};
export default _default;
