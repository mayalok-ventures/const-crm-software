import mongoose, { Document } from 'mongoose';
import { IApiEndpointSummary } from '../types';
export interface IApiEndpointSummaryDocument extends IApiEndpointSummary, Document {
}
export declare const ApiEndpointSummary: mongoose.Model<any, {}, {}, {}, any, any>;
