import mongoose, { Document } from 'mongoose';
export type NotificationDeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'RATE_LIMITED' | 'SKIPPED';
export interface INotificationDelivery {
    deliveryId: string;
    alertId?: string;
    incidentId?: string;
    channelId: string;
    channelName: string;
    channelType: string;
    eventType: string;
    status: NotificationDeliveryStatus;
    payload: Record<string, any>;
    responseCode?: number;
    responseBody?: string;
    latencyMs?: number;
    attempts: number;
    error?: string;
    deliveredAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface INotificationDeliveryDocument extends INotificationDelivery, Document {
}
export declare const NotificationDelivery: mongoose.Model<any, {}, {}, {}, any, any>;
export default NotificationDelivery;
