import { ComponentHealth } from '../healthTypes';
export declare class RedisProbe {
    /**
     * Probes Redis connection if configured in environment
     */
    probe(): Promise<ComponentHealth>;
}
export declare const redisProbe: RedisProbe;
