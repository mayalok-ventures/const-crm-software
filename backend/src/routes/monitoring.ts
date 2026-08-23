import express from 'express';
import { handleHeartbeat } from '../monitoring/controllers/monitoringController';

const router = express.Router();

// Ingestion endpoint for heartbeats (exempted from admin protection)
router.post('/heartbeat', handleHeartbeat);

export default router;
export const monitoringRoutes = router;
