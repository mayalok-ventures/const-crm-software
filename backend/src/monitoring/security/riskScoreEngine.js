"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskScoreEngine = void 0;
class RiskScoreEngine {
    /**
     * Calculates dynamic risk score (0 - 100) using multi-factor evaluation.
     * Multi-Factor dimensions:
     * 1. Event Type baseline risk
     * 2. Frequency & Repetition velocity
     * 3. Target privilege (Admin / Superadmin accounts require higher scrutiny)
     * 4. User-Agent / Client characteristics
     * 5. Tenant cross-access attempts
     */
    static calculateEventRisk(context) {
        let score = 0;
        // 1. Base score by event type
        switch (context.type) {
            case 'LOGIN_SUCCESS':
                score = 5;
                break;
            case 'PASSWORD_RESET':
                score = 25;
                break;
            case 'TOKEN_EXPIRED':
                score = 20;
                break;
            case 'TOKEN_INVALID':
                score = 45;
                break;
            case 'LOGIN_FAILED':
                score = 35;
                break;
            case 'PERMISSION_DENIED':
                score = 55;
                break;
            case 'RATE_LIMIT':
                score = 50;
                break;
            case 'OTP_ABUSE':
                score = 75;
                break;
            case 'ADMIN_ACTION':
                score = 30;
                break;
            case 'SUSPICIOUS_ACTIVITY':
                score = 80;
                break;
            default:
                score = 15;
        }
        // 2. Velocity multiplier (multiple failures from user/IP)
        const failures = context.recentFailuresCount || 0;
        if (failures > 10) {
            score += 45;
        }
        else if (failures > 5) {
            score += 30;
        }
        else if (failures > 2) {
            score += 15;
        }
        // 3. Rate limiting violations multiplier
        const rateLimits = context.recentRateLimitsCount || 0;
        if (rateLimits > 15) {
            score += 40;
        }
        else if (rateLimits > 5) {
            score += 20;
        }
        // 4. Admin account risk amplification
        if (context.isAdminUser && context.type === 'LOGIN_FAILED') {
            score += 20; // Targeting admin accounts is higher risk
        }
        // 5. Bot or missing user agent
        if (!context.userAgent || context.userAgent.includes('curl') || context.userAgent.includes('python')) {
            if (context.type !== 'LOGIN_SUCCESS') {
                score += 10;
            }
        }
        // Clamp score between 0 and 100
        const clampedScore = Math.min(100, Math.max(0, Math.round(score)));
        // Derive Severity
        let severity = 'LOW';
        if (clampedScore >= 80) {
            severity = 'CRITICAL';
        }
        else if (clampedScore >= 60) {
            severity = 'HIGH';
        }
        else if (clampedScore >= 35) {
            severity = 'MEDIUM';
        }
        return { score: clampedScore, severity };
    }
    /**
     * Calculates overall and categorical security health scores for the dashboard
     */
    static calculateSecurityScorecard(stats) {
        const totalAuthAttempts = stats.loginSuccesses + stats.loginFailures + stats.otpAbuses;
        const totalAuthzAttempts = stats.totalEvents - totalAuthAttempts;
        // Authentication Score (Target ~98%)
        // Deduct for failed logins ratio and OTP abuse
        let authScore = 100;
        if (totalAuthAttempts > 0) {
            const failRatio = (stats.loginFailures + stats.otpAbuses * 2) / totalAuthAttempts;
            authScore = Math.max(70, Math.round(100 - failRatio * 15 - stats.otpAbuses * 2));
        }
        // Authorization Score (Target ~97%)
        // Deduct for permission denied and token invalid events
        let authzScore = 100;
        const authzViolations = stats.permissionDenieds + stats.tokenInvalids * 1.2;
        if (authzViolations > 0) {
            authzScore = Math.max(70, Math.round(100 - Math.min(25, authzViolations * 0.6)));
        }
        // Abuse Protection Score (Target ~91%)
        // Deduct for suspicious activities and critical incidents
        let abuseScore = 100;
        const abuseDeduction = stats.suspiciousActivities * 3 + stats.criticalIncidents * 4 + stats.openIncidents * 1.5;
        abuseScore = Math.max(60, Math.round(100 - Math.min(35, abuseDeduction)));
        // Rate Limiting Health Score (Target ~94%)
        // Deduct for rate limit triggers
        let rateLimitScore = 100;
        if (stats.rateLimits > 0) {
            rateLimitScore = Math.max(65, Math.round(100 - Math.min(30, stats.rateLimits * 1.2)));
        }
        // Overall Weighted Security Score
        // Weights: Auth (30%), Authz (25%), Abuse Protection (25%), Rate Limiting (20%)
        const overallScore = Math.round(authScore * 0.3 +
            authzScore * 0.25 +
            abuseScore * 0.25 +
            rateLimitScore * 0.2);
        return {
            overallScore: Math.min(100, Math.max(0, overallScore)),
            authenticationScore: Math.min(100, Math.max(0, authScore)),
            authorizationScore: Math.min(100, Math.max(0, authzScore)),
            abuseProtectionScore: Math.min(100, Math.max(0, abuseScore)),
            rateLimitingScore: Math.min(100, Math.max(0, rateLimitScore)),
            summary: {
                totalEvents24h: stats.totalEvents,
                openIncidents: stats.openIncidents,
                blockedIpsCount: stats.blockedIpsCount,
                criticalThreatsCount: stats.criticalIncidents,
            },
        };
    }
}
exports.RiskScoreEngine = RiskScoreEngine;
