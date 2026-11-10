/**
 * RC-5 Item 3 Test: Token Revocation & Zero-Latency Cache Invalidation
 * 
 * Asserts:
 * 1. Single-device logout (/api/auth/logout) immediately revokes that token (gets 401 on next request).
 * 2. Logout-all (/api/auth/logout-all) increments tokenVersion and revokes all active tokens immediately.
 * 3. Password change (/api/auth/change-password) increments tokenVersion and revokes active tokens immediately.
 * 4. Account deactivation (isActive = false) revokes active tokens immediately.
 * 5. TokenVerificationCache does NOT permit a revoked token to work within the 10s window.
 * 6. Stale userCache cannot re-authorize a revoked token.
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test_rc5_token_revocation_secret_32_bytes!';
process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';

const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const {
  userCache,
  tokenVerificationCache,
  invalidateUserAuthCache,
  hashToken,
  revokeToken,
  isTokenRevoked,
} = require('../src/utils/authCache');

const { protect } = require('../src/middleware/auth');
const authRoutes = require('../src/routes/auth');

function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body: json || data });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(75));
  console.log('🧪 RC-5 ITEM 3: TOKEN REVOCATION & CACHE INVALIDATION VERIFICATION');
  console.log('='.repeat(75));

  let memServer = null;
  if (!mongoose.connection.readyState) {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
    } else {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memServer = await MongoMemoryServer.create();
      await mongoose.connect(memServer.getUri());
    }
  }

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.get('/api/protected-resource', protect, (req, res) => {
    res.json({ success: true, userId: req.user._id, userVer: req.user.tokenVersion });
  });

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  try {
    // Seed test user
    const testUser = await User.create({
      name: 'Revocation Test User',
      email: `revocation.${Date.now()}@example.com`,
      password: 'password123',
      role: 'admin',
      isAdmin: true,
      tokenVersion: 1,
      isActive: true,
    });

    const createTokenForUser = (user, customVersion = null, sessionTag = 'default') => {
      return jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          tokenVersion: customVersion !== null ? customVersion : (user.tokenVersion || 0),
          sessionTag,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
    };

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Single Token Logout (/api/auth/logout)
    // ─────────────────────────────────────────────────────────────
    console.log('\n1. Testing single-token logout (/api/auth/logout)...');
    const tokenSession1 = createTokenForUser(testUser, null, 'device_mobile');
    const tokenSession2 = createTokenForUser(testUser, null, 'device_laptop'); // Device 2 token

    // Pre-warm tokenVerificationCache by making a successful request
    const warmupRes1 = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/protected-resource',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenSession1}` }
    });
    assert.strictEqual(warmupRes1.statusCode, 200, 'Warmup request 1 must succeed');

    // Call logout on session 1
    const logoutRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/auth/logout',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenSession1}` }
    });
    assert.strictEqual(logoutRes.statusCode, 200, 'Logout request must succeed');

    // Immediate next request with tokenSession1 must receive HTTP 401
    const afterLogoutRes1 = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/protected-resource',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenSession1}` }
    });
    assert.strictEqual(
      afterLogoutRes1.statusCode,
      401,
      `Session 1 token MUST be rejected immediately after logout, got ${afterLogoutRes1.statusCode}`
    );

    // Device 2 token must still work!
    const session2Res = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/protected-resource',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenSession2}` }
    });
    assert.strictEqual(session2Res.statusCode, 200, 'Device 2 token must remain valid after single logout');
    console.log('   ✅ Single-device logout revoked session 1 immediately while keeping session 2 active');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Logout-all (/api/auth/logout-all)
    // ─────────────────────────────────────────────────────────────
    console.log('\n2. Testing logout-all (/api/auth/logout-all)...');
    const tokenBeforeLogoutAll = createTokenForUser(testUser);

    // Warmup in cache
    const warmupAll = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/protected-resource',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenBeforeLogoutAll}` }
    });
    assert.strictEqual(warmupAll.statusCode, 200);

    // Execute logout-all
    const logoutAllRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/auth/logout-all',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenBeforeLogoutAll}` }
    });
    assert.strictEqual(logoutAllRes.statusCode, 200);

    // Old token must fail immediately on the very next request
    const afterLogoutAllRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/protected-resource',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenBeforeLogoutAll}` }
    });
    assert.strictEqual(
      afterLogoutAllRes.statusCode,
      401,
      `Token before logout-all MUST receive 401 on next request, got ${afterLogoutAllRes.statusCode}`
    );
    console.log('   ✅ Logout-all bumped tokenVersion and revoked previous token immediately');

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Password Change (/api/auth/change-password)
    // ─────────────────────────────────────────────────────────────
    console.log('\n3. Testing password change revocation (/api/auth/change-password)...');
    const freshUser = await User.findById(testUser._id);
    const tokenBeforePasswordChange = createTokenForUser(freshUser);

    // Warmup in cache
    const warmupPw = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/protected-resource',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenBeforePasswordChange}` }
    });
    assert.strictEqual(warmupPw.statusCode, 200);

    // Change password
    const pwRes = await httpRequest(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/auth/change-password',
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokenBeforePasswordChange}`,
          'Content-Type': 'application/json'
        }
      },
      JSON.stringify({ currentPassword: 'password123', newPassword: 'newSecretPassword456' })
    );
    assert.strictEqual(pwRes.statusCode, 200);

    // Very next request with old token must receive 401
    const afterPwChangeRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/protected-resource',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenBeforePasswordChange}` }
    });
    assert.strictEqual(
      afterPwChangeRes.statusCode,
      401,
      `Token before password change MUST receive 401 on next request, got ${afterPwChangeRes.statusCode}`
    );
    console.log('   ✅ Password change revoked previous token immediately');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Account Deactivation (isActive = false)
    // ─────────────────────────────────────────────────────────────
    console.log('\n4. Testing account deactivation revocation...');
    const userForDeact = await User.findById(testUser._id);
    const tokenBeforeDeact = createTokenForUser(userForDeact);

    // Warmup in cache
    const warmupDeact = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/protected-resource',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenBeforeDeact}` }
    });
    assert.strictEqual(warmupDeact.statusCode, 200);

    // Admin deactivates user
    await User.findByIdAndUpdate(testUser._id, { $set: { isActive: false, userStatus: 'disabled' } });
    invalidateUserAuthCache(testUser._id);

    // Very next request must receive 401
    const afterDeactRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/protected-resource',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenBeforeDeact}` }
    });
    assert.strictEqual(
      afterDeactRes.statusCode,
      401,
      `Deactivated account token MUST receive 401 on next request, got ${afterDeactRes.statusCode}`
    );
    console.log('   ✅ Account deactivation revoked token immediately (no stale cache bypass)');

    console.log('\n🎉 ALL RC-5 ITEM 3 TESTS PASSED!');
  } finally {
    server.close();
    await mongoose.disconnect().catch(() => {});
    if (memServer) await memServer.stop().catch(() => {});
  }
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n❌ RC-5 ITEM 3 TEST FAILED:');
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { runTests };
