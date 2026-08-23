import { INotificationChannel } from '../../models/NotificationChannel';
import { INotificationProvider, AlertNotificationEvent, ProviderDeliveryResult } from './INotificationProvider';
export declare class WebhookProvider implements INotificationProvider {
    readonly type = "WEBHOOK";
    send(channel: INotificationChannel, event: AlertNotificationEvent): Promise<ProviderDeliveryResult>;
}
