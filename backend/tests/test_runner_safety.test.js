const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const { assertTestSafety } = require('./safetyGuard');

async function runTest() {
  console.log('🧪 Running Test: Test Runner Safety Guard & Manifest Verification (T1)...');

  // 1. Safety Guard: Remote MongoDB Atlas URI must be strictly rejected
  assert.throws(
    () => {
      assertTestSafety({
        MONGODB_URI: 'mongodb+srv://dbadmin:SecretPassword123@cluster0.abcde.mongodb.net/crm_prod?retryWrites=true&w=majority',
      });
    },
    /ERR_UNSAFE_REMOTE_TEST_DB/,
    'Safety guard must throw ERR_UNSAFE_REMOTE_TEST_DB when given a remote MongoDB Atlas URI'
  );
  console.log('✅ Step 1: Safety guard strictly refused remote Atlas cluster URI.');

  // 2. Safety Guard: Remote cloud host (e.g. Render, AWS) must be rejected
  assert.throws(
    () => {
      assertTestSafety({
        MONGODB_URI: 'mongodb://admin:pass@dpg-c123456.oregon-postgres.render.com/crm',
      });
    },
    /ERR_UNSAFE_REMOTE_TEST_DB/,
    'Safety guard must throw when given a remote render.com host'
  );
  console.log('✅ Step 2: Safety guard strictly refused cloud deployment database host.');

  // 3. Safety Guard: Localhost and 127.0.0.1 must be allowed
  assert.doesNotThrow(() => {
    assertTestSafety({
      MONGODB_URI: 'mongodb://127.0.0.1:27017/crm_local_test',
    });
  }, 'Localhost 127.0.0.1 must be permitted');

  assert.doesNotThrow(() => {
    assertTestSafety({
      MONGODB_URI: 'mongodb://localhost:27017/crm_local_test',
    });
  }, 'Localhost name must be permitted');
  console.log('✅ Step 3: Localhost and 127.0.0.1 URIs permitted cleanly.');

  // 4. Safety Guard: Explicit ALLOW_NON_LOCAL_TEST_DB=1 permits override with warning
  assert.doesNotThrow(() => {
    assertTestSafety({
      MONGODB_URI: 'mongodb+srv://user:pass@staging.mongodb.net/crm',
      ALLOW_NON_LOCAL_TEST_DB: '1',
    });
  }, 'Explicit ALLOW_NON_LOCAL_TEST_DB=1 must permit override');
  console.log('✅ Step 4: ALLOW_NON_LOCAL_TEST_DB=1 successfully permits intentional override.');

  // 5. Runner Detection: Running the runner with an unlisted test file must fail
  // We simulate by creating a dummy file, running the runner, and asserting exit code !== 0
  const fs = require('fs');
  const dummyOrphanPath = path.resolve(__dirname, 'temp_unlisted_dummy.test.js');
  fs.writeFileSync(dummyOrphanPath, '// Temporary unlisted dummy test\nprocess.exit(0);\n');

  try {
    const runnerRes = spawnSync('node', [path.resolve(__dirname, 'run_all_integration_tests.js')], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'test' },
      encoding: 'utf8',
    });

    assert.notStrictEqual(runnerRes.status, 0, 'Runner must fail when unlisted test file exists');
    assert.ok(
      runnerRes.stderr.includes('ORPHAN TEST ERROR') || runnerRes.stdout.includes('ORPHAN TEST ERROR'),
      'Runner must report ORPHAN TEST ERROR'
    );
    console.log('✅ Step 5: Master test runner successfully detected orphaned test file and failed closed.');
  } finally {
    if (fs.existsSync(dummyOrphanPath)) {
      fs.unlinkSync(dummyOrphanPath);
    }
  }

  console.log('🎉 ALL T1 TEST RUNNER SAFETY & MANIFEST TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
