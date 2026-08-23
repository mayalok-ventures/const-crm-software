"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationEngine = exports.NotificationEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const NotificationChannel_1 = require("../models/NotificationChannel");
const NotificationDelivery_1 = require("../models/NotificationDelivery");
const NotificationProviderRegistry_1 = require("./providers/NotificationProviderRegistry");
class NotificationEngine {
    static instance;
    constructor() { }
    static getInstance() {
        if (!NotificationEngine.instance) {
            NotificationEngine.instance = new NotificationEngine();
        }
        return NotificationEngine.instance;
    }
    /**
     * Dispatches notifications to appropriate channels based on rule configuration, severity, and event type
     */
    async dispatch(event, targetChannelIds = []) {
        const results = [];
        try {
            // Find channels to notify
            const query = { enabled: true };
            if (targetChannelIds.length > 0) {
                query.$or = [{ channelId: { $in: targetChannelIds } }, { _id: { $in: targetChannelIds } }];
            }
            const channels = await NotificationChannel_1.NotificationChannel.find(query).lean();
            if (!channels || channels.length === 0) {
                return results;
            }
            const severityWeight = {
                INFO: 1,
                WARNING: 2,
                CRITICAL: 3,
            };
            const eventSeverity = event.alert?.severity || event.incident?.severity || 'WARNING';
            const eventWeight = severityWeight[eventSeverity] || 2;
            for (const channel of channels) {
                // 1. Check severity filter
                const channelMinWeight = severityWeight[channel.minSeverity || 'WARNING'] || 2;
                if (eventWeight < channelMinWeight && event.eventType !== 'ALERT_RESOLVED' && event.eventType !== 'TEST') {
                    continue;
                }
                // 2. Check event type subscription
                if (channel.eventTypes && channel.eventTypes.length > 0 && !channel.eventTypes.includes(event.eventType)) {
                    continue;
                }
                // 3. Lookup provider
                const provider = NotificationProviderRegistry_1.notificationProviderRegistry.get(channel.type);
                if (!provider) {
                    console.warn(`[NotificationEngine] No registered provider for channel type: ${channel.type}`);
                    continue;
                }
                // 4. Send notification
                const deliveryId = `del-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}`;
                let result;
                try {
                    result = await provider.send(channel, event);
                }
                catch (err) {
                    result = {
                        success: false,
                        latencyMs: 0,
                        error: err.message || 'Unknown delivery failure',
                    };
                }
                results.push({ channelId: channel.channelId, result });
                // 5. Record delivery audit in database
                try {
                    await NotificationDelivery_1.NotificationDelivery.create({
                        deliveryId,
                        alertId: event.alert?.alertId,
                        incidentId: event.incident?.incidentId,
                        channelId: channel.channelId,
                        channelName: channel.name,
                        channelType: channel.type,
                        eventType: event.eventType,
                        status: result.success ? 'DELIVERED' : 'FAILED',
                        payload: {
                            title: event.alert?.title || event.incident?.title,
                            metric: event.alert?.metricName,
                            value: event.alert?.metricValue,
                            severity: eventSeverity,
                        },
                        responseCode: result.statusCode,
                        responseBody: result.responseBody,
                        latencyMs: result.latencyMs,
                        attempts: 1,
                        error: result.error || '',
                        deliveredAt: result.success ? new Date() : null,
                    });
                }
                catch (dbErr) {
                    console.error('[NotificationEngine] Failed to record delivery log:', dbErr.message);
                }
            }
        }
        catch (err) {
            console.error('[NotificationEngine] Dispatch coordinator error:', err.message);
        }
        return results;
    }
}
exports.NotificationEngine = NotificationEngine;
exports.notificationEngine = NotificationEngine.getInstance();
exports.default = exports.notificationEngine;
