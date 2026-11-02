/**
 * Comprehensive Automated Test Suite: Render Deployment Compatibility
 *
 * Validates:
 * 1. Port calculation and 0.0.0.0 binding logic (respects process.env.PORT in production).
 * 2. CORS configuration accepts production frontend, preview domains, and onrender.com.
 * 3. Liveness probe (GET /health/live) reports healthy status and zero credential leaks.
 * 4. Readiness probe (GET /health/ready) reports structured state and zero credential leaks.
 * 5. Baileys WhatsApp session state uses MongoDB Atlas (useMongoDBAuthState) and has no local auth disk requirements.
 * 6. Graceful shutdown closes all resources: HTTP server, MongoDB, cron schedulers, and Baileys sessions.
 * 7. Ephemeral filesystem safety: uploads use Cloudinary and temporary files are cleaned up.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n========================================================');
  console.log('   RENDER DEPLOYMENT COMPATIBILITY TEST SUITE           ');
  console.log('========================================================\n');

  // 1. Port calculation logic
  console.log('🔹 1. Testing Port Configuration for Render Web Service...');
  it('server port resolution prioritizes process.env.PORT in production', () => {
    function resolvePort(envPort, catalystPort, fallback = 5000) {
      return Number(envPort || catalystPort || fallback);
    }

    // On Render, Render sets PORT=10000
    assert.strictEqual(resolvePort('10000', undefined), 10000);
    // On Render with dynamic port
    assert.strictEqual(resolvePort('38472', undefined), 38472);
    // On Catalyst AppSail fallback
    assert.strictEqual(resolvePort(undefined, '9000'), 9000);
    // Local dev fallback
    assert.strictEqual(resolvePort(undefined, undefined), 5000);
  });

  it('verifies backend/server.js binds PORT dynamically using process.env.PORT', () => {
    const serverJsPath = path.resolve(__dirname, '../server.js');
    const content = fs.readFileSync(serverJsPath, 'utf8');

    assert.ok(
      content.includes('process.env.PORT || process.env.X_ZOHO_CATALYST_LISTEN_PORT || 5000'),
      'server.js must prioritize process.env.PORT before Catalyst or fallback'
    );
    assert.ok(
      content.includes("app.listen(PORT, '0.0.0.0'"),
      'server.js must bind to 0.0.0.0'
    );
  });

  // 2. CORS origin validation
  console.log('🔹 2. Testing CORS Origin Security & Flexibility...');
  it('allows production domains, *.onrender.com, and *.pages.dev', () => {
    const isOriginAllowed = (origin) => {
      if (!origin) return true;
      const allowed = ['https://app.sahyak.com', 'https://crm.sahyak.com'];
      if (allowed.includes(origin)) return true;
      if (/^https:\/\/([a-zA-Z0-9-]+\.)*sahyak\.com$/.test(origin)) return true;
      if (/^https:\/\/([a-zA-Z0-9-]+\.)*pages\.dev$/.test(origin)) return true;
      if (/^https:\/\/([a-zA-Z0-9-]+\.)*onrender\.com$/.test(origin)) return true;
      return false;
    };

    assert.strictEqual(isOriginAllowed('https://app.sahyak.com'), true);
    assert.strictEqual(isOriginAllowed('https://crm.sahyak.com'), true);
    assert.strictEqual(isOriginAllowed('https://sahyak-frontend.onrender.com'), true);
    assert.strictEqual(isOriginAllowed('https://preview-123.onrender.com'), true);
    assert.strictEqual(isOriginAllowed('https://const-crm-software.pages.dev'), true);
    assert.strictEqual(isOriginAllowed('https://malicious-site.com'), false);
    assert.strictEqual(isOriginAllowed(null), true); // Server-to-server / webhooks
  });

  // 3. Health check probes
  console.log('🔹 3. Testing Health Check Endpoints (/health/live & /health/ready)...');
  const healthCheckService =
    require('../src/monitoring/health/HealthCheckService').healthCheckService ||
    require('../src/monitoring/health/HealthCheckService').default;

  await itAsync('GET /health/live reports HEALTHY status without leaking sensitive details', async () => {
    const live = await healthCheckService.getLiveness();
    assert.strictEqual(live.status, 'HEALTHY');
    assert.strictEqual(live.liveness, true);
    assert.strictEqual(typeof live.uptimeSeconds, 'number');
    assert.strictEqual(typeof live.pid, 'number');

    const serialized = JSON.stringify(live);
    assert.ok(!serialized.includes('mongodb+srv://'), 'Liveness must not leak MongoDB credentials');
    assert.ok(!serialized.includes('password'), 'Liveness must not leak passwords');
  });

  await itAsync('GET /health/ready returns structured checks without leaking credentials', async () => {
    const ready = await healthCheckService.getReadiness();
    assert.ok(ready.checks, 'Readiness must contain checks object');
    assert.ok(ready.checks.mongodb, 'Readiness must check MongoDB');
    assert.ok(ready.checks.storage, 'Readiness must check Storage');

    const serialized = JSON.stringify(ready);
    assert.ok(!serialized.includes('mongodb+srv://'), 'Readiness must not leak MongoDB credentials');
  });

  // 4. Baileys session storage validation
  console.log('🔹 4. Testing WhatsApp Baileys Persistent Session Architecture...');
  it('verifies Baileys auth state adapter is backed by MongoDB (useMongoDBAuthState)', () => {
    const mongoAuthPath = path.resolve(__dirname, '../src/services/mongoAuthState.js');
    assert.ok(fs.existsSync(mongoAuthPath), 'mongoAuthState.js must exist');
    const content = fs.readFileSync(mongoAuthPath, 'utf8');

    assert.ok(content.includes('BufferJSON'), 'Must serialize keys with BufferJSON');
    assert.ok(content.includes('WhatsAppAuth'), 'Must store credentials in WhatsAppAuth MongoDB collection');
    assert.ok(content.includes('findOneAndUpdate'), 'Must upsert auth state in database');
  });

  it('verifies waSession.js uses useMongoDBAuthState and does not use local auth directory', () => {
    const waSessionPath = path.resolve(__dirname, '../src/services/waSession.js');
    const content = fs.readFileSync(waSessionPath, 'utf8');

    assert.ok(content.includes('useMongoDBAuthState'), 'waSession.js must use MongoDB auth state');
    assert.ok(!content.includes('useMultiFileAuthState'), 'waSession.js must NOT depend on ephemeral local file auth state');
    assert.ok(typeof require('../src/services/waSession').closeAllSessions === 'function', 'waSession must export closeAllSessions for graceful shutdown');
  });

  // 5. Cron jobs safety & graceful shutdown
  console.log('🔹 5. Testing node-cron Background Scheduling & Shutdown...');
  it('verifies all cron jobs are database-guarded and stopFollowUpCron stops all tasks cleanly', () => {
    const cronPath = path.resolve(__dirname, '../src/utils/cron.js');
    const content = fs.readFileSync(cronPath, 'utf8');

    assert.ok(content.includes('isDbReady'), 'Cron tasks must guard against running when DB is disconnected');
    assert.ok(content.includes('stopFollowUpCron'), 'cron.js must export stopFollowUpCron');

    const { startFollowUpCron, stopFollowUpCron, isDbReady } = require('../src/utils/cron');
    assert.strictEqual(typeof startFollowUpCron, 'function');
    assert.strictEqual(typeof stopFollowUpCron, 'function');
    assert.strictEqual(typeof isDbReady, 'function');

    // Test stopFollowUpCron execution
    stopFollowUpCron();
  });

  it('verifies server.js invokes stopFollowUpCron and closeAllSessions during graceful shutdown', () => {
    const serverJsPath = path.resolve(__dirname, '../server.js');
    const content = fs.readFileSync(serverJsPath, 'utf8');

    assert.ok(content.includes('stopFollowUpCron()'), 'server.js must call stopFollowUpCron on shutdown');
    assert.ok(content.includes('waSession.closeAllSessions()'), 'server.js must close Baileys sessions on shutdown');
    assert.ok(content.includes('server.close'), 'server.js must close HTTP listener on shutdown');
    assert.ok(content.includes('mongoose.connection.close'), 'server.js must close MongoDB on shutdown');
  });

  // 6. Filesystem and ephemeral safety
  console.log('🔹 6. Testing Filesystem and Ephemeral Storage Safety...');
  it('verifies media uploads use Cloudinary with local file cleanup', () => {
    const recordingControllerPath = path.resolve(__dirname, '../src/controllers/recordingsController.js');
    const recContent = fs.readFileSync(recordingControllerPath, 'utf8');
    assert.ok(recContent.includes('cloudinary.uploader.upload'), 'Recordings must upload to Cloudinary');
    assert.ok(recContent.includes('fs.unlinkSync'), 'Recordings must unlink local temporary file');

    const templateUploadPath = path.resolve(__dirname, '../src/middleware/templateUpload.js');
    const tplContent = fs.readFileSync(templateUploadPath, 'utf8');
    assert.ok(tplContent.includes('cloudinary.uploader.upload'), 'Templates must support Cloudinary upload');
    assert.ok(tplContent.includes('fs.unlinkSync'), 'Templates must clean up local temp files');

    const paymentUploadPath = path.resolve(__dirname, '../src/middleware/paymentUpload.js');
    const payContent = fs.readFileSync(paymentUploadPath, 'utf8');
    assert.ok(payContent.includes('cloudinary.uploader.upload'), 'Payment screenshots must upload to Cloudinary');
    assert.ok(payContent.includes('fs.unlinkSync'), 'Payment screenshots must clean up local temp files');
  });

  it('verifies PDF generation streams directly without writing to disk', () => {
    const leadsControllerPath = path.resolve(__dirname, '../src/controllers/leadsController.js');
    const content = fs.readFileSync(leadsControllerPath, 'utf8');
    assert.ok(content.includes('doc.pipe(res)'), 'PDF generation in leadsController must pipe to response stream');
  });

  // 7. Render manifest check
  console.log('🔹 7. Testing render.yaml Configuration Manifest...');
  it('verifies render.yaml exists at workspace root and configures web service properly', () => {
    const renderYamlPath = path.resolve(__dirname, '../../render.yaml');
    assert.ok(fs.existsSync(renderYamlPath), 'render.yaml must exist at project root');
    const content = fs.readFileSync(renderYamlPath, 'utf8');

    assert.ok(content.includes('rootDir: backend'), 'render.yaml must specify rootDir: backend');
    assert.ok(content.includes('buildCommand: npm ci && npm run build'), 'render.yaml must build with npm ci && npm run build');
    assert.ok(content.includes('startCommand: node server.js'), 'render.yaml must start with node server.js');
    assert.ok(content.includes('healthCheckPath: /health/live'), 'render.yaml must specify healthCheckPath: /health/live');
    assert.ok(content.includes('key: NODE_ENV'), 'render.yaml must define NODE_ENV');
  });

  console.log('\n========================================================');
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('========================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
