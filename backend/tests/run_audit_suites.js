const { spawn } = require('child_process');
const path = require('path');

const BATCH_1_SUITES = [
  'tests/tenant_isolation.test.js',
  'tests/lead_soft_delete_and_cascade.test.js',
  'tests/auth_rate_limiting.test.js',
  'tests/payment_webhook_idempotency.test.js',
  'tests/pipeline_ownership.test.js',
  'tests/meta_webhook_resilience.test.js',
  'tests/google_sheets_sync_integrity.test.js',
  'tests/lead_phone_indexing.test.js',
];

const BATCH_2_SUITES = [
  'tests/lead_payment_idempotency.test.js',
  'tests/lead_soft_delete_partial_index.test.js',
  'tests/lead_presave_tenant_fix.test.js',
  'tests/tenant_fail_closed.test.js',
  'tests/admin_payment_requests_pagination.test.js',
  'tests/deals_counselor_search.test.js',
  'tests/followup_postpone_validation.test.js',
  'tests/coupon_atomic_redemption.test.js',
  'tests/pipeline_remap_status_integrity.test.js',
  'tests/lead_stage_status_sync.test.js',
  'tests/assignment_max_active_leads.test.js',
  'tests/cache_capacity_and_eviction.test.js',
  'tests/uncaught_exception_resilience.test.js',
  'tests/followup_cron_lookback_cap.test.js',
  'tests/distributed_lock.test.js',
  'tests/whatsapp_distributed_lease.test.js',
  'tests/agent_performance_n_plus_one.test.js',
  'tests/leads_pagination_tiebreaker.test.js',
  'tests/pdf_export_event_loop.test.js',
];

async function runSingleSuite(suitePath) {
  const fullPath = path.resolve(__dirname, '..', suitePath);
  const startTime = Date.now();

  return new Promise((resolve) => {
    const child = spawn('node', [fullPath], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      resolve({
        suite: suitePath,
        code,
        durationMs,
        stdout,
        stderr,
        passed: code === 0,
      });
    });
  });
}

async function runAll() {
  console.log('====================================================');
  console.log('🚀 RUNNING ALL AUDIT SUITES (BATCH 1 & BATCH 2)');
  console.log('====================================================\n');

  const allSuites = [...BATCH_1_SUITES, ...BATCH_2_SUITES];
  const results = [];

  for (const suite of allSuites) {
    process.stdout.write(`Running ${suite.padEnd(52, ' ')} ... `);
    const res = await runSingleSuite(suite);
    results.push(res);

    if (res.passed) {
      console.log(`✅ PASS (${res.durationMs}ms)`);
    } else {
      console.log(`❌ FAIL (${res.durationMs}ms)`);
      if (res.stderr) console.error(res.stderr.slice(0, 500));
      else if (res.stdout) console.error(res.stdout.slice(-500));
    }
  }

  console.log('\n====================================================');
  console.log('📊 SUMMARY TABLE');
  console.log('====================================================');

  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    if (r.passed) passedCount++;
    else failedCount++;
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${r.suite.padEnd(50, ' ')} | ${r.durationMs}ms`);
  }

  console.log('====================================================');
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});

