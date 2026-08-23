import os from 'os';
import { CpuCollector } from './CpuCollector';
import { MemoryCollector } from './MemoryCollector';
import { DiskCollector } from './DiskCollector';
import { NetworkCollector } from './NetworkCollector';
import { ProcessCollector } from './ProcessCollector';

export class SystemMetricsCollector {
  private cpuCollector = new CpuCollector();
  private memoryCollector = new MemoryCollector();
  private diskCollector = new DiskCollector();
  private networkCollector = new NetworkCollector();
  private processCollector = new ProcessCollector();

  public async collect() {
    const cpu = this.cpuCollector.collect();
    const ram = this.memoryCollector.collect();
    const disk = await this.diskCollector.collect();
    const network = await this.networkCollector.collect();
    const processStats = this.processCollector.collect();

    // Server uptime (in seconds)
    const uptime = os.uptime();

    // System Information
    const hostname = os.hostname();
    const platform = os.platform();
    const osRelease = os.release();
    const osType = os.type();
    const nodeVersion = process.version;

    return {
      cpu,
      ram,
      disk,
      network,
      process: processStats,
      uptime,
      hostname,
      os: `${osType} ${osRelease} (${platform})`,
      nodeVersion,
    };
  }
}
