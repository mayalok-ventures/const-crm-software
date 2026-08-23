import { IPlatformHealthSnapshot } from '../models/PlatformHealthSnapshot';
export interface IHealthTrendSummary {
    currentScore: number;
    currentStatus: string;
    confidence: number;
    delta1Hour: number;
    deltaYesterday: number;
    deltaLastWeek: number;
    historicalAverage24h: number;
    lowestScore24h: number;
    highestScore24h: number;
    timeline: Array<{
        timestamp: Date;
        overallScore: number;
        infrastructureScore: number;
        availabilityScore: number;
        databaseScore: number;
        apiScore: number;
        securityScore: number;
    }>;
}
export declare class HealthTrendService {
    private static instance;
    static getInstance(): HealthTrendService;
    /**
     * Retrieves historical time series data within a specified range.
     */
    getHistory(range?: string): Promise<any[]>;
    /**
     * Computes comprehensive mathematical trend analysis comparing current score with 1h ago, yesterday, and last week.
     */
    getTrendSummary(latestSnapshot: IPlatformHealthSnapshot): Promise<IHealthTrendSummary>;
}
export declare const healthTrendService: HealthTrendService;
export default healthTrendService;
