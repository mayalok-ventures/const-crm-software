import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export class NetworkCollector {
  private lastRxBytes: number = 0;
  private lastTxBytes: number = 0;
  private lastTimestamp: number = 0;

  public async collect(): Promise<{ uploadBytesSec: number; downloadBytesSec: number }> {
    const isWindows = process.platform === 'win32';
    const now = Date.now();
    let currentRx = 0;
    let currentTx = 0;

    try {
      if (isWindows) {
        const { stdout } = await execAsync('netstat -e');
        const lines = stdout.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.toLowerCase().startsWith('bytes')) {
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 3) {
              currentRx = parseInt(parts[1], 10) || 0;
              currentTx = parseInt(parts[2], 10) || 0;
            }
            break;
          }
        }
      } else {
        // Linux /proc/net/dev reading
        if (fs.existsSync('/proc/net/dev')) {
          const content = fs.readFileSync('/proc/net/dev', 'utf8');
          const lines = content.split('\n');
          for (let i = 2; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(':');
            if (parts.length < 2) continue;
            const iface = parts[0].trim();
            if (iface === 'lo') continue; // Skip loopback

            const stats = parts[1].trim().split(/\s+/);
            currentRx += parseInt(stats[0], 10) || 0;
            currentTx += parseInt(stats[8], 10) || 0;
          }
        }
      }
    } catch (err: any) {
      console.warn('[NetworkCollector] Failed to read network statistics:', err?.message || err);
    }

    let uploadBytesSec = 0;
    let downloadBytesSec = 0;

    if (this.lastTimestamp > 0 && now > this.lastTimestamp) {
      const durationSec = (now - this.lastTimestamp) / 1000;

      // Handle wrapping/restarts
      if (currentRx >= this.lastRxBytes && currentTx >= this.lastTxBytes) {
        downloadBytesSec = (currentRx - this.lastRxBytes) / durationSec;
        uploadBytesSec = (currentTx - this.lastTxBytes) / durationSec;
      }
    }

    // Save historical counters
    this.lastRxBytes = currentRx;
    this.lastTxBytes = currentTx;
    this.lastTimestamp = now;

    return {
      uploadBytesSec: Math.max(0, parseFloat(uploadBytesSec.toFixed(0))),
      downloadBytesSec: Math.max(0, parseFloat(downloadBytesSec.toFixed(0))),
    };
  }
}
