import https from 'https';
import http from 'http';
import { URL } from 'url';
import { INotificationChannel } from '../../models/NotificationChannel';
import {
  INotificationProvider,
  AlertNotificationEvent,
  ProviderDeliveryResult,
} from './INotificationProvider';

export class DiscordProvider implements INotificationProvider {
  public readonly type = 'DISCORD';

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
        error: 'Missing Discord webhookUrl in channel config',
      };
    }

    try {
      const alert = event.alert;
      const incident = event.incident;
      const severity = alert?.severity || incident?.severity || 'WARNING';

      const color =
        event.eventType === 'ALERT_RESOLVED'
          ? 0x10b981
          : severity === 'CRITICAL'
          ? 0xef4444
          : severity === 'WARNING'
          ? 0xf59e0b
          : 0x3b82f6;

      const discordPayload = {
        username: 'CRM Alert Engine',
        embeds: [
          {
            title: `[${severity}] ${alert?.title || incident?.title || 'System Alert'}`,
            description: incident?.summary || alert?.title || 'Metric anomaly detected',
            color,
            fields: [
              { name: 'Event', value: `\`${event.eventType}\``, inline: true },
              { name: 'Severity', value: `**${severity}**`, inline: true },
              { name: 'Metric', value: `\`${alert?.metricName || 'N/A'}\``, inline: true },
              {
                name: 'Value vs Threshold',
                value: `**${alert?.metricValue ?? 'N/A'}** (${alert?.operator || '>'} ${alert?.threshold ?? 'N/A'})`,
                inline: false,
              },
            ],
            timestamp: new Date(event.timestamp).toISOString(),
            footer: { text: 'Mobile CRM Incident Engine' },
          },
        ],
      };

      const payloadString = JSON.stringify(discordPayload);
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
              error: success ? undefined : `Discord Error ${statusCode}: ${body}`,
            });
          });
        });

        req.on('error', (err) => {
          resolve({
            success: false,
            latencyMs: Date.now() - startTime,
            error: `Discord network error: ${err.message}`,
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            latencyMs: Date.now() - startTime,
            error: 'Discord webhook timeout (8000ms)',
          });
        });

        req.write(payloadString);
        req.end();
      });
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: `Discord provider error: ${err.message}`,
      };
    }
  }
}
