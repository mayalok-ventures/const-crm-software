import mongoose from 'mongoose';
import { ComponentHealth } from '../healthTypes';

export class MongoProbe {
  /**
   * Probes MongoDB connection and ping response
   */
  public async probe(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      const readyState = mongoose.connection.readyState;
      const stateMap: Record<number, string> = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
      };
      const stateStr = stateMap[readyState] || 'unknown';

      const targetHost = mongoose.connection.host || 'unresolved';
      if (readyState !== 1 || !mongoose.connection.db) {
        return {
          name: 'MongoDB',
          category: 'database',
          status: 'UNHEALTHY',
          score: 0,
          latencyMs: Math.max(1, Date.now() - startTime),
          isCritical: true,
          message: `MongoDB connection state is ${stateStr} (readyState: ${readyState}, targetHost: ${targetHost})`,
          details: {
            connectionState: stateStr,
            readyState,
            databaseName: mongoose.connection.name || 'mobile-crm',
            targetHost,
            isOperational: false,
          },
          error: 'Database disconnected or not ready',
          timestamp: new Date(),
        };
      }

      // Execute ping
      const pingStart = Date.now();
      const pingResult = await mongoose.connection.db.admin().ping();
      const pingLatencyMs = Math.max(1, Date.now() - pingStart);

      let score = 100;
      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      const issues: string[] = [];

      if (pingLatencyMs > 1000) {
        score = 50;
        status = 'DEGRADED';
        issues.push(`High database ping latency: ${pingLatencyMs}ms`);
      } else if (pingLatencyMs > 400) {
        score = 80;
        status = 'DEGRADED';
        issues.push(`Elevated ping latency: ${pingLatencyMs}ms`);
      }

      const latencyMs = Math.max(1, Date.now() - startTime);

      return {
        name: 'MongoDB',
        category: 'database',
        status,
        score,
        latencyMs: pingLatencyMs,
        isCritical: true,
        message: issues.length > 0 ? issues.join(', ') : `MongoDB connected and responsive (${pingLatencyMs}ms)`,
        details: {
          connectionState: stateStr,
          readyState,
          pingLatencyMs,
          databaseName: mongoose.connection.name || 'mobile-crm',
          host: mongoose.connection.host || 'mongodb-cluster',
          isOperational: true,
          pingOk: pingResult?.ok === 1,
        },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        name: 'MongoDB',
        category: 'database',
        status: 'UNHEALTHY',
        score: 0,
        latencyMs: Math.max(1, Date.now() - startTime),
        isCritical: true,
        message: 'MongoDB ping failed or timed out',
        error: err.message || 'Database ping error',
        details: {
          readyState: mongoose.connection.readyState,
          targetHost: mongoose.connection.host || 'unresolved',
          isOperational: false,
        },
        timestamp: new Date(),
      };
    }
  }
}

export const mongoProbe = new MongoProbe();
