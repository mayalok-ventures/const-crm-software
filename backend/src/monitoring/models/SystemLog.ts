import mongoose, { Document, Schema } from 'mongoose';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface ISystemLog extends Document {
  timestamp: Date;
  level: LogLevel;
  service: string;
  module: string;
  serverId: string;
  requestId?: string;
  userId?: mongoose.Types.ObjectId | string;
  organizationId?: mongoose.Types.ObjectId | string;
  message: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

const SystemLogSchema: Schema = new Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
      expires: '14d', // Auto-purge logs after 14 days (TTL index)
    },
    level: {
      type: String,
      enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'],
      required: true,
      index: true,
    },
    service: {
      type: String,
      default: 'crm-backend',
      index: true,
    },
    module: {
      type: String,
      default: 'general',
      index: true,
    },
    serverId: {
      type: String,
      required: true,
      index: true,
    },
    requestId: {
      type: String,
      index: true,
      default: null,
    },
    userId: {
      type: Schema.Types.Mixed,
      default: null,
    },
    organizationId: {
      type: Schema.Types.Mixed,
      default: null,
    },
    message: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

// High-Performance Query Indexes
SystemLogSchema.index({ timestamp: -1, level: 1 });
SystemLogSchema.index({ serverId: 1, timestamp: -1 });
SystemLogSchema.index({ module: 1, timestamp: -1 });
SystemLogSchema.index({ requestId: 1, timestamp: -1 });

export const SystemLog =
  mongoose.models.SystemLog || mongoose.model<ISystemLog>('SystemLog', SystemLogSchema);
export default SystemLog;
