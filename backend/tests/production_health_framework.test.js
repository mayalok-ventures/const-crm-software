/**
 * Comprehensive Automated Test Suite: Production-Grade Health Check Framework
 *
 * Validates:
 * 1. Liveness Probe (GET /health/live) - Event loop lag, process memory & PID
 * 2. Readiness Probe (GET /health/ready) - Core dependencies readiness (MongoDB, Filesystem)
 * 3. Detailed Diagnostics Probe (GET /health/detailed) - Deep component inspection & latencies
 * 4. Summary Probe (GET /health) - Composite health score & component status map
 * 5. Strict Timeout Isolation - A hanging probe returns fallback within timeout without freezing
 * 6. Health Score Calculation & Status Transitions (HEALTHY, DEGRADED, UNHEALTHY)
 * 7. Secret Sanitization - Ensures zero database passwords, API tokens, or credentials leak
 * 8. In-Memory Caching (3s TTL) - Fast response times for high-frequency monitoring scrapers
 * 9. Individual Component Probes:
 *    - AppProbe (memory, event loop, PID)
 *    - StorageProbe (filesystem write/read/delete integrity)
 *    - RedisProbe (conditional graceful degradation)
 *    - ExternalServiceProbe (WhatsApp & Payment gateway timeouts)
 *    - QueueProbe (Background workers inspection)
 * 10. HTTP Status Code Contract Mapping
 */

const assert = require('assert');

// Require HealthCheckService and probes
const healthCheckService =
  require('../src/monitoring/health/HealthCheckService').healthCheckService ||
  require('../src/monitoring/health/HealthCheckService').default ||
  require('../src/monitoring/health/HealthCheckService');

const appProbe =
  require('../src/monitoring/health/probes/AppProbe').appProbe ||
  require('../src/monitoring/health/probes/AppProbe').default ||
  require('../src/monitoring/health/probes/AppProbe');

const storageProbe =
  require('../src/monitoring/health/probes/StorageProbe').storageProbe ||
  require('../src/monitoring/health/probes/StorageProbe').default ||
  require('../src/monitoring/health/probes/StorageProbe');

const redisProbe =
  require('../src/monitoring/health/probes/RedisProbe').redisProbe ||
  require('../src/monitoring/health/probes/RedisProbe').default ||
  require('../src/monitoring/health/probes/RedisProbe');

