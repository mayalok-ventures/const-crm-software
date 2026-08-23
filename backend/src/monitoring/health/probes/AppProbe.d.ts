import { ComponentHealth } from '../healthTypes';
export declare class AppProbe {
    /**
     * Measures event loop lag in milliseconds
     */
    static measureEventLoopLag(): Promise<number>;
    /**
     * Probes application runtime health
     */
    probe(): Promise<ComponentHealth>;
}
export declare const appProbe: AppProbe;
