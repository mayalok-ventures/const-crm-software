/**
 * Master Test Runner for Backend Integrations and CRM Workflows
 * Supports Category-based execution, Safety Guards, and Orphan Test Detection.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { assertTestSafety } = require('./safetyGuard');

// Force test environment and enforce database safety
assertTestSafety();

const MANIFEST_PATH = path.resolve(__dirname, 'test-manifest.json');

async function runSingleSuite(suiteName, options = {}) {
  const fullPath = path.resolve(__dirname, suiteName);
  const timeoutMs = options.timeoutMs || 45000;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const child = spawn('node', [fullPath], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ...(options.env || {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2000);
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({
        suite: suiteName,
        code: timedOut ? 124 : (code ?? 1),
        durationMs,
        stdout,
        stderr: timedOut ? `Test timed out after ${timeoutMs}ms\n` + stderr : stderr,
        timedOut,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({
        suite: suiteName,
        code: 1,
        durationMs,
        stdout,
        stderr: err.message,
        timedOut: false,
      });
    });
  });
}

function discoverTestFiles() {
  const files = fs.readdirSync(__dirname);
  return files.filter(
    (f) =>
      (f.endsWith('.test.js') || (f.startsWith('test_') && f.endsWith('.js'))) &&
      f !== 'run_all_integration_tests.js' &&
      f !== 'run_audit_suites.js'
  );
}

async function main() {
  console.log('='.repeat(75));
  console.log('🛡️  CRM INTEGRATION & REGRESSION TEST RUNNER');
  console.log('='.repeat(75));

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('❌ [FATAL] Test manifest not found at:', MANIFEST_PATH);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const catalogedSuites = manifest.suites || {};

  // 1. Detect orphaned / unlisted test files
  const discoveredFiles = discoverTestFiles();
  const unlistedFiles = discoveredFiles.filter((f) => !catalogedSuites[f]);

  if (unlistedFiles.length > 0) {
    console.error('\n❌ [ORPHAN TEST ERROR] The following test files exist on disk but are not cataloged in test-manifest.json:');
    unlistedFiles.forEach((f) => console.error(`   - ${f}`));
    console.error('\nEvery test file must be registered in backend/tests/test-manifest.json with a valid category.\n');
    process.exit(1);
  }

  // 2. Parse target categories
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const isBatchOnly = args.includes('--batch');
  const isCoreOnly = args.includes('--core');
  const includeQuarantined = args.includes('--include-quarantined');
  const singleFile = args.find((a) => !a.startsWith('--'));

  let targetSuites = [];

  if (singleFile) {
    const baseName = path.basename(singleFile);
    if (!catalogedSuites[baseName]) {
      console.error(`❌ [ERROR] Specified test file "${baseName}" is not registered in test-manifest.json`);
      process.exit(1);
    }
    targetSuites = [baseName];
  } else if (isBatchOnly) {
    targetSuites = Object.keys(catalogedSuites).filter((k) => catalogedSuites[k].category === 'batch-suites');
  } else if (isCoreOnly) {
    targetSuites = Object.keys(catalogedSuites).filter((k) => catalogedSuites[k].category === 'core');
  } else if (isAll) {
    targetSuites = Object.keys(catalogedSuites).filter((k) => {
      const cat = catalogedSuites[k].category;
      if (cat === 'needs-external-service') return false;
      if (cat === 'quarantined' && !includeQuarantined) return false;
      return true;
    });
  } else {
    // Default: run all batch suites and core suites
    targetSuites = Object.keys(catalogedSuites).filter((k) => {
      const cat = catalogedSuites[k].category;
      return cat === 'batch-suites' || cat === 'core';
    });
  }

  console.log(`\n📋 Target suites to execute: ${targetSuites.length}`);
  console.log(`   (Filter: ${isBatchOnly ? 'batch-suites' : isCoreOnly ? 'core' : isAll ? 'all active' : 'batch-suites + core'})\n`);

  let totalPassed = 0;
  let totalFailed = 0;
  let quarantinedFailures = 0;
  const overallStart = Date.now();

  for (let i = 0; i < targetSuites.length; i++) {
    const suiteName = targetSuites[i];
    const meta = catalogedSuites[suiteName] || { category: 'unknown', reason: '' };
    const prefix = `[${i + 1}/${targetSuites.length}] ${suiteName}`.padEnd(55);
    process.stdout.write(`▶️  ${prefix} ... `);

    const res = await runSingleSuite(suiteName);

    if (res.code === 0) {
      console.log(`✅ PASS (${res.durationMs}ms)`);
      totalPassed++;
    } else {
      if (meta.category === 'quarantined') {
        console.log(`⚠️  QUARANTINED FAIL (${res.durationMs}ms) [Ignored: ${meta.reason}]`);
        quarantinedFailures++;
      } else {
        console.log(`❌ FAIL (${res.durationMs}ms)`);
        totalFailed++;
        if (res.stderr) console.error(res.stderr.trim().split('\n').slice(0, 5).join('\n'));
        else if (res.stdout) console.log(res.stdout.trim().split('\n').slice(0, 5).join('\n'));
      }
    }
  }

  const durationSec = ((Date.now() - overallStart) / 1000).toFixed(2);
  console.log('\n' + '='.repeat(75));
  console.log(`SUMMARY: ${totalPassed} Passed, ${totalFailed} Failed, ${quarantinedFailures} Quarantined in ${durationSec}s`);
  console.log('='.repeat(75));

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  });
}

module.exports = {
  runSingleSuite,
  discoverTestFiles,
  assertTestSafety,
};
