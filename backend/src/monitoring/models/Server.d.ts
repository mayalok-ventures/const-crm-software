import mongoose, { Document } from 'mongoose';
import { IServer } from '../types';
export interface IServerDocument extends IServer, Document {
}
export declare const Server: mongoose.Model<any, {}, {}, {}, any, any>;
