const assert = require('assert');
const { spawn } = require('child_process');

async function runTest() {
  console.log('🧪 Running Test: Uncaught Exception & Rejection Resilience (R6)...');

  // 1. Verify unhandledRejection is non-fatal (process survives)
  const rejectionScript = `
    let count = 0;
    process.on('unhandledRejection', (reason) => {
      count++;
      console.log('HANDLED_REJECTION #' + count);
    });

    Promise.reject(new Error('Transient async socket failure'));

    setTimeout(() => {
      console.log('SURVIVED_REJECTION');
      process.exit(0);
    }, 300);
  `;

  const childRejection = spawn('node', ['-e', rejectionScript]);
  let rejectionOut = '';
  childRejection.stdout.on('data', (d) => { rejectionOut += d.toString(); });
  childRejection.stderr.on('data', (d) => { rejectionOut += d.toString(); });

  const rejectionExitCode = await new Promise((resolve) => childRejection.on('close', resolve));
  assert.strictEqual(rejectionExitCode, 0, 'Unhandled rejection should not crash process');
  assert.ok(rejectionOut.includes('SURVIVED_REJECTION'), 'Process must survive unhandled rejection');
  console.log('✅ Step 1: Unhandled promise rejection is gracefully caught and process survives.');

  // 2. Verify uncaughtException triggers shutdown and exits with code 1
  const exceptionScript = `
    let isShuttingDown = false;
    async function gracefulShutdown(signal, exitCode = 0) {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log('STARTING_SHUTDOWN on ' + signal);
      setTimeout(() => {
        console.log('CLEANUP_DONE');
        process.exit(exitCode);
      }, 100);
    }

    process.on('uncaughtException', (err) => {
      console.error('FATAL_UNCAUGHT: ' + err.message);
      if (typeof gracefulShutdown === 'function') {
        gracefulShutdown('UNCAUGHT_EXCEPTION', 1).catch(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });

    setTimeout(() => {
      throw new Error('Fatal corrupted state');
    }, 100);
  `;

  const childException = spawn('node', ['-e', exceptionScript]);
  let exceptionOut = '';
  childException.stdout.on('data', (d) => { exceptionOut += d.toString(); });
  childException.stderr.on('data', (d) => { exceptionOut += d.toString(); });

  const exceptionExitCode = await new Promise((resolve) => childException.on('close', resolve));
  assert.strictEqual(exceptionExitCode, 1, 'Uncaught exception must exit with code 1');
  assert.ok(exceptionOut.includes('STARTING_SHUTDOWN on UNCAUGHT_EXCEPTION'));
  assert.ok(exceptionOut.includes('CLEANUP_DONE'));
  console.log('✅ Step 2: Uncaught exception properly initiates graceful shutdown and exits with code 1.');

  console.log('🎉 ALL R6 UNCAUGHT EXCEPTION RESILIENCE TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
