import mongoose, { Document } from 'mongoose';
import { IIncident } from '../types';
export interface IIncidentDocument extends IIncident, Document {
}
export declare const Incident: mongoose.Model<any, {}, {}, {}, any, any>;
