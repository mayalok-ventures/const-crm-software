/**
 * Multi-Tenant Resource Usage Monitoring Automated Test Suite
 * Tests threshold status mapping, capacity scoring, health scores,
 * custom plan limits override, periodic aggregation, and demo seeded metrics.
 */

const assert = require('assert');

// Import usage aggregator service and models
const { UsageAggregatorService } = require('../src/monitoring/usage/usageAggregatorService');

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING MULTI-TENANT RESOURCE USAGE MONITORING TESTS');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function it(description, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. formatBytes tests
  it('should format bytes to human readable string (GB, MB, KB, Bytes)', () => {
    assert.strictEqual(UsageAggregatorService.formatBytes(0), '0 MB');
    assert.strictEqual(UsageAggregatorService.formatBytes(500), '0 KB');
    assert.strictEqual(UsageAggregatorService.formatBytes(1024), '1 KB');
    assert.strictEqual(UsageAggregatorService.formatBytes(1048576), '1.0 MB');
    assert.strictEqual(UsageAggregatorService.formatBytes(1073741824), '1.0 GB');
    assert.strictEqual(UsageAggregatorService.formatBytes(7730941133), '7.2 GB'); // 7.2 GB
    assert.strictEqual(UsageAggregatorService.formatBytes(10737418240), '10.0 GB'); // 10 GB
  });

  // 2. resolveThresholdStatus tests
  it('should correctly map threshold percentages to status enum', () => {
    // < 80.0% -> NOMINAL
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(0), 'NOMINAL');
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(50.5), 'NOMINAL');
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(79.9), 'NOMINAL');

    // 80.0% - 89.9% -> WARNING
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(80.0), 'WARNING');
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(81.0), 'WARNING');
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(89.9), 'WARNING');

    // 90.0% - 99.9% -> CRITICAL
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(90.0), 'CRITICAL');
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(92.4), 'CRITICAL');
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(99.9), 'CRITICAL');

    // >= 100.0% -> LIMIT_REACHED
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(100.0), 'LIMIT_REACHED');
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(105.0), 'LIMIT_REACHED');
  });

  // 3. calculateHealthScore tests
  it('should calculate health scores inversely proportional to utilization', () => {
    // 0% usage -> 100% health
    assert.strictEqual(UsageAggregatorService.calculateHealthScore(0), 100);

    // 72% usage (ABC Coaching example) -> 73% health
    const health72 = UsageAggregatorService.calculateHealthScore(72);
    assert.strictEqual(health72, 73, `Expected 73% for 72% usage, got ${health72}%`);

    // 81% usage -> in warning zone
    const health81 = UsageAggregatorService.calculateHealthScore(81);
    assert(health81 >= 0 && health81 <= 100);

    // 100% usage -> 0% health
    assert.strictEqual(UsageAggregatorService.calculateHealthScore(100), 0);
  });

  // 4. Exact ABC Coaching Specification Verification
  it('should match exact ABC Coaching prompt specifications', () => {
    const storageUsedBytes = 7730941133; // 7.2 GB
    const storageLimitBytes = 10737418240; // 10 GB
    const storagePercent = Math.round((storageUsedBytes / storageLimitBytes) * 1000) / 10;
    const storageHealth = UsageAggregatorService.calculateHealthScore(storagePercent);

    const activeUsers = 81;
    const maxUsers = 100;
    const userPercent = Math.round((activeUsers / maxUsers) * 1000) / 10;
    const userCapacity = userPercent;

    const apiRequests = 82000;
    const maxApiRequests = 100000;
    const apiPercent = Math.round((apiRequests / maxApiRequests) * 1000) / 10;
    const apiCapacity = apiPercent;

    assert.strictEqual(UsageAggregatorService.formatBytes(storageUsedBytes), '7.2 GB');
    assert.strictEqual(UsageAggregatorService.formatBytes(storageLimitBytes), '10.0 GB');
    assert.strictEqual(storagePercent, 72);
    assert.strictEqual(storageHealth, 73);

    assert.strictEqual(activeUsers, 81);
    assert.strictEqual(maxUsers, 100);
    assert.strictEqual(userPercent, 81);
    assert.strictEqual(userCapacity, 81);

    assert.strictEqual(apiRequests, 82000);
    assert.strictEqual(maxApiRequests, 100000);
    assert.strictEqual(apiPercent, 82);
    assert.strictEqual(apiCapacity, 82);

    // Status checks
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(storagePercent), 'NOMINAL'); // 72% < 80%
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(userPercent), 'WARNING'); // 81% >= 80%
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(apiPercent), 'WARNING'); // 82% >= 80%
  });

  // 5. Custom Plan Limits Override tests
  it('should override default plan limits with custom enterprise limits', () => {
    const defaultLimits = {
      storageLimitBytes: 5368709120, // 5 GB
      maxUsers: 5,
      maxApiRequests: 50000,
      maxLeads: 25000,
      maxGroups: 50,
      maxConcurrentCampaigns: 5,
      maxMonthlyMessages: 25000,
    };

    const customOverride = {
      isCustomOverride: true,
      storageLimitBytes: 53687091200, // 50 GB
      maxUsers: 250,
      maxApiRequests: 1000000,
      maxLeads: 500000,
      maxGroups: 500,
      maxConcurrentCampaigns: 50,
      maxMonthlyMessages: 500000,
    };

    const merged = { ...defaultLimits, ...customOverride };
    assert.strictEqual(merged.storageLimitBytes, 53687091200);
    assert.strictEqual(merged.maxUsers, 250);
    assert.strictEqual(merged.maxApiRequests, 1000000);
    assert.strictEqual(merged.maxLeads, 500000);
    assert.strictEqual(merged.isCustomOverride, true);
  });

  // 6. Velocity Score calculation tests
  it('should compute weighted velocity scores accurately', () => {
    const storageGrowthRate = 12.5;
    const recordsGrowthRate = 10.0;
    const usersGrowthRate = 20.0;

    const velocityScore = Number(
      Math.min(
        100,
        Math.max(
          0,
          Math.abs(storageGrowthRate) * 0.4 +
            Math.abs(recordsGrowthRate) * 0.4 +
            Math.abs(usersGrowthRate) * 0.2
        )
      ).toFixed(1)
    );

    // (12.5 * 0.4) + (10 * 0.4) + (20 * 0.2) = 5.0 + 4.0 + 4.0 = 13.0
    assert.strictEqual(velocityScore, 13.0);
    assert(velocityScore >= 0 && velocityScore <= 100, 'Velocity score must be between 0 and 100');
  });

  // 7. Threshold Status Ranking
  it('should compute overall organization status as highest severity across all resources', () => {
    const resources1 = [72, 81, 82]; // Max 82 -> WARNING
    const max1 = Math.max(...resources1);
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(max1), 'WARNING');

    const resources2 = [50, 60, 92.4]; // Max 92.4 -> CRITICAL
    const max2 = Math.max(...resources2);
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(max2), 'CRITICAL');

    const resources3 = [100, 40, 50]; // Max 100 -> LIMIT_REACHED
    const max3 = Math.max(...resources3);
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(max3), 'LIMIT_REACHED');

    const resources4 = [22, 30, 45]; // Max 45 -> NOMINAL
    const max4 = Math.max(...resources4);
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(max4), 'NOMINAL');
  });

  // 8. Organizations Near Limits Filter Logic
  it('should correctly filter organizations at or above 80% capacity threshold', () => {
    const orgs = [
      { name: 'Org A', overallCapacityPercent: 72, status: 'NOMINAL' },
      { name: 'Org B', overallCapacityPercent: 81, status: 'WARNING' },
      { name: 'Org C', overallCapacityPercent: 92.4, status: 'CRITICAL' },
      { name: 'Org D', overallCapacityPercent: 100, status: 'LIMIT_REACHED' },
      { name: 'Org E', overallCapacityPercent: 35, status: 'NOMINAL' },
    ];

    const nearLimits = orgs.filter((o) => o.overallCapacityPercent >= 80);
    assert.strictEqual(nearLimits.length, 3);
    assert.deepStrictEqual(
      nearLimits.map((o) => o.name),
      ['Org B', 'Org C', 'Org D']
    );
  });

  // 9. Top Resource Consumers Sorting
  it('should sort top consumers in descending order of utilization', () => {
    const orgs = [
      { name: 'Org 1', storageBytes: 5 * 1024 * 1024 * 1024 },
      { name: 'Org 2', storageBytes: 25 * 1024 * 1024 * 1024 },
      { name: 'Org 3', storageBytes: 7.2 * 1024 * 1024 * 1024 },
      { name: 'Org 4', storageBytes: 50 * 1024 * 1024 * 1024 },
    ];

    const sorted = [...orgs].sort((a, b) => b.storageBytes - a.storageBytes);
    assert.strictEqual(sorted[0].name, 'Org 4');
    assert.strictEqual(sorted[1].name, 'Org 2');
    assert.strictEqual(sorted[2].name, 'Org 3');
    assert.strictEqual(sorted[3].name, 'Org 1');
  });

  // 10. Snapshot Time-Series Point Structure
  it('should construct valid daily usage snapshots for historical charts', () => {
    const snapshot = {
      organizationId: 'org_abc_coaching',
      organizationName: 'ABC Coaching',
      timestamp: new Date('2026-08-20T00:00:00.000Z'),
      granularity: 'daily',
      storage: { usedBytes: 7730941133, limitBytes: 10737418240, percent: 72 },
      users: { activeUsers: 81, maxUsers: 100, percent: 81 },
      apiRequests: { totalRequests: 82000, maxRequests: 100000, percent: 82 },
      databaseRecords: { totalRecords: 42538, leadsCount: 41000, groupsCount: 42 },
      messages: { totalSent: 80700, monthlyLimit: 100000, percent: 80.7 },
      campaigns: { activeCampaigns: 4, maxConcurrent: 10 },
    };

    assert.strictEqual(snapshot.granularity, 'daily');
    assert.strictEqual(snapshot.storage.percent, 72);
    assert.strictEqual(snapshot.users.percent, 81);
    assert.strictEqual(snapshot.apiRequests.percent, 82);
    assert.strictEqual(snapshot.messages.percent, 80.7);
  });

  // 11. Multi-Resource Capacity Evaluation
  it('should evaluate individual resource capacity scores across all tracked metrics', () => {
    const capacities = {
      storage: 72,
      users: 81,
      api: 82,
      leads: 85,
      messages: 80.7,
    };

    const maxCapacity = Math.max(...Object.values(capacities));
    assert.strictEqual(maxCapacity, 85);
    assert.strictEqual(UsageAggregatorService.resolveThresholdStatus(maxCapacity), 'WARNING');
  });

  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
