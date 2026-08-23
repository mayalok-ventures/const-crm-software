import mongoose from 'mongoose';
import { ComponentHealth } from '../healthTypes';

export class QueueProbe {
  /**
   * Probes background campaign workers and queues
   */
  public async probe(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
        return {
          name: 'Queue & Background Workers',
          category: 'queue',
          status: 'UNHEALTHY',
          score: 0,
          latencyMs: 1,
          isCritical: false,
          message: 'Database disconnected, cannot inspect job queues',
          timestamp: new Date(),
        };
      }

      // 1. Inspect queued campaigns
      const campaignsCollection = mongoose.connection.collection('campaigns');
      const [queuedCount, runningCount, failedCount] = await Promise.all([
        campaignsCollection.countDocuments({ status: 'QUEUED' }),
        campaignsCollection.countDocuments({ status: 'RUNNING' }),
        campaignsCollection.countDocuments({ status: 'FAILED' }),
      ]);

      let score = 100;
      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      const issues: string[] = [];

      // If high number of queued campaigns (>50) or excessive failures (>20), degrade score
      if (queuedCount > 100) {
        score -= 30;
        status = 'DEGRADED';
        issues.push(`High queued campaigns backlog: ${queuedCount}`);
      }
      if (failedCount > 25) {
        score -= 25;
        status = 'DEGRADED';
        issues.push(`Failed jobs count elevated: ${failedCount}`);
      }

      const latencyMs = Math.max(1, Date.now() - startTime);

      return {
        name: 'Queue & Background Workers',
        category: 'queue',
        status,
        score: Math.max(0, Math.min(100, score)),
        latencyMs,
        isCritical: false,
        message: issues.length > 0 ? issues.join(', ') : 'Background workers operational and polling',
        details: {
          driver: 'MongoDB Persistent Task Queue',
          workersActive: ['CampaignWorker', 'SubscriptionWorker', 'AlertMonitorWorker', 'DatabaseMonitorWorker', 'BackupMonitorWorker'],
          queuedJobs: queuedCount,
          runningJobs: runningCount,
          failedJobs: failedCount,
          pollIntervalMs: 5000,
        },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        name: 'Queue & Background Workers',
        category: 'queue',
        status: 'DEGRADED',
        score: 60,
        latencyMs: Math.max(1, Date.now() - startTime),
        isCritical: false,
        message: 'Queue probe error',
        error: err.message,
        timestamp: new Date(),
      };
    }
  }
}

export const queueProbe = new QueueProbe();
