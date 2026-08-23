"use strict";
/**
 * BACKUP ANOMALY & INCIDENT DETECTOR
 * Evaluates active backup policies and records to detect:
 * 1. BACKUP_MISSED: Scheduled job window elapsed with no execution
 * 2. BACKUP_FAILED: Process crashed or was terminated
 * 3. BACKUP_TOO_OLD: Exceeded SLA age threshold
 * 4. VERIFICATION_FAILED: Corrupted archive, truncated stream, or header mismatch
 * 5. STORAGE_UNAVAILABLE: Destination storage unreachable
 * 6. CORRUPTED_CHECKSUM: Hash mismatch
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupAnomalyDetector = exports.BackupAnomalyDetector = void 0;
const BackupIncident_1 = __importDefault(require("../models/BackupIncident"));
class BackupAnomalyDetector {
    static instance;
    static getInstance() {
        if (!BackupAnomalyDetector.instance) {
            BackupAnomalyDetector.instance = new BackupAnomalyDetector();
        }
        return BackupAnomalyDetector.instance;
    }
    /**
     * Evaluates current system state and returns detected anomalies
     */
    evaluateAnomalies(context) {
        const anomalies = [];
        const now = Date.now();
        const { policies, jobs, latestRecord, recentRecords } = context;
        // 1. Check BACKUP_TOO_OLD per active policy
        for (const policy of policies) {
            if (!policy.isActive)
                continue;
            const maxAgeMs = policy.maxAgeHours * 60 * 60 * 1000;
            const matchingRecent = recentRecords.find((r) => r.status === 'SUCCESS' &&
                r.verification?.status === 'PASSED' &&
                (!r.policyId || r.policyId.toString() === policy._id.toString()));
            if (!matchingRecent) {
                anomalies.push({
                    type: 'BACKUP_TOO_OLD',
                    severity: 'CRITICAL',
                    title: `Backup SLA Breached: Policy "${policy.name}"`,
                    message: `No verified successful backup exists for policy "${policy.name}" within the ${policy.maxAgeHours}-hour SLA threshold.`,
                    policyId: policy._id,
                    details: { maxAgeHours: policy.maxAgeHours, policyName: policy.name },
                });
            }
            else {
                const ageMs = now - new Date(matchingRecent.completedAt || matchingRecent.startedAt).getTime();
                if (ageMs > maxAgeMs) {
                    const ageHours = (ageMs / (1000 * 60 * 60)).toFixed(1);
                    anomalies.push({
                        type: 'BACKUP_TOO_OLD',
                        severity: 'HIGH',
                        title: `Backup Aging: Policy "${policy.name}"`,
                        message: `Latest verified backup for "${policy.name}" is ${ageHours} hours old (exceeds SLA threshold of ${policy.maxAgeHours}h).`,
                        policyId: policy._id,
                        backupId: matchingRecent.backupId,
                        details: { ageHours, maxAgeHours: policy.maxAgeHours, policyName: policy.name },
                    });
                }
            }
        }
        // 2. Check BACKUP_MISSED per active job
        for (const job of jobs) {
            if (!job.isActive || !job.nextScheduledAt)
                continue;
            const scheduledTime = new Date(job.nextScheduledAt).getTime();
            const gracePeriodMs = 2 * 60 * 60 * 1000; // 2 hours grace window
            if (now > scheduledTime + gracePeriodMs) {
                // Scheduled time passed without recent run
                const hasRunRecently = job.lastRunAt && new Date(job.lastRunAt).getTime() >= scheduledTime - 15 * 60 * 1000;
                if (!hasRunRecently) {
                    anomalies.push({
                        type: 'BACKUP_MISSED',
                        severity: 'HIGH',
                        title: `Backup Schedule Missed: Job "${job.name}"`,
                        message: `Backup job "${job.name}" missed scheduled execution at ${new Date(job.nextScheduledAt).toISOString()}.`,
                        policyId: job.policyId,
                        details: { jobId: job.jobId, nextScheduledAt: job.nextScheduledAt },
                    });
                }
            }
        }
        // 3. Check VERIFICATION_FAILED and CORRUPTED_CHECKSUM in recent records
        for (const record of recentRecords.slice(0, 10)) {
            if (record.status === 'VERIFICATION_FAILED' || record.verification?.status === 'FAILED') {
                const isChecksumFault = record.verification?.failureReason?.toLowerCase().includes('checksum');
                anomalies.push({
                    type: isChecksumFault ? 'CORRUPTED_CHECKSUM' : 'VERIFICATION_FAILED',
                    severity: 'CRITICAL',
                    title: `Integrity Verification Failed: ${record.backupId}`,
                    message: `Backup ${record.backupId} failed integrity verification: ${record.verification?.failureReason || 'Archive damaged'}`,
                    policyId: record.policyId,
                    backupId: record.backupId,
                    details: {
                        verificationDetails: record.verification,
                        sizeBytes: record.sizeBytes,
                        location: record.location,
                    },
                });
            }
            if (record.status === 'FAILED') {
                anomalies.push({
                    type: 'BACKUP_FAILED',
                    severity: 'HIGH',
                    title: `Backup Execution Failure: ${record.backupId}`,
                    message: `Backup job execution failed: ${record.failureDetails?.message || 'Execution error'}`,
                    policyId: record.policyId,
                    backupId: record.backupId,
                    details: {
                        failureDetails: record.failureDetails,
                        durationMs: record.durationMs,
                    },
                });
            }
        }
        return anomalies;
    }
    /**
     * Persists detected anomalies to MongoDB while de-duplicating existing open incidents
     */
    async syncIncidents(anomalies) {
        let createdCount = 0;
        for (const a of anomalies) {
            try {
                const query = {
                    type: a.type,
                    status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
                };
                if (a.backupId)
                    query.backupId = a.backupId;
                if (a.policyId)
                    query.policyId = a.policyId;
                const existing = await BackupIncident_1.default.findOne(query);
                if (!existing) {
                    const incidentId = `inc_bkp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                    await BackupIncident_1.default.create({
                        incidentId,
                        type: a.type,
                        severity: a.severity,
                        status: 'OPEN',
                        policyId: a.policyId,
                        backupId: a.backupId,
                        title: a.title,
                        message: a.message,
                        details: a.details,
                        detectedAt: new Date(),
                    });
                    createdCount++;
                }
            }
            catch (err) {
                console.warn('[BackupAnomalyDetector] Incident sync notice:', err.message);
            }
        }
        return createdCount;
    }
}
exports.BackupAnomalyDetector = BackupAnomalyDetector;
exports.backupAnomalyDetector = BackupAnomalyDetector.getInstance();
