import mongoose, { Document } from 'mongoose';
import { IApiMetric } from '../types';
export interface IApiMetricDocument extends IApiMetric, Document {
}
export declare const ApiMetric: mongoose.Model<any, {}, {}, {}, any, any>;
