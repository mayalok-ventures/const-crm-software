import { INotificationChannel } from '../../models/NotificationChannel';
import { INotificationProvider, AlertNotificationEvent, ProviderDeliveryResult } from './INotificationProvider';
export declare class TelegramProvider implements INotificationProvider {
    readonly type = "TELEGRAM";
    send(channel: INotificationChannel, event: AlertNotificationEvent): Promise<ProviderDeliveryResult>;
}