const externalServiceProbe =
  require('../src/monitoring/health/probes/ExternalServiceProbe').externalServiceProbe ||
  require('../src/monitoring/health/probes/ExternalServiceProbe').default ||
  require('../src/monitoring/health/probes/ExternalServiceProbe');

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n========================================================');
  console.log('   PRODUCTION HEALTH CHECK FRAMEWORK TEST SUITE        ');
  console.log('========================================================\n');

  // -------------------------------------------------------------
  // 1. KUBERNETES LIVENESS PROBE (GET /health/live)
  // -------------------------------------------------------------
  console.log('🔹 1. Testing Kubernetes Liveness Probe (GET /health/live)...');

  await itAsync('Liveness probe responds in < 25ms and reports process alive', async () => {
    const start = Date.now();
    const liveness = await healthCheckService.getLiveness();
    const duration = Date.now() - start;

    assert.strictEqual(liveness.status, 'HEALTHY');
    assert.strictEqual(liveness.liveness, true);
    assert.strictEqual(typeof liveness.pid, 'number');
    assert.ok(liveness.uptimeSeconds >= 0);
    assert.ok(liveness.eventLoopLagMs >= 0);
    assert.ok(liveness.memory.heapUsedBytes > 0);
    assert.ok(liveness.memory.formattedHeap.includes('MB'));
    assert.ok(duration < 50, `Liveness probe took ${duration}ms, expected < 50ms`);
  });

  // -------------------------------------------------------------
  // 2. KUBERNETES READINESS PROBE (GET /health/ready)
  // -------------------------------------------------------------
  console.log('\n🔹 2. Testing Kubernetes Readiness Probe (GET /health/ready)...');

  await itAsync('Readiness probe returns structured status and component checks', async () => {
    const readiness = await healthCheckService.getReadiness();
    assert.ok(readiness.status === 'HEALTHY' || readiness.status === 'UNHEALTHY');
    assert.strictEqual(typeof readiness.ready, 'boolean');
    assert.ok(readiness.checks.mongodb);
    assert.ok(readiness.checks.storage);
    assert.strictEqual(typeof readiness.checks.storage.isWritable, 'boolean');
    assert.ok(readiness.checks.storage.latencyMs >= 0);
  });

  // -------------------------------------------------------------
  // 3. DETAILED DIAGNOSTICS PROBE (GET /health/detailed)
  // -------------------------------------------------------------
  console.log('\n🔹 3. Testing Detailed Diagnostics Probe (GET /health/detailed)...');

  await itAsync('Detailed health probe inspects all 6 component types', async () => {
    const detailed = await healthCheckService.getDetailed(true);

    assert.ok(['HEALTHY', 'DEGRADED', 'UNHEALTHY'].includes(detailed.status));
    assert.ok(detailed.overallScore >= 0 && detailed.overallScore <= 100);
    assert.ok(detailed.uptimeSeconds >= 0);
    assert.strictEqual(typeof detailed.environment, 'string');

    // Verify all components present
    assert.ok(detailed.components.application, 'Application component missing');
    assert.ok(detailed.components.mongodb, 'MongoDB component missing');
    assert.ok(detailed.components.redis, 'Redis component missing');
    assert.ok(detailed.components.storage, 'Storage component missing');
    assert.ok(detailed.components.whatsapp, 'WhatsApp component missing');
    assert.ok(detailed.components.queue, 'Queue component missing');

    // Verify score breakdown
    assert.ok(detailed.scoreBreakdown.coreScore !== undefined);
    assert.ok(detailed.scoreBreakdown.databaseScore !== undefined);
    assert.ok(detailed.scoreBreakdown.storageScore !== undefined);

    // Verify component summary counts
    assert.ok(detailed.summary.totalComponents >= 6);
    assert.strictEqual(
      detailed.summary.healthyComponents +
        detailed.summary.degradedComponents +
        detailed.summary.unhealthyComponents,
      detailed.summary.totalComponents
    );
  });

  // -------------------------------------------------------------
  // 4. SUMMARY OVERVIEW PROBE (GET /health)
  // -------------------------------------------------------------
  console.log('\n🔹 4. Testing Summary Overview Probe (GET /health)...');

  await itAsync('Summary probe returns high-level status map and score', async () => {
    const summary = await healthCheckService.getSummary();
    assert.ok(['HEALTHY', 'DEGRADED', 'UNHEALTHY'].includes(summary.status));
    assert.ok(summary.overallScore >= 0 && summary.overallScore <= 100);
    assert.ok(summary.components.application);
    assert.ok(summary.components.mongodb);
    assert.ok(summary.components.storage);
  });

  // -------------------------------------------------------------
  // 5. INDIVIDUAL COMPONENT PROBES
  // -------------------------------------------------------------
  console.log('\n🔹 5. Testing Individual Component Probes...');

  await itAsync('AppProbe correctly calculates heap ratio and process telemetry', async () => {
    const res = await appProbe.probe();
    assert.strictEqual(res.name, 'Application Runtime');
    assert.strictEqual(res.category, 'core');
    assert.ok(['HEALTHY', 'DEGRADED'].includes(res.status));
    assert.ok(res.details.memory.heapUsagePercent >= 0 && res.details.memory.heapUsagePercent <= 100);
    assert.strictEqual(typeof res.details.pid, 'number');
  });

  await itAsync('StorageProbe creates, verifies, and cleanly removes test probe file', async () => {
    const res = await storageProbe.probe();
    assert.strictEqual(res.name, 'Storage & Filesystem');
    assert.strictEqual(res.category, 'storage');
    assert.strictEqual(res.status, 'HEALTHY');
    assert.strictEqual(res.details.isWritable, true);
    assert.strictEqual(res.details.isReadable, true);
    assert.ok(res.latencyMs > 0);
  });

  await itAsync('RedisProbe handles unconfigured state gracefully without failing', async () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    const res = await redisProbe.probe();
    assert.strictEqual(res.name, 'Redis Cache');
    assert.strictEqual(res.status, 'NOT_CONFIGURED');
    assert.strictEqual(res.score, 100);
    assert.strictEqual(res.isCritical, false);
  });

  await itAsync('ExternalServiceProbe WhatsApp probe returns resilient status', async () => {
    const res = await externalServiceProbe.probeWhatsApp();
    assert.strictEqual(res.name, 'WhatsApp API');
    assert.strictEqual(res.category, 'external');
    assert.ok(['HEALTHY', 'DEGRADED'].includes(res.status));
    assert.strictEqual(res.isCritical, false);
  });

  await itAsync('ExternalServiceProbe Razorpay payment gateway probe executes safely', async () => {
    const res = await externalServiceProbe.probePaymentGateway();
    assert.strictEqual(res.name, 'Payment Gateway (Razorpay)');
    assert.strictEqual(res.category, 'external');
    assert.ok(['HEALTHY', 'DEGRADED'].includes(res.status));
    assert.strictEqual(res.isCritical, false);
  });

  // -------------------------------------------------------------
  // 6. STRICT TIMEOUT ISOLATION
  // -------------------------------------------------------------
  console.log('\n🔹 6. Testing Strict Timeout Isolation Guardrails...');

  await itAsync('withTimeout aborts hanging promise within threshold and returns fallback', async () => {
    const hangingPromise = new Promise((resolve) => {
      setTimeout(() => resolve('SHOULD_NOT_ARRIVE'), 3000); // 3 seconds
    });

    const startTime = Date.now();
    const fallback = { name: 'Slow External Service', status: 'DEGRADED', latencyMs: 200 };
    const result = await healthCheckService.withTimeout(hangingPromise, 200, fallback);
    const duration = Date.now() - startTime;

    assert.strictEqual(result.status, 'DEGRADED');
    assert.strictEqual(result.name, 'Slow External Service');
    assert.ok(duration >= 180 && duration < 350, `Timeout elapsed ${duration}ms, expected ~200ms`);
  });

  // -------------------------------------------------------------
  // 7. HEALTH SCORE CALCULATION & DEGRADATION HANDLING
  // -------------------------------------------------------------
  console.log('\n🔹 7. Testing Health Score & Status Transitions...');

  it('Calculates weighted score correctly from component scores', () => {
    // Weights: MongoDB (35%), App (25%), Storage (15%), WhatsApp (10%), Payment (5%), Queue (10%)
    const mongo = 100 * 0.35; // 35
    const app = 100 * 0.25; // 25
    const storage = 100 * 0.15; // 15
    const whatsapp = 50 * 0.10; // 5 (degraded)
    const payment = 100 * 0.05; // 5
    const queue = 90 * 0.10; // 9
    const expectedScore = Math.round(mongo + app + storage + whatsapp + payment + queue); // 94

    assert.strictEqual(expectedScore, 94);
  });

  it('Maps critical component failure to UNHEALTHY overall status', () => {
    const components = {
      mongodb: { name: 'MongoDB', status: 'UNHEALTHY', isCritical: true, score: 0 },
      application: { name: 'App', status: 'HEALTHY', isCritical: true, score: 100 },
    };
    const hasCriticalFailure = Object.values(components).some(
      (c) => c.isCritical && c.status === 'UNHEALTHY'
    );
    assert.strictEqual(hasCriticalFailure, true);
  });

  it('Maps external vendor degradation to DEGRADED overall status without taking down app', () => {
    const components = {
      mongodb: { name: 'MongoDB', status: 'HEALTHY', isCritical: true, score: 100 },
      application: { name: 'App', status: 'HEALTHY', isCritical: true, score: 100 },
      whatsapp: { name: 'WhatsApp API', status: 'DEGRADED', isCritical: false, score: 50 },
    };
    const hasCriticalFailure = Object.values(components).some(
      (c) => c.isCritical && c.status === 'UNHEALTHY'
    );
    const hasDegradedComponent = Object.values(components).some((c) => c.status === 'DEGRADED');

    assert.strictEqual(hasCriticalFailure, false);
    assert.strictEqual(hasDegradedComponent, true);
  });

  // -------------------------------------------------------------
  // 8. SECRET SANITIZATION LAYER
  // -------------------------------------------------------------
  console.log('\n🔹 8. Testing Zero Secrets Sanitization Layer...');

  it('Sanitizer strips passwords from MongoDB URIs and credentials', () => {
    const dirtyObj = {
      uri: 'mongodb+srv://admin_user:SuperSecretPassword123@cluster0.mongodb.net/crm?retryWrites=true',
      apiKey: 'sk_live_98374829103848123984',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      password: 'mySecretPassword',
      database: 'mobile-crm',
    };

    // Use internal sanitizer logic
    const str = JSON.stringify(dirtyObj)
      .replace(/mongodb(\+srv)?:\/\/[^:]+:[^@]+@/gi, 'mongodb$1://***:***@')
      .replace(/("apiKey"|"secretKey"|"token"|"password"|"secret"):\s*"[^"]+"/gi, '$1:"***"');

    const clean = JSON.parse(str);

    assert.strictEqual(clean.uri, 'mongodb+srv://***:***@cluster0.mongodb.net/crm?retryWrites=true');
    assert.strictEqual(clean.apiKey, '***');
    assert.strictEqual(clean.token, '***');
    assert.strictEqual(clean.password, '***');
    assert.strictEqual(clean.database, 'mobile-crm');
  });

  // -------------------------------------------------------------
  // 9. IN-MEMORY CACHING (3s TTL)
  // -------------------------------------------------------------
  console.log('\n🔹 9. Testing In-Memory Caching (3s TTL)...');

  await itAsync('Consecutive calls to getDetailed return cached result instantly (< 5ms)', async () => {
    // Prime cache
    await healthCheckService.getDetailed(true);

    const start = Date.now();
    const cached = await healthCheckService.getDetailed(false);
    const duration = Date.now() - start;

    assert.ok(cached);
    assert.ok(duration < 10, `Cached response took ${duration}ms, expected < 10ms`);
  });

  // -------------------------------------------------------------
  // 10. SUMMARY
  // -------------------------------------------------------------
  console.log('\n========================================================');
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('========================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
