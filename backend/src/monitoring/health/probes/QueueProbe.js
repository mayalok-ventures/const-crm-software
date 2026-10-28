"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueProbe = exports.QueueProbe = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
class QueueProbe {
    /**
     * Probes background campaign workers and queues
     */
    async probe() {
        const startTime = Date.now();
        try {
            if (mongoose_1.default.connection.readyState !== 1 || !mongoose_1.default.connection.db) {
                return {
                    name: 'Queue & Background Workers',
                    category: 'queue',
                    status: 'UNHEALTHY',
                    score: 0,
                    latencyMs: 1,
                    isCritical: false,
                    message: 'Database disconnected, persistent MongoDB task queues offline',
                    details: {
                        driver: 'in-process / MongoDB task queue (Redis optional)',
                        queueReady: false,
                        databaseState: mongoose_1.default.connection.readyState === 2 ? 'connecting' : 'disconnected',
                    },
                    timestamp: new Date(),
                };
            }
            // 1. Inspect queued campaigns (support both lowercase and uppercase statuses)
            const campaignsCollection = mongoose_1.default.connection.collection('campaigns');
            const [queuedCount, runningCount, failedCount] = await Promise.all([
                campaignsCollection.countDocuments({ status: { $in: ['queued', 'QUEUED'] } }),
                campaignsCollection.countDocuments({ status: { $in: ['running', 'RUNNING'] } }),
                campaignsCollection.countDocuments({ status: { $in: ['failed', 'FAILED'] } }),
            ]);
            // 2. Inspect durable inbound webhook event queue
            const webhooksCollection = mongoose_1.default.connection.collection('webhookevents');
            const [pendingWebhooks, processingWebhooks, deadLetterWebhooks] = await Promise.all([
                webhooksCollection.countDocuments({ status: 'pending' }),
                webhooksCollection.countDocuments({ status: 'processing' }),
                webhooksCollection.countDocuments({ status: 'dead_letter' }),
            ]);
            let score = 100;
            let status = 'HEALTHY';
            const issues = [];
            // Check campaign backlog
            if (queuedCount > 100) {
                score -= 30;
                status = 'DEGRADED';
                issues.push(`High queued campaigns backlog: ${queuedCount}`);
            }
            if (failedCount > 25) {
                score -= 25;
                status = 'DEGRADED';
                issues.push(`Failed campaign jobs elevated: ${failedCount}`);
            }
            // Check webhook queue backlog
            if (pendingWebhooks > 100) {
                score -= 20;
                status = 'DEGRADED';
                issues.push(`High pending webhook queue: ${pendingWebhooks}`);
            }
            if (deadLetterWebhooks > 10) {
                score -= 25;
                status = 'DEGRADED';
                issues.push(`Dead-letter webhook events detected: ${deadLetterWebhooks}`);
            }
            const latencyMs = Math.max(1, Date.now() - startTime);
            return {
                name: 'Queue & Background Workers',
                category: 'queue',
                status,
                score: Math.max(0, Math.min(100, score)),
                latencyMs,
                isCritical: false,
                message: issues.length > 0 ? issues.join(', ') : 'Background workers operational and polling',
                details: {
                    driver: 'in-process / MongoDB task queue (Redis optional)',
                    workersActive: ['CampaignWorker', 'FollowUpScheduler', 'WebhookQueueWorker', 'MonitoringAgent'],
                    campaigns: {
                        queued: queuedCount,
                        running: runningCount,
                        failed: failedCount,
                    },
                    webhooks: {
                        pending: pendingWebhooks,
                        processing: processingWebhooks,
                        deadLetter: deadLetterWebhooks,
                    },
                    totalPendingJobs: queuedCount + pendingWebhooks,
                    pollIntervalMs: 5000,
                },
                timestamp: new Date(),
            };
        }
        catch (err) {
            return {
                name: 'Queue & Background Workers',
                category: 'queue',
                status: 'DEGRADED',
                score: 60,
                latencyMs: Math.max(1, Date.now() - startTime),
                isCritical: false,
                message: 'Queue probe error',
                error: err.message,
                timestamp: new Date(),
            };
        }
    }
}
exports.QueueProbe = QueueProbe;
exports.queueProbe = new QueueProbe();
