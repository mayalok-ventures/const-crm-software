import mongoose, { Document } from 'mongoose';
import { IServerHeartbeat } from '../types';
export interface IServerHeartbeatDocument extends IServerHeartbeat, Document {
}
export declare const ServerHeartbeat: mongoose.Model<any, {}, {}, {}, any, any>;
