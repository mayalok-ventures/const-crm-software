/**
 * Master Test Runner for Backend Integrations and CRM Workflows
 */

const { spawn } = require('child_process');
const path = require('path');

const testFiles = [
  'tests/hybrid_catalogue.test.js',
  'tests/education_subprofile.test.js',
  'tests/multi_tenant_isolation.test.js',
  'tests/integration_architecture_audit.test.js',
  'tests/tenant_workflow_phases.test.js',
  'tests/crm_admin.test.js',
  'tests/e2e_lead_lifecycle.test.js',
];

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

  for (const testFile of testFiles) {
    try {
      await runTest(testFile);
    } catch (err) {
      console.error(`\n❌ Execution failed on ${testFile}:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n========================================================');
  console.log('🎉 ALL INTEGRATION & CRM SUITES PASSED SUCCESSFULLY!');
  console.log('========================================================\n');
  process.exit(0);
}

main();
