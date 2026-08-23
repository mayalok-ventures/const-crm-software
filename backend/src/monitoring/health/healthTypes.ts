/**
 * Production-Grade Health Check Framework Types
 */

export type ComponentStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'SKIPPED' | 'NOT_CONFIGURED';

export interface ComponentHealth {
  name: string;
  category: 'core' | 'database' | 'cache' | 'storage' | 'external' | 'queue';
  status: ComponentStatus;
  score: number; // 0 - 100
  latencyMs: number;
  isCritical: boolean;
  message?: string;
  details?: Record<string, any>;
  error?: string;
  timestamp: Date;
}

export interface LivenessResult {
  status: 'HEALTHY' | 'UNHEALTHY';
  liveness: boolean;
  pid: number;
  uptimeSeconds: number;
  memory: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    formattedHeap: string;
    formattedRss: string;
  };
  eventLoopLagMs: number;
  timestamp: Date;
}

export interface ReadinessResult {
  status: 'HEALTHY' | 'UNHEALTHY';
  ready: boolean;
  checks: {
    mongodb: {
      status: ComponentStatus;
      connectionState: string;
      pingLatencyMs: number;
      isOperational: boolean;
    };
    storage: {
      status: ComponentStatus;
      isWritable: boolean;
      latencyMs: number;
    };
  };
  timestamp: Date;
}

export interface DetailedHealthResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  overallScore: number; // 0 - 100
  uptimeSeconds: number;
  environment: string;
  version: string;
  timestamp: Date;
  components: Record<string, ComponentHealth>;
  scoreBreakdown: {
    coreScore: number;
    databaseScore: number;
    cacheScore: number;
    storageScore: number;
    externalScore: number;
    queueScore: number;
  };
  summary: {
    healthyComponents: number;
    degradedComponents: number;
    unhealthyComponents: number;
    totalComponents: number;
  };
}

export interface ProbeOptions {
  timeoutMs?: number;
}
