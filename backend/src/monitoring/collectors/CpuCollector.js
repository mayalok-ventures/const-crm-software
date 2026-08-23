"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CpuCollector = void 0;
const os_1 = __importDefault(require("os"));
class CpuCollector {
    lastCpuTimes = null;
    collect() {
        const currentCpuTimes = os_1.default.cpus();
        const cores = currentCpuTimes.length;
        const loadAvg = os_1.default.loadavg();
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
        }
        else {
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
exports.CpuCollector = CpuCollector;
