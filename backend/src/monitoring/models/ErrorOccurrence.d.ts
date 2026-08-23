import mongoose, { Document } from 'mongoose';
export interface IErrorOccurrence extends Document {
    errorId: string;
    fingerprint: string;
    requestId?: string;
    timestamp: Date;
    serverId: string;
    environment: string;
    route: string;
    method: string;
    statusCode: number;
    message: string;
    stackTrace?: string;
    errorType: string;
    userId?: mongoose.Types.ObjectId | string;
    organizationId?: mongoose.Types.ObjectId | string;
    applicationVersion?: string;
    metadata?: Record<string, any>;
}
export declare const ErrorOccurrence: mongoose.Model<any, {}, {}, {}, any, any>;
export default ErrorOccurrence;
