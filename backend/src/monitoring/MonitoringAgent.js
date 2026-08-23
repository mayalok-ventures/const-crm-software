"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringAgent = void 0;
const os_1 = __importDefault(require("os"));
const SystemMetricsCollector_1 = require("./collectors/SystemMetricsCollector");
const Server_1 = require("./models/Server");
const ServerMetric_1 = require("./models/ServerMetric");
const HealthScoreCalculator_1 = require("./HealthScoreCalculator");
class MonitoringAgent {
    collector = new SystemMetricsCollector_1.SystemMetricsCollector();
    healthCalculator = new HealthScoreCalculator_1.HealthScoreCalculator();
    intervalId = null;
    serverId;
    environment;
    collectionIntervalMs;
    constructor() {
        this.serverId = process.env.SERVER_ID || os_1.default.hostname() || 'use-setu-server';
        this.environment = process.env.NODE_ENV || 'development';
        // Default collection interval: 30s
        this.collectionIntervalMs = parseInt(process.env.MONITORING_INTERVAL_MS || '30000', 10);
    }
    async start() {
        if (this.intervalId)
            return;
        console.log(`[MonitoringAgent] Starting agent for server "${this.serverId}" (Interval: ${this.collectionIntervalMs}ms)`);
        // Register server on startup
        await this.registerServer().catch(err => console.error('[MonitoringAgent] Registration error:', err));
        // Run first collection immediately
        await this.collectAndPersist().catch(err => console.error('[MonitoringAgent] Collection error:', err));
        // Set interval
        this.intervalId = setInterval(() => {
            this.collectAndPersist().catch(err => console.error('[MonitoringAgent] Periodic collection error:', err));
        }, this.collectionIntervalMs);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log(`[MonitoringAgent] Stopped agent for server "${this.serverId}"`);
        }
    }
    async registerServer() {
        const info = await this.collector.collect();
        await Server_1.Server.findOneAndUpdate({ serverId: this.serverId }, {
            $setOnInsert: { firstSeenAt: new Date() },
            $set: {
                name: process.env.SERVER_NAME || this.serverId,
                hostname: info.hostname,
                environment: this.environment,
                status: 'ONLINE',
                lastSeenAt: new Date(),
                nodeVersion: info.nodeVersion,
                os: info.os,
            },
        }, { upsert: true, new: true });
    }
    async collectAndPersist() {
        const rawData = await this.collector.collect();
        // Calculate health scores
        const healthScores = this.healthCalculator.calculate({
            cpuUsage: rawData.cpu.usagePercent,
            ramUsage: rawData.ram.usagePercent,
            diskUsage: rawData.disk.usagePercent,
            processCpu: rawData.process.cpuPercent,
            networkActive: rawData.network.uploadBytesSec + rawData.network.downloadBytesSec > 0,
            uptimeSeconds: rawData.uptime,
        });
        const timestamp = new Date();
        // Persist raw metrics
        await ServerMetric_1.ServerMetric.create({
            serverId: this.serverId,
            timestamp,
            cpu: rawData.cpu,
            ram: rawData.ram,
            disk: rawData.disk,
            network: rawData.network,
            process: rawData.process,
            uptime: rawData.uptime,
            healthScore: healthScores.overall,
            isAggregated: false,
            aggregationType: 'raw',
        });
        // Update Server document health status & last seen timestamp
        await Server_1.Server.findOneAndUpdate({ serverId: this.serverId }, {
            $set: {
                status: 'ONLINE',
                lastSeenAt: timestamp,
                lastHeartbeat: timestamp,
                healthScore: healthScores.overall,
                nodeVersion: rawData.nodeVersion,
                os: rawData.os,
            },
        });
    }
}
exports.MonitoringAgent = MonitoringAgent;
exports.default = MonitoringAgent;
