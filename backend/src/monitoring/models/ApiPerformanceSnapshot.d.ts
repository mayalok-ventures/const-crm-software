import mongoose, { Document } from 'mongoose';
import { IApiPerformanceSnapshot } from '../types';
export interface IApiPerformanceSnapshotDocument extends IApiPerformanceSnapshot, Document {
}
export declare const ApiPerformanceSnapshot: mongoose.Model<any, {}, {}, {}, any, any>;
