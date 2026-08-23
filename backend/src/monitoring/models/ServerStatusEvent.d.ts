import mongoose, { Document } from 'mongoose';
import { IServerStatusEvent } from '../types';
export interface IServerStatusEventDocument extends IServerStatusEvent, Document {
}
export declare const ServerStatusEvent: mongoose.Model<any, {}, {}, {}, any, any>;
