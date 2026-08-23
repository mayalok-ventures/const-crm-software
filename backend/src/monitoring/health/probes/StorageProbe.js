"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageProbe = exports.StorageProbe = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
class StorageProbe {
    /**
     * Probes local filesystem read/write capability and disk space
     */
    async probe() {
        const startTime = Date.now();
        const testDir = path_1.default.join(os_1.default.tmpdir(), 'crm_health_check');
        const testFile = path_1.default.join(testDir, `probe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.tmp`);
        try {
            if (!fs_1.default.existsSync(testDir)) {
                fs_1.default.mkdirSync(testDir, { recursive: true });
            }
            // 1. Test Write
            const testContent = `health_probe_${Date.now()}`;
            fs_1.default.writeFileSync(testFile, testContent, 'utf8');
            // 2. Test Read
            const readContent = fs_1.default.readFileSync(testFile, 'utf8');
            if (readContent !== testContent) {
                throw new Error('Storage verification mismatch');
            }
            // 3. Test Delete / Cleanup
            fs_1.default.unlinkSync(testFile);
            // 4. Inspect Disk Availability (if statfs available)
            let freeDiskMb = null;
            let totalDiskMb = null;
            let diskUsagePercent = null;
            try {
                if (fs_1.default.statfsSync) {
                    const stats = fs_1.default.statfsSync(process.cwd());
                    const totalBytes = stats.bsize * stats.blocks;
                    const freeBytes = stats.bsize * stats.bfree;
                    totalDiskMb = Math.round(totalBytes / (1024 * 1024));
                    freeDiskMb = Math.round(freeBytes / (1024 * 1024));
                    diskUsagePercent = Math.round(((totalBytes - freeBytes) / totalBytes) * 100);
                }
            }
            catch {
                // Platform specific statfs fallback
            }
            let score = 100;
            let status = 'HEALTHY';
            const issues = [];
            if (diskUsagePercent !== null && diskUsagePercent > 92) {
                score = 40;
                status = 'DEGRADED';
                issues.push(`Critical disk space utilization: ${diskUsagePercent}%`);
            }
            else if (diskUsagePercent !== null && diskUsagePercent > 82) {
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
        }
        catch (err) {
            // Clean up if file remained
            try {
                if (fs_1.default.existsSync(testFile))
                    fs_1.default.unlinkSync(testFile);
            }
            catch { }
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
exports.StorageProbe = StorageProbe;
exports.storageProbe = new StorageProbe();
