import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            requestId?: string;
            startTime?: [number, number];
        }
    }
}
export declare class ApiPerformanceMiddleware {
    private buffer;
    private serverId;
    private environment;
    private flushInterval;
    private maxBufferSize;
    private flushIntervalMs;
    constructor();
    getMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
    flush(): Promise<void>;
    private shutdown;
}
export declare const apiPerformance: (req: Request, res: Response, next: NextFunction) => void;
export declare const apiPerformanceInstance: ApiPerformanceMiddleware;
export default apiPerformance;
