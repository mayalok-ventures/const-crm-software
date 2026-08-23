"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slowQueryInterceptor = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const SlowQueryMetric_1 = __importDefault(require("../models/SlowQueryMetric"));
const databaseSanitizer_1 = require("./databaseSanitizer");
class SlowQueryInterceptor {
    static instance;
    thresholdMs = 100;
    isAttached = false;
    recentSlowQueries = [];
    maxRecentBuffer = 50;
    constructor() { }
    static getInstance() {
        if (!SlowQueryInterceptor.instance) {
            SlowQueryInterceptor.instance = new SlowQueryInterceptor();
        }
        return SlowQueryInterceptor.instance;
    }
    setThreshold(ms) {
        this.thresholdMs = Math.max(10, ms);
    }
    getThreshold() {
        return this.thresholdMs;
    }
    getRecentSlowQueries() {
        return [...this.recentSlowQueries];
    }
    recordSlowQuery(record) {
        // Add to in-memory fast ring buffer
        this.recentSlowQueries.unshift(record);
        if (this.recentSlowQueries.length > this.maxRecentBuffer) {
            this.recentSlowQueries.pop();
        }
        // Asynchronously persist to database (non-blocking)
        setImmediate(async () => {
            try {
                if (mongoose_1.default.connection.readyState === 1) {
                    await SlowQueryMetric_1.default.create({
                        collectionName: record.collectionName,
                        operation: record.operation,
                        durationMs: record.durationMs,
                        filter: record.filter,
                        projection: record.projection,
                        sort: record.sort,
                        limit: record.limit,
                        timestamp: record.timestamp,
                    });
                }
            }
            catch (err) {
                // Silently skip if DB write failed
            }
        });
    }
    attach(mongooseInstance = mongoose_1.default) {
        if (this.isAttached)
            return;
        this.isAttached = true;
        const self = this;
        const queryMethods = [
            'find',
            'findOne',
            'findOneAndUpdate',
            'findOneAndDelete',
            'updateOne',
            'updateMany',
            'deleteOne',
            'deleteMany',
            'countDocuments',
            'aggregate',
        ];
        mongooseInstance.plugin((schema) => {
            // Pre-hook to record start time
            schema.pre(/^(find|findOne|findOneAndUpdate|findOneAndDelete|updateOne|updateMany|deleteOne|deleteMany|countDocuments)$/, function (next) {
                this.__startTime = Date.now();
                next();
            });
            // Post-hook to measure duration
            schema.post(/^(find|findOne|findOneAndUpdate|findOneAndDelete|updateOne|updateMany|deleteOne|deleteMany|countDocuments)$/, function (res, next) {
                if (this.__startTime) {
                    const durationMs = Date.now() - this.__startTime;
                    if (durationMs >= self.thresholdMs) {
                        const collectionName = this.model?.collection?.name || this.mongooseCollection?.name || 'unknown';
                        const rawFilter = typeof this.getFilter === 'function' ? this.getFilter() : {};
                        const sanitizedFilter = (0, databaseSanitizer_1.sanitizeQueryFilter)(rawFilter);
                        self.recordSlowQuery({
                            collectionName,
                            operation: this.op || 'query',
                            durationMs,
                            filter: sanitizedFilter,
                            projection: typeof this.projection === 'function' ? this.projection() : undefined,
                            sort: typeof this.getOptions === 'function' ? this.getOptions()?.sort : undefined,
                            limit: typeof this.getOptions === 'function' ? this.getOptions()?.limit : undefined,
                            timestamp: new Date(),
                        });
                    }
                }
                if (typeof next === 'function')
                    next();
            });
        });
    }
}
exports.slowQueryInterceptor = SlowQueryInterceptor.getInstance();
exports.default = exports.slowQueryInterceptor;
