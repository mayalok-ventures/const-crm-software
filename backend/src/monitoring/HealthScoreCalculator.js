"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_THRESHOLDS = exports.HealthScoreCalculator = void 0;
class HealthScoreCalculator {
    weights = {
        cpu: 0.20,
        ram: 0.20,
        disk: 0.15,
        process: 0.15,
        uptime: 0.15,
        network: 0.15,
    };
    thresholds = {
        cpu: { warning: 75, critical: 85, severe: 95 },
        ram: { warning: 75, critical: 85, severe: 95 },
        disk: { warning: 75, critical: 85, severe: 95 },
        process: { warning: 75, critical: 85, severe: 95 },
    };
    constructor(customWeights, customThresholds) {
        if (customWeights) {
            this.weights = { ...this.weights, ...customWeights };
            this.normalizeWeights();
        }
        if (customThresholds) {
            this.thresholds = { ...this.thresholds, ...customThresholds };
        }
    }
    normalizeWeights() {
        const total = this.weights.cpu +
            this.weights.ram +
            this.weights.disk +
            this.weights.process +
            this.weights.uptime +
            this.weights.network;
        if (total > 0 && Math.abs(total - 1.0) > 0.001) {
            this.weights.cpu /= total;
            this.weights.ram /= total;
            this.weights.disk /= total;
            this.weights.process /= total;
            this.weights.uptime /= total;
            this.weights.network /= total;
        }
    }
    calculateResourceScore(usage, t) {
        if (usage < 60) {
            // 90 - 100 points: excellent
            return 100 - (usage / 60) * 10;
        }
        else if (usage < t.warning) {
            // 80 - 90 points: good
            const pct = (usage - 60) / (t.warning - 60 || 1);
            return 90 - pct * 10;
        }
        else if (usage < t.critical) {
            // 60 - 80 points: warning
            const pct = (usage - t.warning) / (t.critical - t.warning || 1);
            return 80 - pct * 20;
        }
        else if (usage < t.severe) {
            // 30 - 60 points: critical
            const pct = (usage - t.critical) / (t.severe - t.critical || 1);
            return 60 - pct * 30;
        }
        else {
            // 0 - 30 points: severe
            const pct = Math.min(1, (usage - t.severe) / (100 - t.severe || 1));
            return 30 - pct * 30;
        }
    }
    calculate(metrics) {
        const cpuScore = this.calculateResourceScore(metrics.cpuUsage, this.thresholds.cpu);
        const ramScore = this.calculateResourceScore(metrics.ramUsage, this.thresholds.ram);
        const diskScore = this.calculateResourceScore(metrics.diskUsage, this.thresholds.disk);
        const processScore = this.calculateResourceScore(metrics.processCpu, this.thresholds.process);
        // Network health: 100 if active/has traffic, 90 if idle/functional
        const networkScore = metrics.networkActive ? 100 : 90;
        // Uptime health: 100 if running, 0 if offline
        const uptimeScore = metrics.uptimeSeconds > 0 ? 100 : 0;
        const overall = cpuScore * this.weights.cpu +
            ramScore * this.weights.ram +
            diskScore * this.weights.disk +
            processScore * this.weights.process +
            networkScore * this.weights.network +
            uptimeScore * this.weights.uptime;
        return {
            overall: Math.round(overall),
            cpu: Math.round(cpuScore),
            ram: Math.round(ramScore),
            disk: Math.round(diskScore),
            process: Math.round(processScore),
            network: Math.round(networkScore),
            uptime: Math.round(uptimeScore),
        };
    }
}
exports.HealthScoreCalculator = HealthScoreCalculator;
exports.default = HealthScoreCalculator;
exports.DEFAULT_THRESHOLDS = {
    cpu: { warning: 75, critical: 85, severe: 95 },
    ram: { warning: 75, critical: 85, severe: 95 },
    disk: { warning: 75, critical: 85, severe: 95 },
    process: { warning: 75, critical: 85, severe: 95 }
};
