/**
 * BACKUP MONITORING & INTEGRITY VERIFICATION TEST SUITE
 * Validates:
 * 1. Multi-Factor Backup Health Score Calculations (Recency, Verification, Success Rate, Redundancy)
 * 2. 4-Tier Integrity Verification Protocol (Magic Bytes, SHA256 Checksum, Decompression, Simulated Restore)
 * 3. Anomaly & Incident Detection (Missed, Aging, Failed, Corrupted Checksum)
 * 4. Zero-Credential Sanitization & Byte Formatting
 * 5. Background Monitor Worker In-Memory Caching & Telemetry
 */

const { calculateBackupHealthScore } = require('../src/monitoring/backup/backupScoreCalculator');
const {
  backupVerificationEngine,
} = require('../src/monitoring/backup/backupVerificationEngine');
const {
  backupAnomalyDetector,
} = require('../src/monitoring/backup/backupAnomalyDetector');
const {
  sanitizeBackupLocation,
  formatBackupBytes,
  formatDurationMs,
} = require('../src/monitoring/backup/backupSanitizer');
const { backupMonitorWorker } = require('../src/monitoring/backup/BackupMonitorWorker');

async function runBackupMonitoringTests() {
  console.log('\n========================================================');
  console.log('    BACKUP MONITORING & INTEGRITY VERIFICATION TESTS    ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. UNIT TEST: HEALTH SCORE CALCULATION
  // ─────────────────────────────────────────────────────────────
  console.log('🔹 1. Testing Backup Health Score Engine (Formula & Weights)...');
  try {
    // 1.1 Optimal Nominal Parameters (Recent 2h, 100% verified, Offsite S3)
    const nominalScore = calculateBackupHealthScore({
      lastSuccessfulBackupAgeHours: 2,
      policyMaxAgeHours: 26,
      totalBackups30d: 30,
      successfulBackups30d: 30,
      verifiedBackups30d: 30,
      failedBackups30d: 0,
      openCriticalIncidentsCount: 0,
      isExternalStorage: true,
      lastBackupVerified: true,
      lastBackupStatus: 'SUCCESS',
    });

    assert(nominalScore.score === 100, `Optimal backup yields 100% Health (Actual: ${nominalScore.score}%)`);
    assert(nominalScore.status === 'OPTIMAL', `Optimal status is OPTIMAL (Actual: ${nominalScore.status})`);
    assert(nominalScore.breakdown.recencyScore === 35, 'Recency subscore is 35 (under 13h)');
    assert(nominalScore.breakdown.verificationScore === 35, 'Verification subscore is 35 (100% verified)');
    assert(nominalScore.breakdown.successRateScore === 20, 'Success rate subscore is 20 (0 failures)');
    assert(nominalScore.breakdown.redundancyScore === 10, 'Redundancy subscore is 10 (External S3)');

    // 1.2 Aging Backup (Age: 35 hours on 26h policy)
    const agingScore = calculateBackupHealthScore({
      lastSuccessfulBackupAgeHours: 35,
      policyMaxAgeHours: 26,
      totalBackups30d: 30,
      successfulBackups30d: 29,
      verifiedBackups30d: 29,
      failedBackups30d: 1,
      openCriticalIncidentsCount: 0,
      isExternalStorage: true,
      lastBackupVerified: true,
      lastBackupStatus: 'SUCCESS',
    });

    assert(agingScore.score < 90, `Aging backup reduces health score (${agingScore.score}% vs 100%)`);
    assert(agingScore.breakdown.recencyScore === 15, `Recency subscore penalized for 35h age (Actual: ${agingScore.breakdown.recencyScore})`);
    assert(agingScore.status === 'GOOD' || agingScore.status === 'DEGRADED', `Status reflects aging (Actual: ${agingScore.status})`);

    // 1.3 Unverified / Verification Failed
    const unverifiedScore = calculateBackupHealthScore({
      lastSuccessfulBackupAgeHours: 4,
      policyMaxAgeHours: 26,
      totalBackups30d: 30,
      successfulBackups30d: 30,
      verifiedBackups30d: 15,
      failedBackups30d: 0,
      openCriticalIncidentsCount: 1,
      isExternalStorage: true,
      lastBackupVerified: false,
      lastBackupStatus: 'VERIFICATION_FAILED',
    });

    assert(unverifiedScore.score <= 50, `Verification failure heavily reduces score (Actual: ${unverifiedScore.score}%)`);
    assert(unverifiedScore.status === 'CRITICAL' || unverifiedScore.status === 'DEGRADED', `Unverified status is degraded (Actual: ${unverifiedScore.status})`);

    // 1.4 Local-Only Storage (No external offsite)
    const localScore = calculateBackupHealthScore({
      lastSuccessfulBackupAgeHours: 2,
      policyMaxAgeHours: 26,
      totalBackups30d: 30,
      successfulBackups30d: 30,
      verifiedBackups30d: 30,
      failedBackups30d: 0,
      openCriticalIncidentsCount: 0,
      isExternalStorage: false,
      lastBackupVerified: true,
      lastBackupStatus: 'SUCCESS',
    });
    assert(localScore.breakdown.redundancyScore === 4, 'Local-only storage receives only 4/10 redundancy points');
    assert(localScore.score === 94, `Local-only score is 94% (Actual: ${localScore.score}%)`);
  } catch (err) {
    assert(false, `Health score calculation error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. UNIT TEST: 4-TIER INTEGRITY VERIFICATION PROTOCOL
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔹 2. Testing 4-Tier Integrity Verification Protocol...');
  try {
    // 2.1 Valid Gzip Archive
    const sampleGzip = backupVerificationEngine.createSampleGzipBackup(
      '{"database":"mobile-crm","collections":["leads","users","settings"]}'
    );
    const validChecksum = backupVerificationEngine.computeSha256(sampleGzip);

    const validReport = backupVerificationEngine.verifyBackupBuffer(sampleGzip, validChecksum, {
      databaseName: 'mobile-crm',
      collectionsCount: 3,
      documentsCount: 50,
      sizeBytes: sampleGzip.length,
    });

    assert(validReport.overallPassed === true, 'Valid Gzip backup passes all 4 verification tiers');
    assert(validReport.fileHeaderValid === true, 'Tier 1 (Magic Bytes Header) PASSED');
    assert(validReport.checksumMatch === true, 'Tier 2 (SHA-256 Checksum) PASSED');
    assert(validReport.decompressionTestValid === true, 'Tier 3 (Stream Decompression) PASSED');
    assert(validReport.simulatedRestoreValid === true, 'Tier 4 (Catalog Schema Dry-Run) PASSED');
    assert(validReport.steps.length === 4, 'Report contains all 4 audit verification steps');

    // 2.2 Tampered Checksum Detection
    const wrongChecksum = '0000000000000000000000000000000000000000000000000000000000000000';
    const tamperedReport = backupVerificationEngine.verifyBackupBuffer(sampleGzip, wrongChecksum);
    assert(tamperedReport.overallPassed === false, 'Tampered checksum fails verification');
    assert(tamperedReport.checksumMatch === false, 'Detects checksum mismatch correctly');
    assert(tamperedReport.failureReason.includes('Checksum mismatch'), 'Includes explicit checksum failure detail');

    // 2.3 Corrupt / Truncated Stream
    const corruptedBuffer = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xde, 0xad, 0xbe, 0xef]); // Invalid truncated gzip
    const corruptReport = backupVerificationEngine.verifyBackupBuffer(corruptedBuffer);
    assert(corruptReport.overallPassed === false, 'Corrupted stream fails overall verification');
    assert(corruptReport.decompressionTestValid === false, 'Tier 3 catches decompression block failure');

    // 2.4 Random Garbage Non-Archive Data
    const garbageBuffer = Buffer.from('This is arbitrary plain text with no archive header');
    const garbageReport = backupVerificationEngine.verifyBackupBuffer(garbageBuffer);
    assert(garbageReport.fileHeaderValid === false, 'Tier 1 rejects non-archive header');
  } catch (err) {
    assert(false, `Verification engine error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. UNIT TEST: ANOMALY & INCIDENT DETECTOR
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔹 3. Testing Anomaly & Incident Detection Engine...');
  try {
    const mockPolicy = {
      _id: 'pol_123',
      name: 'Production Daily Snapshot',
      maxAgeHours: 26,
      isActive: true,
    };

    // 3.1 Detect BACKUP_TOO_OLD
    const oldRecord = {
      backupId: 'bkp_old_1',
      policyId: 'pol_123',
      status: 'SUCCESS',
      verification: { status: 'PASSED' },
      completedAt: new Date(Date.now() - 32 * 60 * 60 * 1000), // 32 hours old
      startedAt: new Date(Date.now() - 32 * 60 * 60 * 1000),
    };

    const ageAnomalies = backupAnomalyDetector.evaluateAnomalies({
      policies: [mockPolicy],
      jobs: [],
      latestRecord: oldRecord,
      recentRecords: [oldRecord],
    });

    const tooOldIncident = ageAnomalies.find((a) => a.type === 'BACKUP_TOO_OLD');
    assert(tooOldIncident !== undefined, 'Detects BACKUP_TOO_OLD anomaly when age > maxAgeHours');
    assert(tooOldIncident.severity === 'HIGH', 'Severity is HIGH for aging backup');

    // 3.2 Detect BACKUP_MISSED
    const mockJob = {
      jobId: 'job_daily',
      policyId: 'pol_123',
      name: 'Daily Snapshot Job',
      isActive: true,
      nextScheduledAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3h ago
      lastRunAt: new Date(Date.now() - 28 * 60 * 60 * 1000),
    };

    const missedAnomalies = backupAnomalyDetector.evaluateAnomalies({
      policies: [mockPolicy],
      jobs: [mockJob],
      recentRecords: [],
    });

    const missedIncident = missedAnomalies.find((a) => a.type === 'BACKUP_MISSED');
    assert(missedIncident !== undefined, 'Detects BACKUP_MISSED when schedule passed by >2h');

    // 3.3 Detect VERIFICATION_FAILED
    const failedVerificationRecord = {
      backupId: 'bkp_corrupt_99',
      policyId: 'pol_123',
      status: 'VERIFICATION_FAILED',
      verification: { status: 'FAILED', failureReason: 'Decompression block error' },
    };

    const failedAnomalies = backupAnomalyDetector.evaluateAnomalies({
      policies: [mockPolicy],
      jobs: [],
      recentRecords: [failedVerificationRecord],
    });

    const vFailIncident = failedAnomalies.find((a) => a.type === 'VERIFICATION_FAILED');
    assert(vFailIncident !== undefined, 'Detects VERIFICATION_FAILED anomaly on damaged backup');
    assert(vFailIncident.severity === 'CRITICAL', 'Verification failure is CRITICAL severity');
  } catch (err) {
    assert(false, `Anomaly detector error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. UNIT TEST: CREDENTIAL SANITIZATION & BYTE FORMATTING
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔹 4. Testing Zero-Credential Sanitizer & Formatters...');
  try {
    const rawS3Location = {
      target: 'S3',
      path: 's3://AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY@production-bucket/backups/daily.tar.gz',
      bucket: 'production-bucket',
      region: 'us-east-1',
      isExternal: true,
    };

    const cleanLocation = sanitizeBackupLocation(rawS3Location);
    assert(!cleanLocation.path.includes('AKIAIOSFODNN7EXAMPLE'), 'Access key redacted from path');
    assert(!cleanLocation.path.includes('wJalrXUtnFEMI'), 'Secret key redacted from path');
    assert(cleanLocation.path.includes('***:***@production-bucket'), 'Credentials replaced with *** placeholder');

    // Byte Formatting
    assert(formatBackupBytes(505413632) === '482 MB', '505MB formatted correctly to "482 MB"');
    assert(formatBackupBytes(15525216256).includes('GB'), '15.5GB formatted correctly to GB');

    // Duration Formatting
    assert(formatDurationMs(42000) === '42s', '42000ms formatted to "42s"');
    assert(formatDurationMs(125000) === '2m 5s', '125000ms formatted to "2m 5s"');
  } catch (err) {
    assert(false, `Sanitizer test error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. UNIT TEST: MONITOR WORKER CACHING & DASHBOARD SNAPSHOT
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔹 5. Testing Worker In-Memory Caching & Dashboard Snapshot...');
  try {
    const cachedState = backupMonitorWorker.getLatestState();
    assert(cachedState !== undefined, 'Worker exposes immediate cached state');
    assert(cachedState.healthScore === 100, `Health score is 100% (Actual: ${cachedState.healthScore}%)`);
    assert(cachedState.lastBackup.sizeFormatted === '482 MB', `Size formatted is 482 MB (Actual: ${cachedState.lastBackup.sizeFormatted})`);
    assert(cachedState.lastBackup.verified === true, 'Last backup verified status is true');
    assert(cachedState.lastBackup.status === 'SUCCESS', 'Last backup status is SUCCESS');
  } catch (err) {
    assert(false, `Worker caching test error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // SUMMARY REPORT
  // ─────────────────────────────────────────────────────────────
  console.log('\n========================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runBackupMonitoringTests();
