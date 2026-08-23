import { INotificationChannel } from '../../models/NotificationChannel';
import { INotificationProvider, AlertNotificationEvent, ProviderDeliveryResult } from './INotificationProvider';
export declare class EmailProvider implements INotificationProvider {
    readonly type = "EMAIL";
    send(channel: INotificationChannel, event: AlertNotificationEvent): Promise<ProviderDeliveryResult>;
}
