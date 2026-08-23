import mongoose, { Document } from 'mongoose';
export type ErrorStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED';
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface IErrorNote {
    author: string;
    authorId?: mongoose.Types.ObjectId;
    note: string;
    createdAt: Date;
}
export interface IErrorGroup extends Document {
    fingerprint: string;
    errorType: string;
    message: string;
    stackTrace: string;
    primaryFrame: string;
    status: ErrorStatus;
    severity: ErrorSeverity;
    occurrences: number;
    firstSeen: Date;
    lastSeen: Date;
    affectedEndpoints: string[];
    affectedServers: string[];
    affectedUsersCount: number;
    affectedOrgsCount: number;
    notes: IErrorNote[];
    isRegression: boolean;
    lastResolvedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}
export declare const ErrorGroup: mongoose.Model<any, {}, {}, {}, any, any>;
export default ErrorGroup;
