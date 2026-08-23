import os from 'os';
import { SystemMetricsCollector } from './collectors/SystemMetricsCollector';
import { Server } from './models/Server';
import { ServerMetric } from './models/ServerMetric';
import { HealthScoreCalculator } from './HealthScoreCalculator';

export class MonitoringAgent {
  private collector = new SystemMetricsCollector();
  private healthCalculator = new HealthScoreCalculator();
  private intervalId: NodeJS.Timeout | null = null;
  private serverId: string;
  private environment: string;
  private collectionIntervalMs: number;

  constructor() {
    this.serverId = process.env.SERVER_ID || os.hostname() || 'use-setu-server';
    this.environment = process.env.NODE_ENV || 'development';
    // Default collection interval: 30s
    this.collectionIntervalMs = parseInt(process.env.MONITORING_INTERVAL_MS || '30000', 10);
  }

  public async start() {
    if (this.intervalId) return;

    console.log(`[MonitoringAgent] Starting agent for server "${this.serverId}" (Interval: ${this.collectionIntervalMs}ms)`);

    // Register server on startup
    await this.registerServer().catch(err => console.error('[MonitoringAgent] Registration error:', err));

    // Run first collection immediately
    await this.collectAndPersist().catch(err => console.error('[MonitoringAgent] Collection error:', err));

    // Set interval
    this.intervalId = setInterval(() => {
      this.collectAndPersist().catch(err => console.error('[MonitoringAgent] Periodic collection error:', err));
    }, this.collectionIntervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`[MonitoringAgent] Stopped agent for server "${this.serverId}"`);
    }
  }

  private async registerServer() {
    const info = await this.collector.collect();

    await Server.findOneAndUpdate(
      { serverId: this.serverId },
      {
        $setOnInsert: { firstSeenAt: new Date() },
        $set: {
          name: process.env.SERVER_NAME || this.serverId,
          hostname: info.hostname,
          environment: this.environment,
          status: 'ONLINE',
          lastSeenAt: new Date(),
          nodeVersion: info.nodeVersion,
          os: info.os,
        },
      },
      { upsert: true, new: true }
    );
  }

  private async collectAndPersist() {
    const rawData = await this.collector.collect();

    // Calculate health scores
    const healthScores = this.healthCalculator.calculate({
      cpuUsage: rawData.cpu.usagePercent,
      ramUsage: rawData.ram.usagePercent,
      diskUsage: rawData.disk.usagePercent,
      processCpu: rawData.process.cpuPercent,
      networkActive: rawData.network.uploadBytesSec + rawData.network.downloadBytesSec > 0,
      uptimeSeconds: rawData.uptime,
    });

    const timestamp = new Date();

    // Persist raw metrics
    await ServerMetric.create({
      serverId: this.serverId,
      timestamp,
      cpu: rawData.cpu,
      ram: rawData.ram,
      disk: rawData.disk,
      network: rawData.network,
      process: rawData.process,
      uptime: rawData.uptime,
      healthScore: healthScores.overall,
      isAggregated: false,
      aggregationType: 'raw',
    });

    // Update Server document health status & last seen timestamp
    await Server.findOneAndUpdate(
      { serverId: this.serverId },
      {
        $set: {
          status: 'ONLINE',
          lastSeenAt: timestamp,
          lastHeartbeat: timestamp,
          healthScore: healthScores.overall,
          nodeVersion: rawData.nodeVersion,
          os: rawData.os,
        },
      }
    );
  }
}
export default MonitoringAgent;
