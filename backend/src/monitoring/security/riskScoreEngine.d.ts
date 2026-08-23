import { SecurityEventType, SecuritySeverity } from '../models/SecurityEvent';
export interface MultiFactorContext {
    type: SecurityEventType;
    userId?: string | null;
    tenantId?: string | null;
    ip: string;
    userAgent?: string;
    endpoint?: string;
    recentFailuresCount?: number;
    recentRateLimitsCount?: number;
    isAdminUser?: boolean;
}
export interface SecurityScorecard {
    overallScore: number;
    authenticationScore: number;
    authorizationScore: number;
    abuseProtectionScore: number;
    rateLimitingScore: number;
    summary: {
        totalEvents24h: number;
        openIncidents: number;
        blockedIpsCount: number;
        criticalThreatsCount: number;
    };
}
export declare class RiskScoreEngine {
    /**
     * Calculates dynamic risk score (0 - 100) using multi-factor evaluation.
     * Multi-Factor dimensions:
     * 1. Event Type baseline risk
     * 2. Frequency & Repetition velocity
     * 3. Target privilege (Admin / Superadmin accounts require higher scrutiny)
     * 4. User-Agent / Client characteristics
     * 5. Tenant cross-access attempts
     */
    static calculateEventRisk(context: MultiFactorContext): {
        score: number;
        severity: SecuritySeverity;
    };
    /**
     * Calculates overall and categorical security health scores for the dashboard
     */
    static calculateSecurityScorecard(stats: {
        totalEvents: number;
        loginSuccesses: number;
        loginFailures: number;
        tokenInvalids: number;
        tokenExpireds: number;
        otpAbuses: number;
        permissionDenieds: number;
        rateLimits: number;
        suspiciousActivities: number;
        openIncidents: number;
        criticalIncidents: number;
        blockedIpsCount: number;
    }): SecurityScorecard;
}
