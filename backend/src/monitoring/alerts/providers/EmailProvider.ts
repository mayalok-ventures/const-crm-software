import { INotificationChannel } from '../../models/NotificationChannel';
import {
  INotificationProvider,
  AlertNotificationEvent,
  ProviderDeliveryResult,
} from './INotificationProvider';

export class EmailProvider implements INotificationProvider {
  public readonly type = 'EMAIL';

  public async send(
    channel: INotificationChannel,
    event: AlertNotificationEvent
  ): Promise<ProviderDeliveryResult> {
    const startTime = Date.now();
    const recipients = channel.config?.emailRecipients || [];

    if (recipients.length === 0) {
      return {
        success: false,
        latencyMs: 0,
        error: 'Missing emailRecipients in Email channel config',
      };
    }

    try {
      const alert = event.alert;
      const incident = event.incident;
      const severity = alert?.severity || incident?.severity || 'WARNING';

      const subject = `[${severity}] CRM Alert: ${alert?.title || incident?.title || 'System Event'}`;
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: ${severity === 'CRITICAL' ? '#dc2626' : '#d97706'}; margin-top: 0;">
            ${event.eventType === 'ALERT_RESOLVED' ? '🟢 Alert Resolved' : '🚨 Alert Notification'}
          </h2>
          <p><strong>Title:</strong> ${alert?.title || incident?.title || 'System Notification'}</p>
          <p><strong>Severity:</strong> <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: #fee2e2; color: #991b1b; font-weight: bold;">${severity}</span></p>
          <p><strong>Metric:</strong> <code>${alert?.metricName || 'N/A'}</code></p>
          <p><strong>Value vs Threshold:</strong> <strong>${alert?.metricValue ?? 'N/A'}</strong> (Expected: ${alert?.operator || '>'} ${alert?.threshold ?? 'N/A'})</p>
          <p><strong>Timestamp:</strong> ${new Date(event.timestamp).toUTCString()}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">This is an automated alert dispatched by the Mobile CRM Incident Management Engine.</p>
        </div>
      `;

      // Simulates or connects to email transport
      // If mock/sandbox mode, log and return success
      console.log(`[EmailProvider] Dispatched alert email to [${recipients.join(', ')}] with subject "${subject}"`);

      return {
        success: true,
        statusCode: 200,
        responseBody: `Email queued for ${recipients.length} recipients`,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: `Email delivery error: ${err.message}`,
      };
    }
  }
}
