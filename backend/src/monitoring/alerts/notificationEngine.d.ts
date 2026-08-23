import { AlertNotificationEvent, ProviderDeliveryResult } from './providers/INotificationProvider';
export declare class NotificationEngine {
    private static instance;
    private constructor();
    static getInstance(): NotificationEngine;
    /**
     * Dispatches notifications to appropriate channels based on rule configuration, severity, and event type
     */
    dispatch(event: AlertNotificationEvent, targetChannelIds?: string[]): Promise<Array<{
        channelId: string;
        result: ProviderDeliveryResult;
    }>>;
}
export declare const notificationEngine: NotificationEngine;
export default notificationEngine;
