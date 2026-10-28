import { Request, Response } from 'express';
import { healthCheckService } from '../health/HealthCheckService';

/**
 * GET /health and GET /api/health
 * Standard summary health endpoint
 */
export const getHealth = async (req: Request, res: Response) => {
  try {
    const summary = await healthCheckService.getSummary();
    const statusCode = summary.status === 'UNHEALTHY' ? 503 : 200;

    return res.status(statusCode).json({
      status: summary.status,
      overallScore: summary.overallScore,
      uptimeSeconds: summary.uptimeSeconds,
      gitCommit: summary.gitCommit,
      timestamp: summary.timestamp,
      components: summary.components,
    });
  } catch (error: any) {
    console.error('Error executing health check:', error);
    return res.status(503).json({
      status: 'UNHEALTHY',
      overallScore: 0,
      error: error.message || 'Health check failed',
      timestamp: new Date(),
    });
  }
};

/**
 * GET /health/live and GET /api/health/live
 * Kubernetes Liveness Probe
 */
export const getLive = async (req: Request, res: Response) => {
  try {
    const liveness = await healthCheckService.getLiveness();
    const statusCode = liveness.status === 'UNHEALTHY' ? 500 : 200;

    return res.status(statusCode).json(liveness);
  } catch (error: any) {
    return res.status(500).json({
      status: 'UNHEALTHY',
      liveness: false,
      error: error.message || 'Liveness check failed',
      timestamp: new Date(),
    });
  }
};

/**
 * GET /health/ready and GET /api/health/ready
 * Kubernetes Readiness Probe
 */
export const getReady = async (req: Request, res: Response) => {
  try {
    const readiness = await healthCheckService.getReadiness();
    const statusCode = readiness.ready ? 200 : 503;

    return res.status(statusCode).json(readiness);
  } catch (error: any) {
    return res.status(503).json({
      status: 'UNHEALTHY',
      ready: false,
      error: error.message || 'Readiness check failed',
      timestamp: new Date(),
    });
  }
};

/**
 * GET /health/detailed and GET /api/health/detailed
 * Deep diagnostics with component statuses, latency breakdown, and scores
 */
export const getDetailed = async (req: Request, res: Response) => {
  try {
    const forceFresh = req.query.fresh === 'true';
    const detailed = await healthCheckService.getDetailed(forceFresh);
    const statusCode = detailed.status === 'UNHEALTHY' ? 503 : 200;

    return res.status(statusCode).json(detailed);
  } catch (error: any) {
    console.error('Error executing detailed health check:', error);
    return res.status(503).json({
      status: 'UNHEALTHY',
      overallScore: 0,
      error: error.message || 'Detailed health check failed',
      timestamp: new Date(),
    });
  }
};

export default {
  getHealth,
  getLive,
  getReady,
  getDetailed,
};
