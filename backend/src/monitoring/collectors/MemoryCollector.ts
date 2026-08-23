import os from 'os';

export class MemoryCollector {
  public collect(): { totalBytes: number; usedBytes: number; freeBytes: number; usagePercent: number } {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

    return {
      totalBytes,
      usedBytes,
      freeBytes,
      usagePercent: parseFloat(usagePercent.toFixed(2)),
    };
  }
}
