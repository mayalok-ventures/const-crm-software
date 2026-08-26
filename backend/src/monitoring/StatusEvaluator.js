"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusEvaluator = void 0;
const Server_1 = require("./models/Server");
const ServerStatusEvent_1 = require("./models/ServerStatusEvent");
const Incident_1 = require("./models/Incident");
class StatusEvaluator {
    intervalId = null;
    intervalMs = 30000; // Check every 30s
    start() {
        if (this.intervalId)
            return;
        console.log(`[StatusEvaluator] Starting server status evaluation worker (Interval: ${this.intervalMs}ms)`);
        // Run evaluation immediately
        this.evaluateStatuses().catch(err => console.error('[StatusEvaluator] Status evaluation failed:', err));
        this.intervalId = setInterval(() => {
            this.evaluateStatuses().catch(err => console.error('[StatusEvaluator] Status evaluation failed:', err));
        }, this.intervalMs);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[StatusEvaluator] Stopped server status evaluation worker');
        }
    }
    async evaluateStatuses() {
        const servers = await Server_1.Server.find({});
        const now = new Date();
        for (const server of servers) {
            const serverId = server.serverId;
            const lastHeartbeat = server.lastHeartbeat;
            if (server.status === 'MAINTENANCE') {
                continue; // Skip evaluation if in manual maintenance
            }
            let nextStatus = 'UNKNOWN';
            let reason = 'No heartbeat received';
            if (lastHeartbeat) {
                const diffMs = now.getTime() - new Date(lastHeartbeat).getTime();
                const diffSec = diffMs / 1000;
                if (diffSec <= 60) {
                    nextStatus = 'ONLINE';
                    reason = `Heartbeat received ${Math.round(diffSec)} seconds ago`;
                }
                else if (diffSec <= 120) {
                    nextStatus = 'DEGRADED';
                    reason = `Heartbeat delayed. Last seen ${Math.round(diffSec)} seconds ago`;
                }
                else {
                    nextStatus = 'OFFLINE';
                    reason = `Heartbeat timeout. Last seen ${Math.round(diffSec)} seconds ago`;
                }
            }
            if (server.status !== nextStatus) {
                const previousStatus = server.status;
                console.log(`[StatusEvaluator] Server "${serverId}" status transition: ${previousStatus} ➔ ${nextStatus}`);
                server.status = nextStatus;
                server.lastSeenAt = now;
                await server.save();
                let incidentId;
                // Incident Management
                if (nextStatus === 'OFFLINE') {
                    // Open incident if none exists
                    const existingIncident = await Incident_1.Incident.findOne({ serverId, status: 'OPEN' });
                    if (!existingIncident) {
                        const generatedIncId = `inc-offline-${serverId}-${Date.now()}`;
                        const newIncident = await Incident_1.Incident.create({
                            incidentId: generatedIncId,
                            title: `Server Offline: ${serverId}`,
                            summary: `Server "${serverId}" transitioned to OFFLINE: ${reason}`,
                            severity: 'CRITICAL',
                            serverId,
                            type: 'OFFLINE',
                            startedAt: now,
                            status: 'OPEN',
                            events: [{ status: nextStatus, timestamp: now, reason }],
                        });
                        incidentId = newIncident._id.toString();
                    }
                    else {
                        incidentId = existingIncident._id.toString();
                        existingIncident.events.push({ status: nextStatus, timestamp: now, reason });
                        await existingIncident.save();
                    }
                }
                else if (previousStatus === 'OFFLINE' && (nextStatus === 'ONLINE' || nextStatus === 'DEGRADED')) {
                    // Resolve any open incident
                    const openIncident = await Incident_1.Incident.findOne({ serverId, status: 'OPEN' });
                    if (openIncident) {
                        const durationMs = now.getTime() - openIncident.startedAt.getTime();
                        openIncident.resolvedAt = now;
                        openIncident.durationMs = durationMs;
                        openIncident.status = 'RESOLVED';
                        openIncident.events.push({ status: nextStatus, timestamp: now, reason });
                        await openIncident.save();
                        incidentId = openIncident._id.toString();
                    }
                }
                // Record transition event (ensuring no thousands of duplicates by only logging on actual changes)
                await ServerStatusEvent_1.ServerStatusEvent.create({
                    serverId,
                    fromStatus: previousStatus,
                    toStatus: nextStatus,
                    timestamp: now,
                    reason,
                    resolved: nextStatus === 'ONLINE',
                    incidentId,
                });
            }
        }
    }
}
exports.StatusEvaluator = StatusEvaluator;
exports.default = StatusEvaluator;
