import { INotificationChannel } from '../../models/NotificationChannel';
import { INotificationProvider, AlertNotificationEvent, ProviderDeliveryResult } from './INotificationProvider';
export declare class SlackProvider implements INotificationProvider {
    readonly type = "SLACK";
    send(channel: INotificationChannel, event: AlertNotificationEvent): Promise<ProviderDeliveryResult>;
}
