import os from 'os';

export class CpuCollector {
  private lastCpuTimes: os.CpuInfo[] | null = null;

  public collect(): { usagePercent: number; cores: number; loadAvg: number[] } {
    const currentCpuTimes = os.cpus();
    const cores = currentCpuTimes.length;
    const loadAvg = os.loadavg();

    let usagePercent = 0.0;
    if (this.lastCpuTimes && this.lastCpuTimes.length === cores) {
      let startIdle = 0;
      let startTotal = 0;
      let endIdle = 0;
      let endTotal = 0;

      for (let i = 0; i < cores; i++) {
        const start = this.lastCpuTimes[i].times;
        const end = currentCpuTimes[i].times;

        startIdle += start.idle;
        startTotal += start.user + start.nice + start.sys + start.irq + start.idle;

        endIdle += end.idle;
        endTotal += end.user + end.nice + end.sys + end.irq + end.idle;
      }

      const idleDiff = endIdle - startIdle;
      const totalDiff = endTotal - startTotal;

      if (totalDiff > 0) {
        usagePercent = 100 * (1 - idleDiff / totalDiff);
      }
    } else {
      // First collection or cores mismatch: Estimate using 1-minute load average
      const oneMinLoad = loadAvg[0];
      usagePercent = Math.min(100, Math.max(0, (oneMinLoad / cores) * 100));
    }

    // Update historical ticks
    this.lastCpuTimes = currentCpuTimes;

    return {
      usagePercent: parseFloat(usagePercent.toFixed(2)),
      cores,
      loadAvg,
    };
  }
}
