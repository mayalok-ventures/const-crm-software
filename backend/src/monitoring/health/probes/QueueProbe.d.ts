import { ComponentHealth } from '../healthTypes';
export declare class QueueProbe {
    /**
     * Probes background campaign workers and queues
     */
    probe(): Promise<ComponentHealth>;
}
export declare const queueProbe: QueueProbe;
