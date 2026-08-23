import { ServerMetric } from './models/ServerMetric';
import { ApiMetric } from './models/ApiMetric';
import { ApiEndpointSummary } from './models/ApiEndpointSummary';
import { ApiPerformanceSnapshot } from './models/ApiPerformanceSnapshot';

export class MetricsAggregator {
  private intervalId: NodeJS.Timeout | null = null;
  private intervalMs: number = 3600000; // 1 hour

  public start() {
    if (this.intervalId) return;
    console.log('[MetricsAggregator] Starting metrics aggregator worker (Interval: 1 hour)');

    // Run first aggregation after 5 seconds to process startup rollups
    setTimeout(() => {
      this.runAggregation().catch(err => console.error('[MetricsAggregator] Startup aggregation failed:', err));
    }, 5000);

    // Setup interval
    this.intervalId = setInterval(() => {
      this.runAggregation().catch(err => console.error('[MetricsAggregator] Hourly aggregation failed:', err));
    }, this.intervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[MetricsAggregator] Stopped metrics aggregator worker');
    }
  }

  public async runAggregation() {
    const now = new Date();
    console.log(`[MetricsAggregator] Running rollup aggregation at ${now.toISOString()}`);

    // Aggregate by hourly boundaries
    const currentHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const lastHourStart = new Date(currentHourStart.getTime() - 3600000);
    const lastHourEnd = new Date(currentHourStart.getTime() - 1);

    await this.aggregateServerMetrics(lastHourStart, lastHourEnd);
    await this.aggregateApiMetrics(lastHourStart, lastHourEnd);
    await this.enforceRetentionPolicies(now);
  }

  public async aggregateServerMetrics(start: Date, end: Date) {
    const rawMetrics = await ServerMetric.find({
      timestamp: { $gte: start, $lte: end },
      aggregationType: 'raw',
      isAggregated: false,
    });

    if (rawMetrics.length === 0) return;

    // Group metrics by server ID
    const serverGroups: Record<string, typeof rawMetrics> = {};
    for (const m of rawMetrics) {
      if (!serverGroups[m.serverId]) {
        serverGroups[m.serverId] = [];
      }
      serverGroups[m.serverId].push(m);
    }

    for (const [serverId, metrics] of Object.entries(serverGroups)) {
      const count = metrics.length;
      if (count === 0) continue;

      let sumCpuUsage = 0,
        sumCpuCores = 0,
        sumCpuLoad = 0;
      let sumRamTotal = 0,
        sumRamUsed = 0,
        sumRamFree = 0,
        sumRamPct = 0;
      let sumDiskTotal = 0,
        sumDiskUsed = 0,
        sumDiskFree = 0,
        sumDiskPct = 0;
      let sumNetUpload = 0,
        sumNetDownload = 0;
      let sumProcCpu = 0,
        sumProcMem = 0;
      let maxUptime = 0,
        sumHealth = 0;

      for (const m of metrics) {
        sumCpuUsage += m.cpu.usagePercent;
        sumCpuCores += m.cpu.cores;
        sumCpuLoad += m.cpu.loadAvg[0] || 0;
        sumRamTotal += m.ram.totalBytes;
        sumRamUsed += m.ram.usedBytes;
        sumRamFree += m.ram.freeBytes;
        sumRamPct += m.ram.usagePercent;
        sumDiskTotal += m.disk.totalBytes;
        sumDiskUsed += m.disk.usedBytes;
        sumDiskFree += m.disk.freeBytes;
        sumDiskPct += m.disk.usagePercent;
        sumNetUpload += m.network.uploadBytesSec;
        sumNetDownload += m.network.downloadBytesSec;
        sumProcCpu += m.process.cpuPercent;
        sumProcMem += m.process.memoryBytes;
        maxUptime = Math.max(maxUptime, m.uptime);
        sumHealth += m.healthScore;
      }

      const pm2Status = metrics[0].process.pm2Status;
      const pm2Restarts = metrics[count - 1].process.pm2Restarts;

      // Save hourly roll-up metric document
      await ServerMetric.create({
        serverId,
        timestamp: start,
        cpu: {
          usagePercent: parseFloat((sumCpuUsage / count).toFixed(2)),
          cores: Math.round(sumCpuCores / count),
          loadAvg: [parseFloat((sumCpuLoad / count).toFixed(2)), 0, 0],
        },
        ram: {
          totalBytes: Math.round(sumRamTotal / count),
          usedBytes: Math.round(sumRamUsed / count),
          freeBytes: Math.round(sumRamFree / count),
          usagePercent: parseFloat((sumRamPct / count).toFixed(2)),
        },
        disk: {
          totalBytes: Math.round(sumDiskTotal / count),
          usedBytes: Math.round(sumDiskUsed / count),
          freeBytes: Math.round(sumDiskFree / count),
          usagePercent: parseFloat((sumDiskPct / count).toFixed(2)),
        },
        network: {
          uploadBytesSec: parseFloat((sumNetUpload / count).toFixed(0)),
          downloadBytesSec: parseFloat((sumNetDownload / count).toFixed(0)),
        },
        process: {
          cpuPercent: parseFloat((sumProcCpu / count).toFixed(2)),
          memoryBytes: Math.round(sumProcMem / count),
          pm2Status,
          pm2Restarts,
        },
        uptime: maxUptime,
        healthScore: Math.round(sumHealth / count),
        isAggregated: true,
        aggregationType: 'hourly',
      });

      // Mark raw metrics as rolled-up/aggregated
      await ServerMetric.updateMany({ _id: { $in: metrics.map(m => m._id) } }, { $set: { isAggregated: true } });
    }
  }

