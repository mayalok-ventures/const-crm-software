import mongoose, { Document, Schema } from 'mongoose';

export type ErrorStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED';
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IErrorNote {
  author: string;
  authorId?: mongoose.Types.ObjectId;
  note: string;
  createdAt: Date;
}

export interface IErrorGroup extends Document {
  fingerprint: string;
  errorType: string;
  message: string;
  stackTrace: string;
  primaryFrame: string;
  status: ErrorStatus;
  severity: ErrorSeverity;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  affectedEndpoints: string[];
  affectedServers: string[];
  affectedUsersCount: number;
  affectedOrgsCount: number;
  notes: IErrorNote[];
  isRegression: boolean;
  lastResolvedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const ErrorGroupSchema: Schema = new Schema(
  {
    fingerprint: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    errorType: {
      type: String,
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    stackTrace: {
      type: String,
      default: '',
    },
    primaryFrame: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'],
      default: 'OPEN',
      index: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    occurrences: {
      type: Number,
      default: 1,
      index: true,
    },
    firstSeen: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true,
    },
    affectedEndpoints: {
      type: [String],
      default: [],
    },
    affectedServers: {
      type: [String],
      default: [],
    },
    affectedUsersCount: {
      type: Number,
      default: 0,
    },
    affectedOrgsCount: {
      type: Number,
      default: 0,
    },
    notes: [
      {
        author: { type: String, required: true },
        authorId: { type: Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isRegression: {
      type: Boolean,
      default: false,
    },
    lastResolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// High-Performance Query Indexes
ErrorGroupSchema.index({ status: 1, lastSeen: -1 });
ErrorGroupSchema.index({ severity: 1, lastSeen: -1 });
ErrorGroupSchema.index({ occurrences: -1 });

export const ErrorGroup =
  mongoose.models.ErrorGroup || mongoose.model<IErrorGroup>('ErrorGroup', ErrorGroupSchema);
export default ErrorGroup;
