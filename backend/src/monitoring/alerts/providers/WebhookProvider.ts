import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { INotificationChannel } from '../../models/NotificationChannel';
import {
  INotificationProvider,
  AlertNotificationEvent,
  ProviderDeliveryResult,
} from './INotificationProvider';

export class WebhookProvider implements INotificationProvider {
  public readonly type = 'WEBHOOK';

  public async send(
    channel: INotificationChannel,
    event: AlertNotificationEvent
  ): Promise<ProviderDeliveryResult> {
    const startTime = Date.now();
    const urlString = channel.config?.webhookUrl;

    if (!urlString) {
      return {
        success: false,
        latencyMs: 0,
        error: 'Missing webhookUrl in channel config',
      };
    }

    try {
      const url = new URL(urlString);
      const payloadString = JSON.stringify(event);

      // Generate HMAC-SHA256 signature if secretKey provided
      const secret = channel.config?.secretKey || 'crm-alert-secret';
      const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadString).toString(),
        'X-Alert-Signature': `sha256=${signature}`,
        'X-Alert-Event': event.eventType,
        'User-Agent': 'MobileCRM-AlertEngine/1.0',
        ...(channel.config?.customHeaders || {}),
      };

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers,
        timeout: 8000,
      };

      const client = url.protocol === 'https:' ? https : http;

      return await new Promise<ProviderDeliveryResult>((resolve) => {
        const req = client.request(options, (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            const latencyMs = Date.now() - startTime;
            const statusCode = res.statusCode || 0;
            const success = statusCode >= 200 && statusCode < 300;
            resolve({
              success,
              statusCode,
              responseBody: body.slice(0, 1000),
              latencyMs,
              error: success ? undefined : `HTTP Error ${statusCode}: ${body.slice(0, 200)}`,
            });
          });
        });

        req.on('error', (err) => {
          resolve({
            success: false,
            latencyMs: Date.now() - startTime,
            error: `Network error: ${err.message}`,
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            latencyMs: Date.now() - startTime,
            error: 'Webhook request timed out (8000ms)',
          });
        });

        req.write(payloadString);
        req.end();
      });
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: `Webhook delivery error: ${err.message}`,
      };
    }
  }
}
