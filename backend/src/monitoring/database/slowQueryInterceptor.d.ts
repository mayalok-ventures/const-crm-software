import mongoose from 'mongoose';
export interface SlowQueryRecord {
    collectionName: string;
    operation: string;
    durationMs: number;
    filter?: Record<string, any>;
    projection?: Record<string, any>;
    sort?: Record<string, any>;
    limit?: number;
    timestamp: Date;
}
declare class SlowQueryInterceptor {
    private static instance;
    private thresholdMs;
    private isAttached;
    private recentSlowQueries;
    private maxRecentBuffer;
    private constructor();
    static getInstance(): SlowQueryInterceptor;
    setThreshold(ms: number): void;
    getThreshold(): number;
    getRecentSlowQueries(): SlowQueryRecord[];
    recordSlowQuery(record: SlowQueryRecord): void;
    attach(mongooseInstance?: typeof mongoose): void;
}
export declare const slowQueryInterceptor: SlowQueryInterceptor;
export default slowQueryInterceptor;
