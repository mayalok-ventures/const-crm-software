import mongoose, { Document } from 'mongoose';
export interface IDatabaseMetric extends Document {
    timestamp: Date;
    pingLatencyMs: number;
    healthScore: number;
    activeConnections: number;
    dataSizeBytes: number;
    storageSizeBytes: number;
    indexSizeBytes: number;
    documentsCount: number;
    slowQueryCount: number;
    failedOpsCount: number;
    opsPerSec: number;
    isAggregated: boolean;
    aggregationType: 'raw' | 'hourly' | 'daily';
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
