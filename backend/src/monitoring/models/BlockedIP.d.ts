import mongoose, { Document } from 'mongoose';
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
export declare const BlockedIP: mongoose.Model<any, {}, {}, {}, any, any>;
