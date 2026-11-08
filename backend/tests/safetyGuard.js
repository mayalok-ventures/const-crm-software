/**
 * Test Safety Guard
 * Prevents test suites or test runner from executing against live/production databases.
 */

function assertTestSafety(env = process.env) {
  const uri = env.MONGODB_URI || env.MONGO_URI || '';
  const allowRemote = env.ALLOW_NON_LOCAL_TEST_DB === '1' || env.ALLOW_NON_LOCAL_TEST_DB === 'true';

  // Force test environment
  process.env.NODE_ENV = 'test';

  if (!uri) {
    // If no URI provided, child processes or tests will spawn their own in-memory instance
    return;
  }

  if (allowRemote) {
    console.warn('⚠️ [SAFETY GUARD WARNING] Running tests against non-local DB because ALLOW_NON_LOCAL_TEST_DB=1 is set.');
    return;
  }

  const normalized = uri.toLowerCase();
  const isLocal =
    normalized.includes('127.0.0.1') ||
    normalized.includes('localhost') ||
    normalized.includes('memory-server');

  const isRemoteHost =
    normalized.includes('mongodb.net') ||
    normalized.includes('onrender.com') ||
    normalized.includes('render.com') ||
    normalized.includes('aws') ||
    normalized.includes('azure') ||
    normalized.includes('digitalocean') ||
    normalized.includes('cleardb') ||
    normalized.includes('mongohq') ||
    normalized.includes('catalystappsail');

  if (!isLocal || isRemoteHost) {
    const sanitized = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
    const err = new Error(
      `🚨 [ERR_UNSAFE_REMOTE_TEST_DB] Test runner refused to run against non-local database: ${sanitized}.\n` +
      `Integration tests must run against mongodb-memory-server or local MongoDB (127.0.0.1 / localhost).\n` +
      `To override this protection explicitly, set ALLOW_NON_LOCAL_TEST_DB=1.`
    );
    err.code = 'ERR_UNSAFE_REMOTE_TEST_DB';
    throw err;
  }
}

module.exports = {
  assertTestSafety,
};
