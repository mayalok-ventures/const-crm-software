"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiskCollector = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class DiskCollector {
    async collect() {
        const isWindows = process.platform === 'win32';
        try {
            if (isWindows) {
                // Run PowerShell to fetch disk info for primary C: drive
                const { stdout } = await execAsync('powershell -Command "Get-CimInstance Win32_LogicalDisk | Where-Object {$_.DeviceID -eq \'C:\'} | Select-Object Size, FreeSpace | ConvertTo-Json"');
                const data = JSON.parse(stdout.trim());
                const totalBytes = Number(data.Size || (Array.isArray(data) ? data[0]?.Size : 0) || 0);
                const freeBytes = Number(data.FreeSpace || (Array.isArray(data) ? data[0]?.FreeSpace : 0) || 0);
                const usedBytes = totalBytes - freeBytes;
                const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
                return {
                    totalBytes,
                    usedBytes,
                    freeBytes,
                    usagePercent: parseFloat(usagePercent.toFixed(2)),
                };
            }
            else {
                // Linux / macOS standard POSIX df output
                const { stdout } = await execAsync('df -Pk /');
                const lines = stdout.trim().split('\n');
                if (lines.length >= 2) {
                    const parts = lines[1].split(/\s+/);
                    // Block size is 1KB (1024 bytes)
                    const totalBytes = parseInt(parts[1], 10) * 1024;
                    const usedBytes = parseInt(parts[2], 10) * 1024;
                    const freeBytes = parseInt(parts[3], 10) * 1024;
                    const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
                    return {
                        totalBytes,
                        usedBytes,
                        freeBytes,
                        usagePercent: parseFloat(usagePercent.toFixed(2)),
                    };
                }
            }
        }
        catch (error) {
            console.warn('[DiskCollector] Failed to collect system disk metrics:', error?.message || error);
        }
        // Default fallback values if shell commands fail
        return {
            totalBytes: 100 * 1024 * 1024 * 1024,
            usedBytes: 50 * 1024 * 1024 * 1024,
            freeBytes: 50 * 1024 * 1024 * 1024,
            usagePercent: 50.0,
        };
    }
}
exports.DiskCollector = DiskCollector;
