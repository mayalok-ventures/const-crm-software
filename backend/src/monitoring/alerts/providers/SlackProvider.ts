import https from 'https';
import http from 'http';
import { URL } from 'url';
import { INotificationChannel } from '../../models/NotificationChannel';
import {
  INotificationProvider,
  AlertNotificationEvent,
  ProviderDeliveryResult,
} from './INotificationProvider';

export class SlackProvider implements INotificationProvider {
  public readonly type = 'SLACK';

  public async send(
    channel: INotificationChannel,
    event: AlertNotificationEvent
  ): Promise<ProviderDeliveryResult> {
    const startTime = Date.now();
    const webhookUrl = channel.config?.webhookUrl;

    if (!webhookUrl) {
      return {
        success: false,
        latencyMs: 0,
        error: 'Missing Slack webhookUrl in config',
      };
    }

    try {
      // Build Slack Block Kit formatted message
      const alert = event.alert;
      const incident = event.incident;
      const severity = alert?.severity || incident?.severity || 'WARNING';

      const emojiMap: Record<string, string> = {
        CRITICAL: '🔴',
        WARNING: '🟡',
        INFO: '🔵',
      };
      const emoji = event.eventType === 'ALERT_RESOLVED' ? '🟢' : emojiMap[severity] || '⚠️';
      const color =
        event.eventType === 'ALERT_RESOLVED'
          ? '#10B981'
          : severity === 'CRITICAL'
          ? '#EF4444'
          : severity === 'WARNING'
          ? '#F59E0B'
          : '#3B82F6';

      const title =
        event.eventType === 'ALERT_RESOLVED'
          ? `[RESOLVED] ${alert?.title || incident?.title || 'System Alert'}`
          : event.eventType === 'INCIDENT_ESCALATED'
          ? `[ESCALATED - Tier ${incident?.escalationLevel || 2}] ${incident?.title || 'System Incident'}`
          : `[${severity}] ${alert?.title || incident?.title || 'System Alert'}`;

      const slackPayload = {
        attachments: [
          {
            color,
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `${emoji} ${title}`.slice(0, 150),
                  emoji: true,
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `*Event:*\n\`${event.eventType}\``,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Severity:*\n*${severity}*`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Metric:*\n\`${alert?.metricName || 'N/A'}\``,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Value vs Threshold:*\n*${alert?.metricValue ?? 'N/A'}* (${alert?.operator || '>'} ${alert?.threshold ?? 'N/A'})`,
                  },
                ],
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `*Triggered:* <!date^${Math.floor(
                      new Date(event.timestamp).getTime() / 1000
                    )}^{date_num} {time_secs}|${new Date(event.timestamp).toISOString()}> | *CRM Incident System*`,
                  },
                ],
              },
            ],
          },
        ],
      };

      const payloadString = JSON.stringify(slackPayload);
      const url = new URL(webhookUrl);

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadString).toString(),
        },
        timeout: 8000,
      };

      const client = url.protocol === 'https:' ? https : http;

      return await new Promise<ProviderDeliveryResult>((resolve) => {
        const req = client.request(options, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            const latencyMs = Date.now() - startTime;
            const statusCode = res.statusCode || 0;
            const success = statusCode >= 200 && statusCode < 300;
            resolve({
              success,
              statusCode,
              responseBody: body.slice(0, 500),
              latencyMs,
              error: success ? undefined : `Slack Error ${statusCode}: ${body}`,
            });
          });
        });

        req.on('error', (err) => {
          resolve({
            success: false,
            latencyMs: Date.now() - startTime,
            error: `Slack network error: ${err.message}`,
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            latencyMs: Date.now() - startTime,
            error: 'Slack webhook timeout (8000ms)',
          });
        });

        req.write(payloadString);
        req.end();
      });
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: `Slack provider error: ${err.message}`,
      };
    }
  }
}
