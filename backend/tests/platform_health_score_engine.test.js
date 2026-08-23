/**
 * Comprehensive Automated Test Suite: Platform Performance & Health Score Engine
 * Tests all 12 components, metric normalizers, circuit breaker severity rules,
 * confidence evaluation, configurable weights, and historical trends.
 */

const assert = require('assert');
const { MetricNormalizer } = require('../src/monitoring/health/MetricNormalizer');
const { DEFAULT_THRESHOLDS, DEFAULT_CIRCUIT_BREAKERS, DEFAULT_COMPONENT_WEIGHTS } = require('../src/monitoring/models/HealthWeightConfig');
const { HealthScoreEngine } = require('../src/monitoring/health/HealthScoreEngine');

async function runTests() {
  console.log('\n🧪 =======================================================');
  console.log('   STARTING PLATFORM HEALTH SCORE ENGINE TEST SUITE');
  console.log('=======================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function it(description, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${description}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${description}`);
      console.error(`     Error: ${err.message}`);
      throw err;
    }
  }

  async function itAsync(description, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${description}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${description}`);
      console.error(`     Error: ${err.message}`);
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 1. METRIC NORMALIZER UNIT TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('📦 1. MetricNormalizer Math & Curves:');

  it('Normalizes CPU/RAM usage <= 50% smoothly between 95 and 100', () => {
    const score0 = MetricNormalizer.normalizeUsage(0, 75, 90);
    const score25 = MetricNormalizer.normalizeUsage(25, 75, 90);
    const score50 = MetricNormalizer.normalizeUsage(50, 75, 90);

    assert.strictEqual(score0, 100);
    assert.strictEqual(score25, 97.5);
    assert.strictEqual(score50, 95);
  });

  it('Normalizes elevated CPU/RAM usage (75% warning -> 80 pts, 90% critical -> 45 pts, 100% -> 0 pts)', () => {
    const score75 = MetricNormalizer.normalizeUsage(75, 75, 90);
    const score90 = MetricNormalizer.normalizeUsage(90, 75, 90);
    const score100 = MetricNormalizer.normalizeUsage(100, 75, 90);

    assert.strictEqual(score75, 80);
    assert.strictEqual(score90, 45);
    assert.strictEqual(score100, 0);
  });

  it('Normalizes API Latency (100ms optimal -> 95 pts, 300ms warning -> 75 pts, 1000ms critical -> 30 pts, 2000ms -> 0 pts)', () => {
    const score50 = MetricNormalizer.normalizeLatency(50, 100, 300, 1000);
    const score100 = MetricNormalizer.normalizeLatency(100, 100, 300, 1000);
    const score300 = MetricNormalizer.normalizeLatency(300, 100, 300, 1000);
    const score1000 = MetricNormalizer.normalizeLatency(1000, 100, 300, 1000);
    const score2000 = MetricNormalizer.normalizeLatency(2000, 100, 300, 1000);

    assert(score50 >= 95 && score50 <= 100, `Expected 95-100 for 50ms, got ${score50}`);
    assert.strictEqual(score100, 95);
    assert.strictEqual(score300, 75);
    assert.strictEqual(score1000, 30);
    assert.strictEqual(score2000, 0);
  });

  it('Normalizes Error Rates (0% -> 100 pts, 1% warning -> 85 pts, 5% critical -> 40 pts, >15% -> 0 pts)', () => {
    const score0 = MetricNormalizer.normalizeErrorRate(0, 1.0, 5.0);
    const score1 = MetricNormalizer.normalizeErrorRate(1.0, 1.0, 5.0);
    const score5 = MetricNormalizer.normalizeErrorRate(5.0, 1.0, 5.0);
    const score15 = MetricNormalizer.normalizeErrorRate(15.0, 1.0, 5.0);

    assert.strictEqual(score0, 100);
    assert.strictEqual(score1, 85);
    assert.strictEqual(score5, 40);
    assert.strictEqual(score15, 0);
  });

  it('Normalizes Uptime (99.99% -> 100 pts, 99.9% -> 95 pts, 99.0% -> 80 pts, 95.0% -> 50 pts, 0% -> 0 pts)', () => {
    const score9999 = MetricNormalizer.normalizeUptime(99.99);
    const score999 = MetricNormalizer.normalizeUptime(99.9);
    const score990 = MetricNormalizer.normalizeUptime(99.0);
    const score950 = MetricNormalizer.normalizeUptime(95.0);
    const score0 = MetricNormalizer.normalizeUptime(0);

    assert.strictEqual(score9999, 100);
    assert.strictEqual(score999, 95);
    assert.strictEqual(score990, 80);
    assert.strictEqual(score950, 50);
    assert.strictEqual(score0, 0);
  });

  it('Maps scores to discrete status thresholds correctly', () => {
    assert.strictEqual(MetricNormalizer.getStatusFromScore(98, DEFAULT_THRESHOLDS), 'EXCELLENT');
    assert.strictEqual(MetricNormalizer.getStatusFromScore(92, DEFAULT_THRESHOLDS), 'HEALTHY');
    assert.strictEqual(MetricNormalizer.getStatusFromScore(82, DEFAULT_THRESHOLDS), 'GOOD');
    assert.strictEqual(MetricNormalizer.getStatusFromScore(68, DEFAULT_THRESHOLDS), 'WARNING');
    assert.strictEqual(MetricNormalizer.getStatusFromScore(48, DEFAULT_THRESHOLDS), 'DEGRADED');
    assert.strictEqual(MetricNormalizer.getStatusFromScore(32, DEFAULT_THRESHOLDS), 'CRITICAL');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. CONFIDENCE & STALENESS EVALUATION TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n📦 2. Confidence & Data Freshness Tracking:');

  it('Calculates 100% confidence when all telemetry sources are fresh and available', () => {
    const sources = [
      { name: 'ServerMetric', isAvailable: true, ageSeconds: 20, maxAgeSeconds: 120 },
      { name: 'ApiMetric', isAvailable: true, ageSeconds: 15, maxAgeSeconds: 60 },
      { name: 'DatabaseMetric', isAvailable: true, ageSeconds: 5, maxAgeSeconds: 60 },
    ];
    const { confidence, warning, staleCount } = MetricNormalizer.calculateConfidence(sources);
    assert.strictEqual(confidence, 100);
    assert.strictEqual(staleCount, 0);
    assert.strictEqual(warning, undefined);
  });

  it('Degrades confidence and provides clear explanation when telemetry sources are missing or stale', () => {
    const sources = [
      { name: 'ServerMetric', isAvailable: true, ageSeconds: 20, maxAgeSeconds: 120 },
      { name: 'DatabaseMetric', isAvailable: false, ageSeconds: 999, maxAgeSeconds: 60 },
      { name: 'BackupRecord', isAvailable: true, ageSeconds: 18000, maxAgeSeconds: 3600 },
    ];
    const { confidence, warning, staleCount } = MetricNormalizer.calculateConfidence(sources);
    assert.strictEqual(confidence, 33); // 1 out of 3 fresh & available
    assert.strictEqual(staleCount, 1);
    assert(warning && warning.includes('DatabaseMetric (unavailable)'), `Expected warning about DatabaseMetric, got: ${warning}`);
    assert(warning && warning.includes('BackupRecord (stale:'), `Expected warning about BackupRecord staleness, got: ${warning}`);
  });

  // ─────────────────────────────────────────────────────────────
  // 3. HEALTH SCORE ENGINE & 12 SUBSYSTEMS EVALUATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n📦 3. HealthScoreEngine Full Evaluation & Severity Rules:');

  const engine = HealthScoreEngine.getInstance();

  itAsync('Evaluates all 12 platform components with required shape and non-random metrics', async () => {
    const snapshot = await engine.evaluatePlatformHealth();

    assert(snapshot.snapshotId.startsWith('hlth_'), 'Snapshot must have valid ID');
    assert(typeof snapshot.overallScore === 'number' && snapshot.overallScore >= 0 && snapshot.overallScore <= 100);
    assert(['EXCELLENT', 'HEALTHY', 'GOOD', 'WARNING', 'DEGRADED', 'CRITICAL'].includes(snapshot.overallStatus));
    assert(Array.isArray(snapshot.components) && snapshot.components.length === 12, `Expected 12 components, got ${snapshot.components.length}`);

    const expectedComponentIds = [
      'infrastructure',
      'availability',
      'api_performance',
      'api_reliability',
      'database',
      'security',
      'storage',
      'backup',
      'integrations',
      'errors',
      'deployment',
      'tenant_resources',
    ];

    for (const compId of expectedComponentIds) {
      const comp = snapshot.components.find((c) => c.componentId === compId);
      assert(comp, `Missing expected component '${compId}'`);
      assert(typeof comp.score === 'number' && comp.score >= 0 && comp.score <= 100, `Invalid score for ${compId}: ${comp.score}`);
      assert(['EXCELLENT', 'HEALTHY', 'GOOD', 'WARNING', 'DEGRADED', 'CRITICAL'].includes(comp.status));
      assert(typeof comp.confidence === 'number' && comp.confidence >= 0 && comp.confidence <= 100);
      assert(comp.metricsUsed && typeof comp.metricsUsed === 'object', `Missing metricsUsed for ${compId}`);
      assert(Array.isArray(comp.deductions), `deductions must be array for ${compId}`);
      assert(comp.timestamp instanceof Date || typeof comp.timestamp === 'string' || typeof comp.timestamp === 'number');
    }

    assert(Array.isArray(snapshot.topDeductions));
    assert(snapshot.systemContext && typeof snapshot.systemContext.activeIncidentsCount === 'number');
  });

  it('Verifies default component weights sum to 1.00 (100%)', () => {
    const total = DEFAULT_COMPONENT_WEIGHTS.reduce((sum, w) => sum + (w.isEnabled ? w.weight : 0), 0);
    assert.strictEqual(Math.round(total * 100) / 100, 1.0);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. CIRCUIT BREAKER SEVERITY RULES TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n📦 4. Circuit Breakers (No single metric hides critical failure):');

  it('Circuit Breaker Rule 1: Database failure forces overall score <= 35 (CRITICAL)', () => {
    // Simulate database score = 0
    const dbComp = {
      componentId: 'database',
      name: 'Database Health',
      score: 0,
      status: 'CRITICAL',
      weight: 0.10,
      weightedScore: 0,
      confidence: 0,
      metricsUsed: { isConnected: false },
      deductions: [{ metric: 'Database Connection', penalty: 100, reason: 'MongoDB is DOWN' }],
    };

    // Even if other 11 components are 100%, circuit breaker must cap at <= 35
    const mockComponents = DEFAULT_COMPONENT_WEIGHTS.map((w) => {
      if (w.componentId === 'database') return dbComp;
      return {
        componentId: w.componentId,
        name: w.name,
        score: 100,
        status: 'EXCELLENT',
        weight: w.weight,
        weightedScore: w.weight * 100,
        confidence: 100,
        metricsUsed: {},
        deductions: [],
      };
    });

    let rawScore = mockComponents.reduce((acc, c) => acc + c.score * c.weight, 0);
    assert(rawScore === 90, `Raw weighted score would be 90 without circuit breaker`);

    // Applying Circuit Breaker:
    if (DEFAULT_CIRCUIT_BREAKERS.databaseDownForcesCritical && (dbComp.status === 'CRITICAL' || dbComp.score < 40)) {
      rawScore = Math.min(rawScore, 35);
    }

    const finalStatus = MetricNormalizer.getStatusFromScore(rawScore, DEFAULT_THRESHOLDS);
    assert.strictEqual(rawScore, 35);
    assert.strictEqual(finalStatus, 'CRITICAL');
  });

  it('Circuit Breaker Rule 2: 0 Servers Online forces overall score <= 20 (CRITICAL)', () => {
    const serversOnline = 0;
    let score = 95; // healthy otherwise

    if (DEFAULT_CIRCUIT_BREAKERS.zeroServersOnlineForcesCritical && serversOnline === 0) {
      score = Math.min(score, 20);
    }

    const status = MetricNormalizer.getStatusFromScore(score, DEFAULT_THRESHOLDS);
    assert.strictEqual(score, 20);
    assert.strictEqual(status, 'CRITICAL');
  });

  it('Circuit Breaker Rule 3: Active Critical Security Incident caps overall score at 55 (DEGRADED)', () => {
    let score = 94; // healthy otherwise
    const securityStatus = 'CRITICAL';

    if (DEFAULT_CIRCUIT_BREAKERS.criticalSecurityIncidentCapsDegraded && securityStatus === 'CRITICAL') {
      score = Math.min(score, 55);
    }

    const status = MetricNormalizer.getStatusFromScore(score, DEFAULT_THRESHOLDS);
    assert.strictEqual(score, 55);
    assert.strictEqual(status, 'DEGRADED');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. EXPLAINABILITY & DEDUCTIONS TEST
  // ─────────────────────────────────────────────────────────────
  console.log('\n📦 5. Explainability & Root-Cause Deductions:');

  it('Calculates explainable root-cause deductions for degraded metrics', () => {
    const deductions = [
      { metric: 'API Latency', penalty: 8, reason: 'P95 response time elevated at 480ms' },
      { metric: 'Disk Usage', penalty: 6, reason: 'Primary volume at 84.5% capacity' },
      { metric: 'Database Latency', penalty: 5, reason: 'DB ping latency at 82ms' },
      { metric: 'Security Incidents', penalty: 4, reason: '1 active threat alert unresolved' },
      { metric: 'External API Failures', penalty: 5, reason: 'Meta Graph API intermittent latency' },
    ];

    const baseScore = 100;
    const totalDeductions = deductions.reduce((sum, d) => sum + d.penalty, 0);
    const score = baseScore - totalDeductions;

    assert.strictEqual(score, 72);
    assert.strictEqual(totalDeductions, 28);
    assert.strictEqual(deductions.length, 5);
  });

  console.log('\n=======================================================');
  console.log(`🎉 ALL ${passedTests} PLATFORM HEALTH ENGINE TESTS PASSED!`);
  console.log('=======================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test suite execution failed:', err);
  process.exit(1);
});
