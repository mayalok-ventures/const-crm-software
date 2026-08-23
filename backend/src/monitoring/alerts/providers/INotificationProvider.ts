import { INotificationChannel } from '../../models/NotificationChannel';

export interface AlertNotificationEvent {
  eventType: 'ALERT_TRIGGERED' | 'ALERT_RESOLVED' | 'INCIDENT_ESCALATED' | 'TEST';
  timestamp: Date;
  alert?: {
    alertId: string;
    title: string;
    metricName: string;
    metricValue: number | string;
    threshold: number | string;
    operator: string;
    severity: string;
    status: string;
    triggeredAt: Date;
    resolvedAt?: Date | null;
  };
  incident?: {
    incidentId: string;
    title: string;
    severity: string;
    status: string;
    summary: string;
    affectedResources?: Record<string, any>;
    escalationLevel?: number;
  };
  details?: Record<string, any>;
}

export interface ProviderDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  latencyMs: number;
  error?: string;
}

export interface INotificationProvider {
  readonly type: string;
  send(channel: INotificationChannel, event: AlertNotificationEvent): Promise<ProviderDeliveryResult>;
}
