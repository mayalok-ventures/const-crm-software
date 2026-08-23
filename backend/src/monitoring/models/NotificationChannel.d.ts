import mongoose, { Document } from 'mongoose';
export type NotificationChannelType = 'WEBHOOK' | 'SLACK' | 'TELEGRAM' | 'EMAIL' | 'DISCORD' | 'CUSTOM_HTTP';
export interface INotificationChannelConfig {
    webhookUrl?: string;
    channelName?: string;
    botToken?: string;
    chatId?: string;
    emailRecipients?: string[];
    customHeaders?: Record<string, string>;
    secretKey?: string;
}
export interface INotificationChannel {
    channelId: string;
    name: string;
    type: NotificationChannelType;
    config: INotificationChannelConfig;
    enabled: boolean;
    eventTypes: string[];
    minSeverity: 'INFO' | 'WARNING' | 'CRITICAL';
    createdAt?: Date;
    updatedAt?: Date;
}
export interface INotificationChannelDocument extends INotificationChannel, Document {
}
export declare const NotificationChannel: mongoose.Model<any, {}, {}, {}, any, any>;
export default NotificationChannel;
