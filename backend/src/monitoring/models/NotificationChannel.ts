import mongoose, { Schema, Document } from 'mongoose';

export type NotificationChannelType =
  | 'WEBHOOK'
  | 'SLACK'
  | 'TELEGRAM'
  | 'EMAIL'
  | 'DISCORD'
  | 'CUSTOM_HTTP';

export interface INotificationChannelConfig {
  webhookUrl?: string;
  channelName?: string;
  botToken?: string;
  chatId?: string;
  emailRecipients?: string[];
  customHeaders?: Record<string, string>;
  secretKey?: string; // For HMAC-SHA256 signature
}

export interface INotificationChannel {
  channelId: string;
  name: string;
  type: NotificationChannelType;
  config: INotificationChannelConfig;
  enabled: boolean;
  eventTypes: string[]; // ['ALERT_TRIGGERED', 'ALERT_RESOLVED', 'INCIDENT_ESCALATED']
  minSeverity: 'INFO' | 'WARNING' | 'CRITICAL';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface INotificationChannelDocument extends INotificationChannel, Document {}

const NotificationChannelSchema: Schema = new Schema(
  {
    channelId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['WEBHOOK', 'SLACK', 'TELEGRAM', 'EMAIL', 'DISCORD', 'CUSTOM_HTTP'],
      index: true,
    },
    config: {
      webhookUrl: { type: String, default: '' },
      channelName: { type: String, default: '' },
      botToken: { type: String, default: '' },
      chatId: { type: String, default: '' },
      emailRecipients: [{ type: String }],
      customHeaders: { type: Schema.Types.Mixed, default: {} },
      secretKey: { type: String, default: '' },
    },
    enabled: { type: Boolean, default: true, index: true },
    eventTypes: {
      type: [String],
      default: ['ALERT_TRIGGERED', 'ALERT_RESOLVED', 'INCIDENT_ESCALATED'],
    },
    minSeverity: {
      type: String,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'WARNING',
    },
  },
  { timestamps: true }
);

export const NotificationChannel =
  mongoose.models.NotificationChannel ||
  mongoose.model<INotificationChannelDocument>('NotificationChannel', NotificationChannelSchema);
export default NotificationChannel;
