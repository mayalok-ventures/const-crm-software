const { spawn } = require('child_process');
const path = require('path');

const BATCH_1_SUITES = [
  'tests/lead_status_won_flow.test.js',
  'tests/meta_webhook_security.test.js',
  'tests/auth_2fa_hardening.test.js',
  'tests/admin_payment_requests_pagination.test.js',
  'tests/auth_token_extraction.test.js',
  'tests/tenant_isolation_leads.test.js',
  'tests/recording_workspace_isolation.test.js',
  'tests/lead_tenant_resolution_perf.test.js',
  'tests/payment_dual_field_sync.test.js',
  'tests/lead_soft_delete_and_cascade.test.js',
  'tests/transaction_rollback.test.js',
];

const BATCH_2_SUITES = [
  'tests/lead_payment_idempotency.test.js',
  'tests/lead_soft_delete_partial_index.test.js',
  'tests/lead_presave_tenant_fix.test.js',
  'tests/tenant_fail_closed.test.js',
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
      });
    });

    child.on('error', (err) => {
      const durationMs = Date.now() - startTime;
      resolve({
        suite: suitePath,
        code: 1,
        durationMs,
        stdout,
        stderr: err.message,
      });
    });
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('CRM AUDIT SUITES VERIFICATION RUNNER');
  console.log('='.repeat(70));

  const allSuites = [
    { group: 'BATCH 1 SUITES (11)', list: BATCH_1_SUITES },
    { group: 'BATCH 2 SUITES (18)', list: BATCH_2_SUITES },
  ];

  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;
  const overallStart = Date.now();

  for (const { group, list } of allSuites) {
    console.log(`\n--- ${group} ---`);
    for (const suite of list) {
      process.stdout.write(`Running ${suite.padEnd(50)} ... `);
      const res = await runSingleSuite(suite);
      results.push(res);

      if (res.code === 0) {
        console.log(`✅ PASS (${res.durationMs}ms)`);
        totalPassed++;
      } else {
        console.log(`❌ FAIL (${res.durationMs}ms)`);
        totalFailed++;
        if (res.stderr) console.error(res.stderr.trim());
        else if (res.stdout) console.log(res.stdout.trim());
      }
    }
  }

  const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(2);
  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${totalPassed} passed, ${totalFailed} failed in ${overallDuration}s`);
  console.log('='.repeat(70));

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
