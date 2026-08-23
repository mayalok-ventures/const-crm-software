import mongoose, { Schema, Document } from 'mongoose';

export type NotificationDeliveryStatus =
  | 'PENDING'
  | 'DELIVERED'
  | 'FAILED'
  | 'RATE_LIMITED'
  | 'SKIPPED';

export interface INotificationDelivery {
  deliveryId: string;
  alertId?: string;
  incidentId?: string;
  channelId: string;
  channelName: string;
  channelType: string;
  eventType: string; // 'ALERT_TRIGGERED' | 'ALERT_RESOLVED' | 'INCIDENT_ESCALATED' | 'TEST'
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

export interface INotificationDeliveryDocument extends INotificationDelivery, Document {}

const NotificationDeliverySchema: Schema = new Schema(
  {
    deliveryId: { type: String, required: true, unique: true, index: true },
    alertId: { type: String, index: true },
    incidentId: { type: String, index: true },
    channelId: { type: String, required: true, index: true },
    channelName: { type: String, default: '' },
    channelType: { type: String, required: true },
    eventType: { type: String, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'DELIVERED', 'FAILED', 'RATE_LIMITED', 'SKIPPED'],
      default: 'PENDING',
      index: true,
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    responseCode: { type: Number },
    responseBody: { type: String },
    latencyMs: { type: Number, default: 0 },
    attempts: { type: Number, default: 1 },
    error: { type: String, default: '' },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationDeliverySchema.index({ createdAt: -1 });

export const NotificationDelivery =
  mongoose.models.NotificationDelivery ||
  mongoose.model<INotificationDeliveryDocument>('NotificationDelivery', NotificationDeliverySchema);
export default NotificationDelivery;
