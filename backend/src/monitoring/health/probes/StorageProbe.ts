import fs from 'fs';
import path from 'path';
import os from 'os';
import { ComponentHealth } from '../healthTypes';

export class StorageProbe {
  /**
   * Probes local filesystem read/write capability and disk space
   */
  public async probe(): Promise<ComponentHealth> {
    const startTime = Date.now();
    const testDir = path.join(os.tmpdir(), 'crm_health_check');
    const testFile = path.join(testDir, `probe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.tmp`);

    try {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // 1. Test Write
      const testContent = `health_probe_${Date.now()}`;
      fs.writeFileSync(testFile, testContent, 'utf8');

      // 2. Test Read
      const readContent = fs.readFileSync(testFile, 'utf8');
      if (readContent !== testContent) {
        throw new Error('Storage verification mismatch');
      }

      // 3. Test Delete / Cleanup
      fs.unlinkSync(testFile);

      // 4. Inspect Disk Availability (if statfs available)
      let freeDiskMb: number | null = null;
      let totalDiskMb: number | null = null;
      let diskUsagePercent: number | null = null;

      try {
        if ((fs as any).statfsSync) {
          const stats = (fs as any).statfsSync(process.cwd());
          const totalBytes = stats.bsize * stats.blocks;
          const freeBytes = stats.bsize * stats.bfree;
          totalDiskMb = Math.round(totalBytes / (1024 * 1024));
          freeDiskMb = Math.round(freeBytes / (1024 * 1024));
          diskUsagePercent = Math.round(((totalBytes - freeBytes) / totalBytes) * 100);
        }
      } catch {
        // Platform specific statfs fallback
      }

      let score = 100;
      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      const issues: string[] = [];

      if (diskUsagePercent !== null && diskUsagePercent > 92) {
        score = 40;
        status = 'DEGRADED';
        issues.push(`Critical disk space utilization: ${diskUsagePercent}%`);
      } else if (diskUsagePercent !== null && diskUsagePercent > 82) {
        score = 75;
        status = 'DEGRADED';
        issues.push(`High disk space utilization: ${diskUsagePercent}%`);
      }

      const latencyMs = Math.max(1, Date.now() - startTime);

      return {
        name: 'Storage & Filesystem',
        category: 'storage',
        status,
        score,
        latencyMs,
        isCritical: true,
        message: issues.length > 0 ? issues.join(', ') : 'Local filesystem read/write verified',
        details: {
          isWritable: true,
          isReadable: true,
          tmpDir: testDir,
          freeDiskMb,
          totalDiskMb,
          diskUsagePercent,
          probeLatencyMs: latencyMs,
        },
        timestamp: new Date(),
      };
    } catch (err: any) {
      // Clean up if file remained
      try {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      } catch {}

      return {
        name: 'Storage & Filesystem',
        category: 'storage',
        status: 'UNHEALTHY',
        score: 0,
        latencyMs: Math.max(1, Date.now() - startTime),
        isCritical: true,
        message: 'Storage read/write verification failed',
        error: err.message || 'Filesystem error',
        details: {
          isWritable: false,
          isReadable: false,
        },
        timestamp: new Date(),
      };
    }
  }
}

export const storageProbe = new StorageProbe();
