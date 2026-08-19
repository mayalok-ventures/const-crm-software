/**
 * Master Test Runner for Backend Integrations and CRM Workflows
 */

const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');

const testFiles = [
  'tests/event_management_vertical.test.js',
  'tests/education_automations.test.js',
  'tests/hybrid_catalogue.test.js',
  'tests/education_subprofile.test.js',
  'tests/multi_tenant_isolation.test.js',
  'tests/integration_architecture_audit.test.js',
  'tests/tenant_workflow_phases.test.js',
  'tests/crm_admin.test.js',
  'tests/e2e_lead_lifecycle.test.js',
  'tests/followup_workflow.test.js',
];

async function isServerRunning() {
  try {
    await axios.get('http://localhost:5000/api/admin/health', { timeout: 1500 });
    return true;
  } catch (err) {
    if (err.response) return true; // Server replied with 401/404/etc, so it's running
    return false;
  }
}

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isServerRunning()) return true;
    await new Promise(r => setTimeout(r, 800));
  }
  return false;
}

async function runTest(file) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶️  RUNNING: ${file}\n`);
    const proc = spawn('node', [file], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test file ${file} failed with exit code ${code}`));
      }
    });
  });
}

async function main() {
  console.log('🚀 Starting CRM Test Runner across all integration test suites...\n');

  let serverProc = null;
  const running = await isServerRunning();

  if (!running) {
    console.log('⚡ Launching embedded backend test server on port 5000...');
    serverProc = spawn('node', ['server.js'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      env: { ...process.env, PORT: '5000' }
    });

    serverProc.stdout.on('data', d => {
      const msg = d.toString();
      if (msg.includes('Server running') || msg.includes('MongoDB Connected')) {
        // console.log(`[server] ${msg.trim()}`);
      }
    });

    const ready = await waitForServer();
    if (!ready) {
      console.error('❌ Failed to start test backend server on port 5000');
      if (serverProc) serverProc.kill();
      process.exit(1);
    }
    console.log('✅ Test server is up and responsive on http://localhost:5000\n');
  }

  let failedAny = false;

  for (const testFile of testFiles) {
    try {
      await runTest(testFile);
    } catch (err) {
      console.error(`\n❌ Execution failed on ${testFile}:`, err.message);
      failedAny = true;
      break;
    }
  }

  if (serverProc) {
    console.log('\n🧹 Stopping embedded test server...');
    serverProc.kill();
  }

  if (failedAny) {
    process.exit(1);
  }

  console.log('\n========================================================');
  console.log('🎉 ALL 10 INTEGRATION & CRM SUITES PASSED SUCCESSFULLY!');
  console.log('========================================================\n');
  process.exit(0);
}

main();

