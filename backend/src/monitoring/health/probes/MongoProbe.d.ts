import { ComponentHealth } from '../healthTypes';
export declare class MongoProbe {
    /**
     * Probes MongoDB connection and ping response
     */
    probe(): Promise<ComponentHealth>;
}
export declare const mongoProbe: MongoProbe;
