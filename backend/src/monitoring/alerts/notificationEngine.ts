import crypto from 'crypto';
import { NotificationChannel, INotificationChannel } from '../models/NotificationChannel';
import { NotificationDelivery } from '../models/NotificationDelivery';
import { notificationProviderRegistry } from './providers/NotificationProviderRegistry';
import { AlertNotificationEvent, ProviderDeliveryResult } from './providers/INotificationProvider';

export class NotificationEngine {
  private static instance: NotificationEngine;

  private constructor() {}

  public static getInstance(): NotificationEngine {
    if (!NotificationEngine.instance) {
      NotificationEngine.instance = new NotificationEngine();
    }
    return NotificationEngine.instance;
  }

  /**
   * Dispatches notifications to appropriate channels based on rule configuration, severity, and event type
   */
  public async dispatch(
    event: AlertNotificationEvent,
    targetChannelIds: string[] = []
  ): Promise<Array<{ channelId: string; result: ProviderDeliveryResult }>> {
    const results: Array<{ channelId: string; result: ProviderDeliveryResult }> = [];

    try {
      // Find channels to notify
      const query: Record<string, any> = { enabled: true };
      if (targetChannelIds.length > 0) {
        query.$or = [{ channelId: { $in: targetChannelIds } }, { _id: { $in: targetChannelIds } }];
      }

      const channels: any[] = await NotificationChannel.find(query).lean();
      if (!channels || channels.length === 0) {
        return results;
      }

      const severityWeight: Record<string, number> = {
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
        const provider = notificationProviderRegistry.get(channel.type);
        if (!provider) {
          console.warn(`[NotificationEngine] No registered provider for channel type: ${channel.type}`);
          continue;
        }

        // 4. Send notification
        const deliveryId = `del-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        let result: ProviderDeliveryResult;

        try {
          result = await provider.send(channel, event);
        } catch (err: any) {
          result = {
            success: false,
            latencyMs: 0,
            error: err.message || 'Unknown delivery failure',
          };
        }

        results.push({ channelId: channel.channelId, result });

        // 5. Record delivery audit in database
        try {
          await NotificationDelivery.create({
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
        } catch (dbErr: any) {
          console.error('[NotificationEngine] Failed to record delivery log:', dbErr.message);
        }
      }
    } catch (err: any) {
      console.error('[NotificationEngine] Dispatch coordinator error:', err.message);
    }

    return results;
  }
}

export const notificationEngine = NotificationEngine.getInstance();
export default notificationEngine;