  public async aggregateApiMetrics(start: Date, end: Date) {
    const rawMetrics = await ApiMetric.find({
      timestamp: { $gte: start, $lte: end },
    }).lean();

    if (rawMetrics.length === 0) return;

    // Group by method and route pattern
    const groups: Record<string, typeof rawMetrics> = {};
    for (const m of rawMetrics) {
      const key = `${m.method}:${m.route}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }

    let totalScoreLatency = 0;
    let totalScoreReliability = 0;
    let totalScoreAvailability = 0;
    let totalEndpoints = 0;

    for (const [key, metrics] of Object.entries(groups)) {
      const [method, route] = key.split(':');
      const count = metrics.length;
      if (count === 0) continue;

      let sumResponseTime = 0;
      let errorsCount = 0;
      const statusCodes: Record<string, number> = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
      const responseTimes: number[] = [];

      for (const m of metrics) {
        sumResponseTime += m.responseTime;
        responseTimes.push(m.responseTime);

        const cat = Math.floor(m.statusCode / 100);
        if (cat === 2) statusCodes['2xx']++;
        else if (cat === 3) statusCodes['3xx']++;
        else if (cat === 4) statusCodes['4xx']++;
        else if (cat === 5) {
          statusCodes['5xx']++;
          errorsCount++;
        }
      }

      // Sort timers to calculate exact percentiles
      responseTimes.sort((a, b) => a - b);
      const getPercentile = (p: number) => {
        const idx = Math.floor(responseTimes.length * (p / 100));
        return responseTimes[Math.min(idx, responseTimes.length - 1)] || 0;
      };

      const avgResponseTime = sumResponseTime / count;
      const errorRate = (errorsCount / count) * 100;

      // Save summary bucket
      await ApiEndpointSummary.create({
        route,
        method,
        timeBucket: start,
        requests: count,
        avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
        p50: getPercentile(50),
        p75: getPercentile(75),
        p90: getPercentile(90),
        p95: getPercentile(95),
        p99: getPercentile(99),
        errorRate: parseFloat(errorRate.toFixed(2)),
        errorsCount,
        statusCodes,
      });

      // Latency scoring: 100 for <= 150ms, linear drop to 0 at 1.5s
      const latScore = Math.max(0, 100 - Math.max(0, avgResponseTime - 150) / 13.5);
      // Reliability score: 100 - (errorRate * 10)
      const relScore = Math.max(0, 100 - errorRate * 10);
      // Availability score: 100 - (5xx rate * 20)
      const availScore = Math.max(0, 100 - (statusCodes['5xx'] / count) * 100 * 20);

      totalScoreLatency += latScore;
      totalScoreReliability += relScore;
      totalScoreAvailability += availScore;
      totalEndpoints++;
    }

    if (totalEndpoints > 0) {
      const avgLatencyScore = totalScoreLatency / totalEndpoints;
      const avgReliabilityScore = totalScoreReliability / totalEndpoints;
      const avgAvailabilityScore = totalScoreAvailability / totalEndpoints;
      const avgErrorRateScore = avgReliabilityScore;
      const overallScore = avgLatencyScore * 0.4 + avgReliabilityScore * 0.3 + avgAvailabilityScore * 0.3;

      // Store a performance snapshot
      await ApiPerformanceSnapshot.create({
        timestamp: start,
        timeRange: '1h',
        overallScore: Math.round(overallScore),
        latencyScore: Math.round(avgLatencyScore),
        reliabilityScore: Math.round(avgReliabilityScore),
        errorRateScore: Math.round(avgErrorRateScore),
        availabilityScore: Math.round(avgAvailabilityScore),
      });
    }
  }

  private async enforceRetentionPolicies(now: Date) {
    // Retain raw metrics for 2 days
    const rawCutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const serverDel = await ServerMetric.deleteMany({
      timestamp: { $lt: rawCutoff },
      aggregationType: 'raw',
    });
    console.log(`[MetricsAggregator] Pruned ${serverDel.deletedCount} raw ServerMetric documents.`);

    // Retain hourly metrics for 30 days
    const hourlyCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hourlyDel = await ServerMetric.deleteMany({
      timestamp: { $lt: hourlyCutoff },
      aggregationType: 'hourly',
    });
    console.log(`[MetricsAggregator] Pruned ${hourlyDel.deletedCount} hourly ServerMetric documents.`);

    // Retain raw API metrics for 2 days
    const apiDel = await ApiMetric.deleteMany({
      timestamp: { $lt: rawCutoff },
    });
    console.log(`[MetricsAggregator] Pruned ${apiDel.deletedCount} raw ApiMetric documents.`);
  }
}
export default MetricsAggregator;
