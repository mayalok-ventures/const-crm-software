import mongoose, { Document } from 'mongoose';
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
export declare const SystemLog: mongoose.Model<any, {}, {}, {}, any, any>;
export default SystemLog;
