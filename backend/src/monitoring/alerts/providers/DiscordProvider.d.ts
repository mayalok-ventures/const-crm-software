import { INotificationChannel } from '../../models/NotificationChannel';
import { INotificationProvider, AlertNotificationEvent, ProviderDeliveryResult } from './INotificationProvider';
export declare class DiscordProvider implements INotificationProvider {
    readonly type = "DISCORD";
    send(channel: INotificationChannel, event: AlertNotificationEvent): Promise<ProviderDeliveryResult>;
}
