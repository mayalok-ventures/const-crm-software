import mongoose, { Document, Schema } from 'mongoose';

export interface IErrorOccurrence extends Document {
  errorId: string;
  fingerprint: string;
  requestId?: string;
  timestamp: Date;
  serverId: string;
  environment: string;
  route: string;
  method: string;
  statusCode: number;
  message: string;
  stackTrace?: string;
  errorType: string;
  userId?: mongoose.Types.ObjectId | string;
  organizationId?: mongoose.Types.ObjectId | string;
  applicationVersion?: string;
  metadata?: Record<string, any>;
}

const ErrorOccurrenceSchema: Schema = new Schema(
  {
    errorId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    requestId: {
      type: String,
      index: true,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
      expires: '30d', // 30-day retention for raw occurrences
    },
    serverId: {
      type: String,
      required: true,
      index: true,
    },
    environment: {
      type: String,
      default: 'production',
    },
    route: {
      type: String,
      required: true,
      index: true,
    },
    method: {
      type: String,
      required: true,
    },
    statusCode: {
      type: Number,
      default: 500,
    },
    message: {
      type: String,
      required: true,
    },
    stackTrace: {
      type: String,
      default: '',
    },
    errorType: {
      type: String,
      default: 'Error',
    },
    userId: {
      type: Schema.Types.Mixed,
      default: null,
    },
    organizationId: {
      type: Schema.Types.Mixed,
      default: null,
    },
    applicationVersion: {
      type: String,
      default: '1.0.0',
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

ErrorOccurrenceSchema.index({ fingerprint: 1, timestamp: -1 });

export const ErrorOccurrence =
  mongoose.models.ErrorOccurrence ||
  mongoose.model<IErrorOccurrence>('ErrorOccurrence', ErrorOccurrenceSchema);
export default ErrorOccurrence;
