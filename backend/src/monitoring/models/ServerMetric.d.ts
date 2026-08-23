import mongoose, { Document } from 'mongoose';
import { IServerMetric } from '../types';
export interface IServerMetricDocument extends IServerMetric, Document {
}
export declare const ServerMetric: mongoose.Model<any, {}, {}, {}, any, any>;
