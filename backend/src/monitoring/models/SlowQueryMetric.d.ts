import mongoose, { Document } from 'mongoose';
export interface ISlowQueryMetric extends Document {
    collectionName: string;
    operation: string;
    durationMs: number;
    filter?: Record<string, any>;
    projection?: Record<string, any>;
    sort?: Record<string, any>;
    limit?: number;
    planSummary?: string;
    requestId?: string;
    clientIp?: string;
    timestamp: Date;
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
