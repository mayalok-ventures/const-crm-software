import mongoose, { Schema, Document } from 'mongoose';

export interface IBlockedIP extends Document {
  ip: string;
  reason: string;
  blockedBy: 'SYSTEM_AUTO' | 'ADMIN';
  adminUserId?: mongoose.Types.ObjectId | string;
  adminEmail?: string;
  expiresAt?: Date;
  isActive: boolean;
  hitCount: number;
  lastAttemptAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BlockedIPSchema: Schema = new Schema(
  {
    ip: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    blockedBy: {
      type: String,
      required: true,
      enum: ['SYSTEM_AUTO', 'ADMIN'],
      default: 'SYSTEM_AUTO',
    },
    adminUserId: {
      type: Schema.Types.Mixed,
      default: null,
    },
    adminEmail: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: { expires: 0 }, // TTL index that removes document when expiresAt timestamp arrives
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    hitCount: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const BlockedIP =
  mongoose.models.BlockedIP ||
  mongoose.model<IBlockedIP>('BlockedIP', BlockedIPSchema);
