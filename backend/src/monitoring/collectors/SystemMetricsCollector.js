"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemMetricsCollector = void 0;
const os_1 = __importDefault(require("os"));
const CpuCollector_1 = require("./CpuCollector");
const MemoryCollector_1 = require("./MemoryCollector");
const DiskCollector_1 = require("./DiskCollector");
const NetworkCollector_1 = require("./NetworkCollector");
const ProcessCollector_1 = require("./ProcessCollector");
class SystemMetricsCollector {
    cpuCollector = new CpuCollector_1.CpuCollector();
    memoryCollector = new MemoryCollector_1.MemoryCollector();
    diskCollector = new DiskCollector_1.DiskCollector();
    networkCollector = new NetworkCollector_1.NetworkCollector();
    processCollector = new ProcessCollector_1.ProcessCollector();
    async collect() {
        const cpu = this.cpuCollector.collect();
        const ram = this.memoryCollector.collect();
        const disk = await this.diskCollector.collect();
        const network = await this.networkCollector.collect();
        const processStats = this.processCollector.collect();
        // Server uptime (in seconds)
        const uptime = os_1.default.uptime();
        // System Information
        const hostname = os_1.default.hostname();
        const platform = os_1.default.platform();
        const osRelease = os_1.default.release();
        const osType = os_1.default.type();
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
exports.SystemMetricsCollector = SystemMetricsCollector;
