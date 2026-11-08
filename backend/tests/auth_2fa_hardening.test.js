const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function runTest() {
  console.log('🧪 Running Issue 2 Test: 2FA Emergency Bypass Decommissioning...');

  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_crm_2026_super_secure';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);

  const User = require('../src/models/User');

  // Create user with 2FA enabled
  const user = await User.create({
    name: '2FA Protected User',
    email: 'protected2fa@example.com',
    password: 'Password123!',
    role: 'agent',
    twoFactorEnabled: true,
    twoFactorSecret: 'MFRGGZDFMY2WMZZG',
    twoFactorRecoveryCodes: ['CODE-1111-2222', 'CODE-3333-4444'],
  });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth`;

  try {
    // 1. Attempt emergency bypass using identifier + password
    const res = await fetch(`${baseUrl}/reset-2fa-emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'protected2fa@example.com',
        password: 'Password123!',
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 410, `Expected 410 Gone but got ${res.status}`);
    assert.strictEqual(body.code, 'FEATURE_DISABLED', 'Code should be FEATURE_DISABLED');

    // 2. Verify in database that 2FA was NOT wiped
    const checkUser = await User.findById(user._id);
    assert.strictEqual(checkUser.twoFactorEnabled, true, '2FA must remain enabled in database');
    assert.strictEqual(checkUser.twoFactorSecret, 'MFRGGZDFMY2WMZZG', '2FA secret must remain intact');
    assert.strictEqual(checkUser.twoFactorRecoveryCodes.length, 2, 'Recovery codes must remain intact');

    console.log('✅ Issue 2 Test PASSED: Emergency 2FA bypass endpoint disabled (HTTP 410), DB state preserved.');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Issue 2 Test FAILED:', err);
    process.exit(1);
  });
