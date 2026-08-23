"use strict";
/**
 * BACKUP HEALTH SCORE CALCULATOR
 * Composite 0-100% Reliability Score based on:
 * 1. Timeliness / Recency (35%): Age of last verified successful backup vs policy SLA
 * 2. Integrity Verification (35%): Checksum matching + archive decompression + dry-run restore validation
 * 3. Execution Success Rate (20%): Successful runs vs failed/missed runs in 30-day window
 * 4. Storage Redundancy (10%): External offsite cloud compliance (e.g. AWS S3 / GCS)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBackupHealthScore = calculateBackupHealthScore;
function calculateBackupHealthScore(input) {
    const { lastSuccessfulBackupAgeHours, policyMaxAgeHours = 26, totalBackups30d = 1, successfulBackups30d = 1, verifiedBackups30d = 1, failedBackups30d = 0, openCriticalIncidentsCount = 0, isExternalStorage = true, lastBackupVerified = true, lastBackupStatus = 'SUCCESS', } = input;
    // 1. Recency Score (Weight: 35 points)
    let recencyScore = 35;
    if (lastSuccessfulBackupAgeHours === null || lastSuccessfulBackupAgeHours === undefined) {
        recencyScore = 0;
    }
    else if (lastSuccessfulBackupAgeHours <= policyMaxAgeHours * 0.5) {
        // Under half the SLA (e.g. within 13h of daily 26h policy)
        recencyScore = 35;
    }
    else if (lastSuccessfulBackupAgeHours <= policyMaxAgeHours) {
        // Within SLA window
        recencyScore = 30;
    }
    else if (lastSuccessfulBackupAgeHours <= policyMaxAgeHours * 1.5) {
        // Slightly overdue
        recencyScore = 15;
    }
    else if (lastSuccessfulBackupAgeHours <= policyMaxAgeHours * 2) {
        // Severely overdue
        recencyScore = 5;
    }
    else {
        recencyScore = 0;
    }
    // 2. Verification Score (Weight: 35 points)
    let verificationScore = 35;
    if (totalBackups30d > 0) {
        const verifiedRatio = verifiedBackups30d / Math.max(1, successfulBackups30d);
        verificationScore = Math.round(verifiedRatio * 35);
    }
    // Penalize heavily if the most recent backup itself failed verification
    if (!lastBackupVerified && lastBackupStatus !== 'RUNNING') {
        verificationScore = Math.min(verificationScore, 10);
    }
    // 3. Success Rate Score (Weight: 20 points)
    let successRateScore = 20;
    if (totalBackups30d > 0) {
        const successRatio = successfulBackups30d / totalBackups30d;
        successRateScore = Math.round(successRatio * 20);
    }
    if (lastBackupStatus === 'FAILED') {
        successRateScore = Math.min(successRateScore, 8);
    }
    // 4. Redundancy Score (Weight: 10 points)
    let redundancyScore = 10;
    if (!isExternalStorage) {
        redundancyScore = 4; // Local storage alone lacks offsite catastrophe recovery
    }
    // Calculate composite total
    let totalScore = recencyScore + verificationScore + successRateScore + redundancyScore;
    // Apply open critical incident penalty
    if (openCriticalIncidentsCount > 0) {
        totalScore = Math.max(0, totalScore - openCriticalIncidentsCount * 25);
    }
    totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
    // Classify Status
    let status = 'OPTIMAL';
    let summary = 'All backups are recent, cryptographically verified, and redundantly stored.';
    if (totalScore >= 90) {
        status = 'OPTIMAL';
        summary = 'Backup health is optimal (100% verified & recent).';
    }
    else if (totalScore >= 75) {
        status = 'GOOD';
        summary = 'Backup health is good with minor latency in scheduled verification.';
    }
    else if (totalScore >= 50) {
        status = 'DEGRADED';
        summary = 'Backup health is degraded. Verify backup age or recent failed executions.';
    }
    else {
        status = 'CRITICAL';
        summary = 'CRITICAL: No recent verified backup available. Immediate review required.';
    }
    return {
        score: totalScore,
        status,
        breakdown: {
            recencyScore,
            verificationScore,
            successRateScore,
            redundancyScore,
        },
        summary,
    };
}
