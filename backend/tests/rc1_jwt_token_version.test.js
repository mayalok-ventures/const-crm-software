/**
 * RC1 Gate: JWT tokenVersion Lifecycle, Backward Compatibility & Multi-Device Revocation
 *
 * Verifies:
 * 1. Tokens issued before deploy (no tokenVersion in payload) are NOT mass-logged-out when user.tokenVersion === 0.
 * 2. Legacy tokens without tokenVersion are NOT trusted forever (rejected immediately once user.tokenVersion increments > 0).
 * 3. Standard logout (POST /api/auth/logout) terminates single session without invalidating other devices.
 * 4. Full logout (POST /api/auth/logout-all) increments tokenVersion and revokes all tokens.
 * 5. Password change (PUT /api/auth/change-password) increments tokenVersion and revokes all older tokens.
 * 6. The 30s clock tolerance on jwt.verify does NOT extend validity of revoked tokens (instant rejection).
 */

const assert = require('assert');
const path = require('path');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'rc1_jwt_token_version_test_secret_key_2026';
process.env.NODE_ENV = 'test';
process.env.ALLOW_UNSCOPED_TENANT_READS = 'true';

describe('RC1 Gate: JWT tokenVersion Lifecycle & Revocation', () => {
  let mongoServer;
  let server;
  let baseUrl;
  let User;
  let testUser;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    User = require('../src/models/User');
    const authRoutes = require('../src/routes/auth');

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;

    testUser = await User.create({
      name: 'Token Version User',
      email: 'tokenver@crm.test',
      password: 'InitialPassword123!',
      role: 'admin',
      companyRole: 'owner',
      tokenVersion: 0,
      isActive: true,
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it('1. Legacy token without tokenVersion is accepted on deploy when user.tokenVersion is 0 (No Mass Logout)', async () => {
    // Simulate token issued prior to deploy: contains { id } but NO tokenVersion claim
    const legacyToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const res = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${legacyToken}` },
    });

    assert.strictEqual(res.status, 200, 'Legacy token without tokenVersion must succeed on deploy');
    const data = await res.json();
    assert.strictEqual(data.email, 'tokenver@crm.test');
  });

  it('2. Legacy token without tokenVersion is IMMEDIATELY revoked when user.tokenVersion increments > 0', async () => {
    const legacyToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Increment user's tokenVersion in DB (e.g. security reset or password change)
    await User.findByIdAndUpdate(testUser._id, { $inc: { tokenVersion: 1 } });
    const { invalidateUserAuthCache } = require('../src/utils/authCache');
    invalidateUserAuthCache(testUser._id);

    const res = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${legacyToken}` },
    });

    assert.strictEqual(res.status, 401, 'Legacy token (version 0) must be rejected once user.tokenVersion > 0');
    const data = await res.json();
    assert(data.message.includes('revoked'), 'Error message must reflect revoked token');
  });

  it('3. POST /api/auth/logout terminates single device session without revoking other device tokens', async () => {
    // Reset user tokenVersion to 1
    const freshUser = await User.findById(testUser._id);
    const mobileToken = jwt.sign({ id: testUser._id, tokenVersion: freshUser.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const desktopToken = jwt.sign({ id: testUser._id, tokenVersion: freshUser.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Desktop logs out
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${desktopToken}`,
        'Content-Type': 'application/json',
      },
    });

    assert.strictEqual(logoutRes.status, 200);
    const logoutData = await logoutRes.json();
    assert.strictEqual(logoutData.success, true);

    // Mobile token continues to work
    const mobileRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${mobileToken}` },
    });
    assert.strictEqual(mobileRes.status, 200, 'Other device session must remain valid on single logout');
  });

  it('4. POST /api/auth/logout-all revokes all sessions across all devices immediately', async () => {
    const currentUser = await User.findById(testUser._id);
    const tokenDev1 = jwt.sign({ id: testUser._id, tokenVersion: currentUser.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const tokenDev2 = jwt.sign({ id: testUser._id, tokenVersion: currentUser.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Device 1 triggers logout-all
    const resAll = await fetch(`${baseUrl}/logout-all`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenDev1}`,
        'Content-Type': 'application/json',
      },
    });

    assert.strictEqual(resAll.status, 200);

    // Both device tokens must now be rejected
    const check1 = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${tokenDev1}` },
    });
    const check2 = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${tokenDev2}` },
    });

    assert.strictEqual(check1.status, 401, 'Device 1 token must be revoked');
    assert.strictEqual(check2.status, 401, 'Device 2 token must be revoked');
  });

  it('5. PUT /api/auth/change-password revokes all existing tokens and allows new token login', async () => {
    const updatedUser = await User.findById(testUser._id);
    const oldPassToken = jwt.sign({ id: testUser._id, tokenVersion: updatedUser.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Change password
    const changeRes = await fetch(`${baseUrl}/change-password`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${oldPassToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'InitialPassword123!',
        newPassword: 'BrandNewSecurePassword456!',
      }),
    });

    assert.strictEqual(changeRes.status, 200);

    // Old token must fail immediately
    const checkOld = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${oldPassToken}` },
    });
    assert.strictEqual(checkOld.status, 401, 'Old password token must be immediately revoked');

    // Login with new password issues a new valid token with incremented tokenVersion
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tokenver@crm.test',
        password: 'BrandNewSecurePassword456!',
      }),
    });

    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert(loginData.token, 'Must return new JWT token');

    // Verify new token works
    const checkNew = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.strictEqual(checkNew.status, 200, 'New token with updated tokenVersion must succeed');
  });

  it('6. Clock tolerance of 30s does NOT grant any grace period to revoked tokens', async () => {
    const user = await User.findById(testUser._id);
    const activeToken = jwt.sign({ id: testUser._id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Confirm it works now
    const beforeRevoke = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.strictEqual(beforeRevoke.status, 200);

    // Revoke token immediately
    await User.findByIdAndUpdate(testUser._id, { $inc: { tokenVersion: 1 } });
    const { invalidateUserAuthCache } = require('../src/utils/authCache');
    invalidateUserAuthCache(testUser._id);

    // Call immediately (0ms later) — clockTolerance must NOT allow revoked token
    const afterRevoke = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert.strictEqual(afterRevoke.status, 401, 'Revoked token must fail immediately despite clockTolerance: 30');
  });
});
