/**
 * Regression Test: Clean Boot & Dynamic Port Connect Verification (Stage F1)
 *
 * Asserts:
 * 1. Database connection logic parses custom local MongoDB ports dynamically.
 * 2. Express server boots cleanly on an empty database without crashing or error loops.
 * 3. Kubernetes readiness and healthcheck endpoints report 200 OK with HEALTHY database state.
 */

const assert = require('assert');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function runCleanBootTest() {
  console.log('='.repeat(75));
  console.log('🧪 VERIFYING CLEAN BOOT & DYNAMIC PORT CONNECT (F1)');
  console.log('='.repeat(75));

  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  console.log(`✅ In-memory Mongo engine initialized at ${mongoUri}`);

  const testPort = 5988;
  const child = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(testPort),
      MONGODB_URI: mongoUri,
      MONGO_URI: mongoUri,
      RUN_BACKGROUND_WORKERS: 'false',
      JWT_SECRET: 'test_clean_boot_jwt_secret_32_bytes_len!',
      INTEGRATION_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      NODE_PATH: path.resolve(__dirname, '../node_modules'),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let started = false;
  let logs = '';

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out waiting for server boot. Logs:\n${logs}`));
    }, 15000);

    child.stdout.on('data', (d) => {
      const s = d.toString();
      logs += s;
      if (s.includes('running on http://0.0.0.0:')) {
        started = true;
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on('data', (d) => logs += d.toString());
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (!started) reject(new Error(`Server exited prematurely with code ${code}. Logs:\n${logs}`));
    });
  });

  assert.strictEqual(started, true, 'Server must start successfully');
  console.log(`✅ Express application booted successfully on port ${testPort}`);

  // Poll /health/ready
  let readyRes;
  for (let attempt = 1; attempt <= 10; attempt++) {
    await new Promise(r => setTimeout(r, 1000));
    readyRes = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${testPort}/health/ready`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }).on('error', reject);
    });
    if (readyRes.status === 200 && readyRes.body?.checks?.mongodb?.status === 'HEALTHY') {
      console.log(`✅ Readiness check passed on attempt ${attempt}: HTTP ${readyRes.status}`);
      break;
    }
  }

  child.kill();
  await mongoServer.stop();

  assert.strictEqual(readyRes.status, 200, 'Health ready must return 200');
  assert.strictEqual(readyRes.body.ready, true, 'Health ready flag must be true');
  assert.strictEqual(readyRes.body.checks.mongodb.status, 'HEALTHY', 'MongoDB check must report HEALTHY');

  console.log('='.repeat(75));
  console.log('🎉 ALL CLEAN BOOT VERIFICATION CHECKS PASSED');
  console.log('='.repeat(75));
}

if (require.main === module) {
  runCleanBootTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal test error:', err);
      process.exit(1);
    });
}

module.exports = { runCleanBootTest };
