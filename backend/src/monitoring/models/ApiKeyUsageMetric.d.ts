import mongoose, { Document } from 'mongoose';
export interface IApiKeyUsageMetric extends Document {
    keyId: string;
    organizationId: mongoose.Types.ObjectId;
    timestamp: Date;
    granularity: 'hourly' | 'daily';
    requestCount: number;
    successCount: number;
    errorCount: number;
    rateLimitHits: number;
    avgLatencyMs: number;
    topEndpoints: {
        endpoint: string;
        count: number;
    }[];
}
declare const ApiKeyUsageMetric: mongoose.Model<any, {}, {}, {}, any, any>;
export default ApiKeyUsageMetric;
