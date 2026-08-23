/**
 * MONGODB DATABASE MONITORING TEST SUITE
 * Validates:
 * 1. Multi-Factor Database Health Score Calculations (Availability, Latency, Errors, Resources)
 * 2. Zero-Credential Leakage Sanitization (URIs, Query Filters, Error Messages)
 * 3. Three-Way Failure Diagnostics (App Down vs DB Down vs Network Failure)
 * 4. Slow Query Interceptor & Parameter Redaction
 * 5. Background Worker Telemetry Caching & Graceful Disconnection Fallbacks
 */

const { calculateDatabaseHealthScore } = require('../src/monitoring/database/databaseScoreCalculator');
const {
  sanitizeMongoUri,
  sanitizeQueryFilter,
  sanitizeErrorMessage,
} = require('../src/monitoring/database/databaseSanitizer');
const { diagnoseDatabaseFailure } = require('../src/monitoring/database/databaseDiagnostics');
const { slowQueryInterceptor } = require('../src/monitoring/database/slowQueryInterceptor');
const { databaseMonitorWorker } = require('../src/monitoring/database/DatabaseMonitorWorker');

async function runDatabaseMonitoringTests() {
  console.log('\n========================================================');
  console.log('       MONGODB DATABASE MONITORING TEST SUITE           ');
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
  console.log('🔹 1. Testing Database Health Score Engine (Formula & Weights)...');
  try {
    // 1.1 Optimal Nominal Parameters (18ms ping, 99.99% availability, 0 errors)
    const nominalScore = calculateDatabaseHealthScore({
      readyState: 1,
      pingLatencyMs: 18,
      availabilityPercent: 99.99,
      failedOperationsCount: 0,
      totalOperationsCount: 100,
      activeConnections: 10,
      maxConnections: 100,
      slowQueryCount: 0,
    });

    assert(nominalScore.score >= 90 && nominalScore.score <= 100, `Nominal parameters yield ~90-100% score (Actual: ${nominalScore.score}%)`);
    assert(nominalScore.status === 'HEALTHY', `Nominal status is HEALTHY (Actual: ${nominalScore.status})`);
    assert(nominalScore.breakdown.availabilityScore === 100, 'Availability subscore is 100');
    assert(nominalScore.breakdown.latencyScore === 100, 'Latency subscore is 100 (<20ms)');
    assert(nominalScore.breakdown.errorScore === 100, 'Error subscore is 100 (0 errors)');
    assert(nominalScore.breakdown.resourceScore === 100, 'Resource subscore is 100 (10% pool utilization)');

    // 1.2 Elevated Latency (120ms ping)
    const highLatencyScore = calculateDatabaseHealthScore({
      readyState: 1,
      pingLatencyMs: 120,
      availabilityPercent: 99.99,
      failedOperationsCount: 0,
      totalOperationsCount: 100,
      activeConnections: 10,
      maxConnections: 100,
    });
    assert(highLatencyScore.score < nominalScore.score, `High latency reduces overall score (${highLatencyScore.score}% vs ${nominalScore.score}%)`);
    assert(highLatencyScore.breakdown.latencyScore < 70, `Latency subscore penalized for 120ms (Actual: ${highLatencyScore.breakdown.latencyScore})`);

    // 1.3 High Error Rate (20% errors)
    const highErrorScore = calculateDatabaseHealthScore({
      readyState: 1,
      pingLatencyMs: 20,
      availabilityPercent: 99.99,
      failedOperationsCount: 20,
      totalOperationsCount: 100,
      activeConnections: 10,
      maxConnections: 100,
    });
    assert(highErrorScore.breakdown.errorScore <= 30, `Error subscore heavily penalized for 20% errors (Actual: ${highErrorScore.breakdown.errorScore})`);
    assert(highErrorScore.status === 'DEGRADED' || highErrorScore.status === 'UNHEALTHY', `Status degraded on error spike (Actual: ${highErrorScore.status})`);

    // 1.4 Completely Disconnected State (readyState: 0)
    const downScore = calculateDatabaseHealthScore({
      readyState: 0,
      pingLatencyMs: 0,
      availabilityPercent: 0,
    });
    assert(downScore.score === 0, `Disconnected database yields score of 0 (Actual: ${downScore.score})`);
    assert(downScore.status === 'DOWN', `Disconnected database status is DOWN (Actual: ${downScore.status})`);
  } catch (err) {
    assert(false, `Health score calculation error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. UNIT TEST: CREDENTIAL & SENSITIVE DATA REDACTION
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔹 2. Testing Database Credential & Query Sanitizer (Zero Secret Leakage)...');
  try {
    // 2.1 URI Sanitization
    const rawAtlasUri = 'mongodb+srv://crm_admin:SuperSecretPass%232026@cluster0.j988j68.mongodb.net/crm_production?retryWrites=true&w=majority';
    const sanitizedUri = sanitizeMongoUri(rawAtlasUri);
    assert(!sanitizedUri.includes('SuperSecretPass'), 'Password eliminated from MongoDB URI');
    assert(sanitizedUri.includes('mongodb+srv://crm_admin:***@cluster0.j988j68.mongodb.net'), 'URI credential replaced with *** placeholder');

    // 2.2 Query Filter Parameter Sanitization
    const rawQueryFilter = {
      email: 'john.doe@example.com',
      password: 'PlainPassword123',
      refreshToken: 'rtk_live_99887766',
      metadata: {
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
        leadBudget: 50000,
      },
    };

    const sanitizedFilter = sanitizeQueryFilter(rawQueryFilter);
    assert(sanitizedFilter.email === 'john.doe@example.com', 'Safe filter parameter (email) preserved');
    assert(sanitizedFilter.password === '[REDACTED]', 'Sensitive filter parameter (password) redacted');
    assert(sanitizedFilter.refreshToken === '[REDACTED]', 'Token filter parameter (refreshToken) redacted');
    assert(sanitizedFilter.metadata.twoFactorSecret === '[REDACTED]', 'Nested sensitive parameter (twoFactorSecret) redacted');
    assert(sanitizedFilter.metadata.leadBudget === 50000, 'Nested safe parameter (leadBudget) preserved');

    // 2.3 Error Message Sanitization
    const rawDbError = 'MongoServerError: connection error to mongodb+srv://db_user:SecretP@ss99@db.net failed: password=SecretP@ss99 invalid';
    const cleanError = sanitizeErrorMessage(rawDbError);
    assert(!cleanError.includes('SecretP@ss99'), 'Sensitive credentials removed from error messages');
  } catch (err) {
    assert(false, `Sanitizer test error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. UNIT TEST: THREE-WAY FAILURE DIAGNOSTICS
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔹 3. Testing Diagnostics Engine (Distinguishing App vs DB vs Network)...');
  try {
    // 3.1 Nominal Healthy State
    const healthyDiag = diagnoseDatabaseFailure(1, null, 15);
    assert(healthyDiag.mode === 'HEALTHY', `Nominal connection classified as HEALTHY (Actual: ${healthyDiag.mode})`);
    assert(healthyDiag.isOperational === true, 'Healthy state is operational');

    // 3.2 Application Event Loop Degradation
    const appLagDiag = diagnoseDatabaseFailure(1, null, 15, 450);
    assert(appLagDiag.mode === 'APP_ISSUE', `High event loop delay classified as APP_ISSUE (Actual: ${appLagDiag.mode})`);
    assert(appLagDiag.title.includes('Application'), 'Identifies Application as source of issue');

    // 3.3 Database Down (Connection Refused)
    const dbDownDiag = diagnoseDatabaseFailure(0, { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:27017' });
    assert(dbDownDiag.mode === 'DB_DOWN', `Connection refused classified as DB_DOWN (Actual: ${dbDownDiag.mode})`);
    assert(dbDownDiag.isOperational === false, 'DB Down state is not operational');

    // 3.4 Network Failure (DNS ENOTFOUND / ServerSelectionTimeout)
    const dnsFailDiag = diagnoseDatabaseFailure(0, { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND cluster0.mongodb.net' });
    assert(dnsFailDiag.mode === 'NETWORK_FAILURE', `DNS lookup error classified as NETWORK_FAILURE (Actual: ${dnsFailDiag.mode})`);
    assert(dnsFailDiag.recoveryAdvice.includes('DNS') || dnsFailDiag.recoveryAdvice.includes('VPC'), 'Provides network-specific recovery advice');

    const timeoutDiag = diagnoseDatabaseFailure(0, { code: 'ETIMEDOUT', message: 'Server selection timed out after 30000 ms' });
    assert(timeoutDiag.mode === 'NETWORK_FAILURE', `ServerSelectionTimeout classified as NETWORK_FAILURE (Actual: ${timeoutDiag.mode})`);
  } catch (err) {
    assert(false, `Diagnostics test error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. UNIT TEST: SLOW QUERY INTERCEPTOR & BUFFER
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔹 4. Testing Slow Query Interceptor & Fast Ring Buffer...');
  try {
    slowQueryInterceptor.setThreshold(50);
    assert(slowQueryInterceptor.getThreshold() === 50, 'Threshold updated to 50ms');

    // Record mock slow query
    slowQueryInterceptor.recordSlowQuery({
      collectionName: 'leads',
      operation: 'find',
      durationMs: 240,
      filter: { status: 'new', password: '[REDACTED]' },
      timestamp: new Date(),
    });

    const recentSlow = slowQueryInterceptor.getRecentSlowQueries();
    assert(recentSlow.length > 0, 'Slow query saved into fast in-memory ring buffer');
    assert(recentSlow[0].collectionName === 'leads', 'Slow query collection correctly preserved');
    assert(recentSlow[0].durationMs === 240, 'Slow query duration preserved (240ms)');
  } catch (err) {
    assert(false, `Slow query interceptor test error: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. UNIT TEST: WORKER CACHING & BYTE FORMATTING
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔹 5. Testing Worker In-Memory Caching & Byte Formatter...');
  try {
    const formattedGb = databaseMonitorWorker.formatBytes(1887436800); // ~1.76 GB
    assert(formattedGb.includes('GB'), `1.88B bytes formatted to GB (Actual: ${formattedGb})`);

    const formattedMb = databaseMonitorWorker.formatBytes(26214400); // 25 MB
    assert(formattedMb === '25 MB', `26.2M bytes formatted to MB (Actual: ${formattedMb})`);

    const cachedState = databaseMonitorWorker.getLatestState();
    assert(cachedState !== undefined && cachedState.diagnostics !== undefined, 'Worker exposes immediate cached state');
    assert(cachedState.databaseSize !== undefined, 'Cached state contains formatted database size structure');
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

runDatabaseMonitoringTests();
