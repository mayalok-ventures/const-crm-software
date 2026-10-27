/**
 * SYSTEM MONITORING & HEARTBEAT AUTOMATED TEST SUITE
 * Tests collectors, health score calculations, status transitions, and API routes.
 */

const axios = require('axios');
const mongoose = require('mongoose');

// We import the compiled modules for unit testing
// Since they transpile to the same folders, we load from there
const { CpuCollector } = require('../src/monitoring/collectors/CpuCollector');
const { MemoryCollector } = require('../src/monitoring/collectors/MemoryCollector');
const { DiskCollector } = require('../src/monitoring/collectors/DiskCollector');
const { NetworkCollector } = require('../src/monitoring/collectors/NetworkCollector');
const { ProcessCollector } = require('../src/monitoring/collectors/ProcessCollector');
const { SystemMetricsCollector } = require('../src/monitoring/collectors/SystemMetricsCollector');
const { HealthScoreCalculator } = require('../src/monitoring/HealthScoreCalculator');

const API_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('\n📊 ========================================================');
  console.log('      SYSTEM MONITORING & TELEMETRY TEST SUITE');
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
  // 1. UNIT TESTS: METRICS COLLECTORS
  // ─────────────────────────────────────────────────────────────
  console.log('🔹 1. Running Unit Tests on Collectors...');
  try {
    const cpuCollector = new CpuCollector();
    const cpuRes = cpuCollector.collect();
    assert(cpuRes.cores > 0, 'CpuCollector collects core count > 0');
    assert(cpuRes.usagePercent >= 0 && cpuRes.usagePercent <= 100, 'CpuCollector usage % is valid between 0-100');
    assert(Array.isArray(cpuRes.loadAvg), 'CpuCollector loadAvg is an array');

    const memoryCollector = new MemoryCollector();
    const memRes = memoryCollector.collect();
    assert(memRes.totalBytes > 0, 'MemoryCollector collects total bytes > 0');
    assert(memRes.freeBytes > 0, 'MemoryCollector collects free bytes > 0');
    assert(memRes.usedBytes === (memRes.totalBytes - memRes.freeBytes), 'MemoryCollector used memory arithmetic fits');
    assert(memRes.usagePercent >= 0 && memRes.usagePercent <= 100, 'MemoryCollector usage % is valid');

    const diskCollector = new DiskCollector();
    const diskRes = await diskCollector.collect();
    assert(diskRes.totalBytes > 0, 'DiskCollector collects total bytes > 0');
    assert(diskRes.freeBytes > 0, 'DiskCollector collects free bytes > 0');
    assert(diskRes.usagePercent >= 0 && diskRes.usagePercent <= 100, 'DiskCollector usage % is valid');

    const networkCollector = new NetworkCollector();
    const netRes = await networkCollector.collect();
    assert(netRes.uploadBytesSec >= 0, 'NetworkCollector collects upload rate >= 0');
    assert(netRes.downloadBytesSec >= 0, 'NetworkCollector collects download rate >= 0');

    const processCollector = new ProcessCollector();
    const procRes = processCollector.collect();
    assert(procRes.memoryBytes > 0, 'ProcessCollector collects process memory RSS > 0');
    assert(procRes.cpuPercent >= 0, 'ProcessCollector collects process CPU % >= 0');
    assert(['online', 'standalone'].includes(procRes.pm2Status), 'ProcessCollector retrieves valid PM2 status');

    const sysCollector = new SystemMetricsCollector();
    const sysRes = await sysCollector.collect();
    assert(sysRes.uptime > 0, 'SystemMetricsCollector collects uptime > 0');
    assert(typeof sysRes.hostname === 'string', 'SystemMetricsCollector collects hostname');
    assert(typeof sysRes.os === 'string', 'SystemMetricsCollector collects operating system metadata');
  } catch (err) {
    console.error('  ❌ Error running collector unit tests:', err.message);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. UNIT TESTS: HEALTH SCORE CALCULATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔹 2. Running Unit Tests on Health Score Calculations...');
  try {
    const calc = new HealthScoreCalculator();

    // Test resource score mapping bounds
    assert(calc.calculateResourceScore(10, { warning: 75, critical: 85, severe: 95 }) > 95, 'Healthy usage maps to high score');
    assert(calc.calculateResourceScore(80, { warning: 75, critical: 85, severe: 95 }) < 80, 'Warning usage maps to warning score');
    assert(calc.calculateResourceScore(98, { warning: 75, critical: 85, severe: 95 }) < 30, 'Severe usage maps to severe score');

    // Test overall score calculation
    const scores = calc.calculate({
      cpuUsage: 15,
      ramUsage: 30,
      diskUsage: 25,
      processCpu: 2,
      networkActive: true,
      uptimeSeconds: 3600
    });
    assert(scores.overall > 90, `Perfect system metrics overall score should be excellent (Calculated: ${scores.overall}%)`);
    assert(scores.cpu === 98, 'CPU health rating maps correctly');

    // Test custom weights normalization
    const customCalc = new HealthScoreCalculator({ cpu: 50, ram: 50, disk: 0, process: 0, uptime: 0, network: 0 });
    const customScores = customCalc.calculate({
      cpuUsage: 99, // severe cpu
      ramUsage: 10, // excellent ram
      diskUsage: 99,
      processCpu: 99,
      networkActive: false,
      uptimeSeconds: 3600
    });
    assert(customScores.overall >= 50 && customScores.overall <= 68, `Custom weights are normalized and respected (Calculated: ${customScores.overall}%)`);
  } catch (err) {
    console.error('  ❌ Error running health calculator unit tests:', err.message);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────
  // 3. INTEGRATION TESTS: REST API ENDPOINTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n🔹 3. Running REST API Integration Tests...');
  try {
    // A. Login as Admin
    console.log('   Logging in as superadmin...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      identifier: process.env.ADMIN_EMAIL || 'admin@yourapp.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123'
    });
    const token = loginRes.data.token;
    assert(token !== undefined, 'Admin login successfully retrieved JWT token');

    const headers = { Authorization: `Bearer ${token}` };

    // B. POST Heartbeat
    console.log('   Sending agent heartbeat payload...');
    const dummyServerId = 'test-server-999';
    const hbPayload = {
      serverId: dummyServerId,
      applicationId: 'use-setu-crm-test',
      environment: 'testing',
      timestamp: new Date(),
      agentVersion: 'v1.0.0-test',
      healthStatus: 'ONLINE',
      applicationVersion: 'v1.0.0-app'
    };
    const hbRes = await axios.post(`${API_URL}/monitoring/heartbeat`, hbPayload);
    assert(hbRes.data.success === true, 'Public heartbeat ingestion route accepted payload');
    assert(hbRes.data.latencyMs !== undefined, 'Heartbeat ingestion returns latency payload');

    // C. GET Registered Servers
    console.log('   Fetching servers registry...');
    const serversRes = await axios.get(`${API_URL}/admin/monitoring/servers`, { headers });
    assert(serversRes.data.success === true, 'Admin monitoring servers list retrieved successfully');
    const testServer = serversRes.data.servers.find(s => s.serverId === dummyServerId);
    assert(testServer !== undefined, 'Heartbeat self-registered server is visible in admin list');
    assert(testServer.status === 'ONLINE', 'Registered server status is ONLINE');
    assert(testServer.environment === 'testing', 'Registered environment is testing');

    // D. GET Server Details
    console.log('   Fetching server details...');
    const detailsRes = await axios.get(`${API_URL}/admin/monitoring/servers/${dummyServerId}`, { headers });
    assert(detailsRes.data.success === true, 'Server detail endpoint loads details');
    assert(detailsRes.data.server.serverId === dummyServerId, 'Server details ID matches');

    // E. GET Server Health breakdown
    console.log('   Fetching health score calculation breakdown...');
    const healthRes = await axios.get(`${API_URL}/admin/servers/${dummyServerId}/health`, { headers });
    assert(healthRes.data.success === true, 'Server health breakdown endpoint resolved');
    assert(healthRes.data.health.healthScore !== undefined, 'Server health returns computed health score');

    // F. GET Server status transition events
    console.log('   Fetching status transition log...');
    const statusEventsRes = await axios.get(`${API_URL}/admin/servers/${dummyServerId}/status-events`, { headers });
    assert(statusEventsRes.data.success === true, 'Server status-events logs retrieved');
    assert(Array.isArray(statusEventsRes.data.events), 'Server status-events is an array');

    // G. GET API Performance Snapshot
    console.log('   Fetching system-wide API performance data...');
    const perfRes = await axios.get(`${API_URL}/admin/monitoring/api-performance?range=1h`, { headers });
    assert(perfRes.data.success === true, 'API Performance dashboard snapshot endpoint resolved');
    assert(perfRes.data.performance.snapshot !== undefined, 'API performance snapshot statistics are visible');
    assert(Array.isArray(perfRes.data.performance.endpoints), 'Endpoint performance logs array is visible');

  } catch (err) {
    console.error('  ❌ REST API integration test failure:', err.response ? err.response.data : err.message);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────
  // TEST REPORT
  // ─────────────────────────────────────────────────────────────
  console.log('\n========================================================');
  console.log(`📊 TEST SUITE SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run the tests
runTests();
