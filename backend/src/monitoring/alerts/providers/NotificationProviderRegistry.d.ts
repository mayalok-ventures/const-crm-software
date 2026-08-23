import { INotificationProvider } from './INotificationProvider';
export declare class NotificationProviderRegistry {
    private static instance;
    private providers;
    private constructor();
    static getInstance(): NotificationProviderRegistry;
    register(provider: INotificationProvider): void;
    get(type: string): INotificationProvider | undefined;
    has(type: string): boolean;
    getSupportedTypes(): string[];
}
export declare const notificationProviderRegistry: NotificationProviderRegistry;
export default notificationProviderRegistry;
