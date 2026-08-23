import { Request, Response, NextFunction } from 'express';
declare class IpBlockerEngine {
    private blockedIpsSet;
    private isInitialized;
    private syncTimer;
    constructor();
    initSync(): Promise<void>;
    refreshBlockedIps(): Promise<void>;
    isIpBlocked(ip: string): boolean;
    blockIp(ip: string, reason: string, blockedBy?: 'SYSTEM_AUTO' | 'ADMIN', durationMinutes?: number | null, adminUser?: {
        id: string;
        email: string;
    }): Promise<void>;
    unblockIp(ip: string): Promise<boolean>;
    /**
     * Express middleware to intercept and reject traffic from blacklisted IPs
     */
    middleware: (req: Request, res: Response, next: NextFunction) => void;
}
export declare const ipBlocker: IpBlockerEngine;
export {};
