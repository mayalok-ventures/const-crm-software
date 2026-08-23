import mongoose from 'mongoose';
import SlowQueryMetric from '../models/SlowQueryMetric';
import { sanitizeQueryFilter } from './databaseSanitizer';

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

class SlowQueryInterceptor {
  private static instance: SlowQueryInterceptor;
  private thresholdMs = 100;
  private isAttached = false;
  private recentSlowQueries: SlowQueryRecord[] = [];
  private maxRecentBuffer = 50;

  private constructor() {}

  public static getInstance(): SlowQueryInterceptor {
    if (!SlowQueryInterceptor.instance) {
      SlowQueryInterceptor.instance = new SlowQueryInterceptor();
    }
    return SlowQueryInterceptor.instance;
  }

  public setThreshold(ms: number) {
    this.thresholdMs = Math.max(10, ms);
  }

  public getThreshold(): number {
    return this.thresholdMs;
  }

  public getRecentSlowQueries(): SlowQueryRecord[] {
    return [...this.recentSlowQueries];
  }

  public recordSlowQuery(record: SlowQueryRecord) {
    // Add to in-memory fast ring buffer
    this.recentSlowQueries.unshift(record);
    if (this.recentSlowQueries.length > this.maxRecentBuffer) {
      this.recentSlowQueries.pop();
    }

    // Asynchronously persist to database (non-blocking)
    setImmediate(async () => {
      try {
        if (mongoose.connection.readyState === 1) {
          await SlowQueryMetric.create({
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
      } catch (err: any) {
        // Silently skip if DB write failed
      }
    });
  }

  public attach(mongooseInstance: typeof mongoose = mongoose) {
    if (this.isAttached) return;
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

    mongooseInstance.plugin((schema: mongoose.Schema) => {
      // Pre-hook to record start time
      schema.pre(
        /^(find|findOne|findOneAndUpdate|findOneAndDelete|updateOne|updateMany|deleteOne|deleteMany|countDocuments)$/,
        function (this: any, next) {
          this.__startTime = Date.now();
          next();
        }
      );

      // Post-hook to measure duration
      schema.post(
        /^(find|findOne|findOneAndUpdate|findOneAndDelete|updateOne|updateMany|deleteOne|deleteMany|countDocuments)$/,
        function (this: any, res: any, next: any) {
          if (this.__startTime) {
            const durationMs = Date.now() - this.__startTime;
            if (durationMs >= self.thresholdMs) {
              const collectionName =
                this.model?.collection?.name || this.mongooseCollection?.name || 'unknown';
              const rawFilter = typeof this.getFilter === 'function' ? this.getFilter() : {};
              const sanitizedFilter = sanitizeQueryFilter(rawFilter);

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
          if (typeof next === 'function') next();
        }
      );
    });
  }
}

export const slowQueryInterceptor = SlowQueryInterceptor.getInstance();
export default slowQueryInterceptor;
