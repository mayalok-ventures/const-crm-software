export type ServerStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN' | 'MAINTENANCE';

export interface IServer {
  serverId: string;
  organizationId?: string;
  name: string;
  hostname: string;
  environment: string;
  status: ServerStatus;
  lastHeartbeat?: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
  nodeVersion: string;
  os: string;
  metadata?: Record<string, any>;
  healthScore?: number;
  uptimePercentage?: number;
  availabilityPercentage?: number;
}

export interface IServerMetric {
  serverId: string;
  timestamp: Date;
  cpu: {
    usagePercent: number;
    cores: number;
    loadAvg: number[];
  };
  ram: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  network: {
    uploadBytesSec: number;
    downloadBytesSec: number;
  };
  process: {
    cpuPercent: number;
    memoryBytes: number;
    pm2Status: string;
    pm2Restarts: number;
  };
  uptime: number; // server uptime in seconds
  healthScore: number;
  isAggregated: boolean;
  aggregationType: 'raw' | 'hourly' | 'daily';
}

export interface IServerHeartbeat {
  serverId: string;
  applicationId: string;
  environment: string;
  timestamp: Date;
  agentVersion: string;
  healthStatus: ServerStatus;
  applicationVersion: string;
  latencyMs?: number;
}

export interface IServerStatusEvent {
  serverId: string;
  fromStatus: ServerStatus;
  toStatus: ServerStatus;
  timestamp: Date;
  reason: string;
  resolved: boolean;
  incidentId?: string;
}

export interface IIncident {
  serverId: string;
  type: 'OFFLINE' | 'DEGRADED';
  startedAt: Date;
  resolvedAt?: Date;
  durationMs?: number;
  status: 'OPEN' | 'RESOLVED';
  events: Array<{
    status: ServerStatus;
    timestamp: Date;
    reason: string;
  }>;
}

export interface IApiMetric {
  route: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  requestId: string;
  serverId: string;
  organizationId?: string;
  environment: string;
}

export interface IApiEndpointSummary {
  route: string;
  method: string;
  timeBucket: Date;
  requests: number;
  avgResponseTime: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  errorRate: number;
  errorsCount: number;
  statusCodes: {
    [key: string]: number; // e.g. "2xx", "3xx", "4xx", "5xx"
  };
}

export interface IApiPerformanceSnapshot {
  timestamp: Date;
  timeRange: '1h' | '6h' | '24h';
  overallScore: number;
  latencyScore: number;
  reliabilityScore: number;
  errorRateScore: number;
  availabilityScore: number;
}
