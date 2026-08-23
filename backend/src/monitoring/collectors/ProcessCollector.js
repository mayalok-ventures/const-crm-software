"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessCollector = void 0;
const os_1 = __importDefault(require("os"));
class ProcessCollector {
    lastCpuUsage = null;
    lastTime = null;
    collect() {
        const memoryBytes = process.memoryUsage().rss;
        let cpuPercent = 0.0;
        const currentCpuUsage = process.cpuUsage();
        const currentTime = process.hrtime();
        if (this.lastCpuUsage && this.lastTime) {
            const usageDiff = process.cpuUsage(this.lastCpuUsage);
            const secDiff = currentTime[0] - this.lastTime[0];
            const nanoDiff = currentTime[1] - this.lastTime[1];
            const elapsedMicroseconds = secDiff * 1e6 + nanoDiff / 1e3;
            const totalUsageMicroseconds = usageDiff.user + usageDiff.system;
            const cores = os_1.default.cpus().length;
            if (elapsedMicroseconds > 0) {
                // Normalize against core count so it represents system-level process usage
                cpuPercent = (totalUsageMicroseconds / elapsedMicroseconds / cores) * 100;
            }
        }
        this.lastCpuUsage = currentCpuUsage;
        this.lastTime = currentTime;
        // Check PM2 details
        const isPM2 = typeof process.env.pm_id !== 'undefined';
        const pm2Status = isPM2 ? 'online' : 'standalone';
        const pm2Restarts = isPM2 ? parseInt(process.env.restart_time || '0', 10) : 0;
        return {
            cpuPercent: parseFloat(cpuPercent.toFixed(2)),
            memoryBytes,
            pm2Status,
            pm2Restarts,
        };
    }
}
exports.ProcessCollector = ProcessCollector;
