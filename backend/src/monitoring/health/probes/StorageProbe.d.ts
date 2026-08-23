import { ComponentHealth } from '../healthTypes';
export declare class StorageProbe {
    /**
     * Probes local filesystem read/write capability and disk space
     */
    probe(): Promise<ComponentHealth>;
}
export declare const storageProbe: StorageProbe;
