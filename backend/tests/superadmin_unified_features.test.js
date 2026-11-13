const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_superadmin_unified_2026';
process.env.NODE_ENV = 'test';

const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const Plan = require('../src/models/Plan');
const Coupon = require('../src/models/Coupon');
const Broadcast = require('../src/models/Broadcast');

const superAdminRoutes = require('../src/superadmin/routes/superAdminRoutes');
const couponValidationController = require('../src/controllers/couponValidationController');

describe('⚡ Super Admin Unified Features & Commercial Engine Test Suite', function () {
  this.timeout(30000);

  let server;
  let baseUrl;
  let superadminUser;
  let superadminToken;
  let testOrgUser;
  let testWorkspace;

  let createdPlanId;
  let createdCouponCode;

  function generateToken(userId, tokenVersion = 0) {
    return jwt.sign(
      { id: userId, tokenVersion, role: 'superadmin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  async function api(method, path, body = null, token = null) {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  before(async () => {
    // Ensure mongoose is connected to the runner's MongoMemoryServer
    if (mongoose.connection.readyState !== 1) {
      const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
      if (uri) {
        await mongoose.connect(uri);
      } else {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const ms = await MongoMemoryServer.create();
        await mongoose.connect(ms.getUri());
      }
    }

    const app = express();
    app.use(express.json());

    // Mount super admin routes & coupon validate
    app.use('/api/super-admin', superAdminRoutes);
    app.post('/api/coupons/validate', couponValidationController.validateCouponForCheckout);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Seed Super Admin
    superadminUser = await User.create({
      name: 'Super Admin',
      email: `superadmin_${Date.now()}@sahyak.com`,
      password: 'Password123!',
      role: 'superadmin',
      isAdmin: true,
      tokenVersion: 1,
      userStatus: 'active',
      isActive: true,
    });

    superadminToken = generateToken(superadminUser._id, superadminUser.tokenVersion);

    // Seed a tenant organization
    testOrgUser = await User.create({
      name: 'Apex Academy Founder',
      email: `apex_${Date.now()}@testcrm.com`,
      password: 'Password123!',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      userStatus: 'active',
      isActive: true,
    });

    testWorkspace = await Workspace.create({
      name: 'Apex Admissions Academy',
      ownerId: testOrgUser._id,
      tier: 'team_starter',
      plan: 'team_starter',
      status: 'active',
    });
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    if (superadminUser?._id) await User.findByIdAndDelete(superadminUser._id);
    if (testOrgUser?._id) await User.findByIdAndDelete(testOrgUser._id);
    if (testWorkspace?._id) await Workspace.findByIdAndDelete(testWorkspace._id);
    if (createdPlanId) await Plan.findByIdAndDelete(createdPlanId);
    if (createdCouponCode) await Coupon.deleteOne({ code: createdCouponCode });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. MERGED ORGANISATIONS & USERS TESTS
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Merged Organisations & Users Administration', () => {
    it('GET /api/super-admin/organisations - lists organisations with real data', async () => {
      const res = await api('GET', '/api/super-admin/organisations', null, superadminToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(Array.isArray(res.data.organisations), true);
    });

    it('GET /api/super-admin/users - lists users with role & organisation filter support', async () => {
      const res = await api('GET', '/api/super-admin/users?role=admin', null, superadminToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(Array.isArray(res.data.users), true);
    });

    it('PATCH /api/super-admin/users/:id/role - updates user role successfully', async () => {
      const res = await api(
        'PATCH',
        `/api/super-admin/users/${testOrgUser._id}/role`,
        { role: 'manager' },
        superadminToken
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.user.role, 'manager');

      // Revert back
      await api(
        'PATCH',
        `/api/super-admin/users/${testOrgUser._id}/role`,
        { role: 'admin' },
        superadminToken
      );
    });

    it('PATCH /api/super-admin/users/:id/status - toggles user status successfully', async () => {
      const res = await api(
        'PATCH',
        `/api/super-admin/users/${testOrgUser._id}/status`,
        { isActive: false, userStatus: 'suspended' },
        superadminToken
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.user.isActive, false);

      // Re-activate
      await api(
        'PATCH',
        `/api/super-admin/users/${testOrgUser._id}/status`,
        { isActive: true, userStatus: 'active' },
        superadminToken
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. DYNAMIC PLAN BUILDER: 3 PARAMETERS (AGENTS, LEADS, STORAGE)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Dynamic Plan Creation with 3 Parameters (Agents, Leads, Storage)', () => {
    it('POST /api/super-admin/plans - creates plan anchored on 3 parameters with other CRM tools free', async () => {
      const planPayload = {
        name: `Enterprise Growth Custom_${Date.now()}`,
        category: 'ORGANIZATION',
        badge: 'CEO CUSTOM',
        description: 'Flexible plan with customized Leads, Storage, and Agent Seats.',
        pricing: {
          monthly: { enabled: true, amount: 4999 },
          yearly: { enabled: true, amount: 49990 },
        },
        limits: {
          seats: 15,          // Parameter 1: 15 Agents
          leads: 50000,       // Parameter 2: 50,000 Leads
          storageGB: 100,     // Parameter 3: 100 GB Cloud Storage
        },
        features: {
          aiFeatures: true,   // Optional future monetization toggle
        },
        status: 'ACTIVE',
      };

      const res = await api('POST', '/api/super-admin/plans', planPayload, superadminToken);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.plan);
      assert.strictEqual(res.data.plan.limits.seats, 15);
      assert.strictEqual(res.data.plan.limits.leads, 50000);
      assert.strictEqual(res.data.plan.limits.storageGB, 100);
      assert.strictEqual(res.data.plan.features.leadManagement, true);
      assert.strictEqual(res.data.plan.features.whatsapp, true);
      assert.strictEqual(res.data.plan.features.aiFeatures, true);

      createdPlanId = res.data.plan._id;
    });

    it('GET /api/super-admin/plans - lists all database plans including newly created plan', async () => {
      const res = await api('GET', '/api/super-admin/plans', null, superadminToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      const found = res.data.plans.find((p) => p._id.toString() === createdPlanId.toString());
      assert.ok(found, 'Newly created dynamic plan must appear in catalog');
      assert.strictEqual(found.limits.leads, 50000);
      assert.strictEqual(found.limits.storageGB, 100);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. COUPONS FOR ALL CURRENT & FUTURE PLANS
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Promotional Coupons for All Current & Future Plans', () => {
    it('POST /api/super-admin/coupons - creates coupon applicable to all plans', async () => {
      createdCouponCode = `SUPER${Date.now().toString().slice(-4)}`;
      const couponPayload = {
        code: createdCouponCode,
        description: '30% Discount across all current and future plans',
        discountType: 'PERCENTAGE',
        discountValue: 30,
        appliesToAllPlans: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'ACTIVE',
      };

      const res = await api('POST', '/api/super-admin/coupons', couponPayload, superadminToken);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.coupon.code, createdCouponCode);
      assert.strictEqual(res.data.coupon.appliesToAllPlans, true);
    });

    it('POST /api/coupons/validate - validates preview coupon without planId for instant /plans feedback', async () => {
      const res = await api('POST', '/api/coupons/validate', { couponCode: createdCouponCode });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.valid, true);
      assert.strictEqual(res.data.discountType, 'PERCENTAGE');
      assert.strictEqual(res.data.discountValue, 30);
    });

    it('POST /api/coupons/validate - applies coupon discount correctly against newly created future plan', async () => {
      const res = await api('POST', '/api/coupons/validate', {
        couponCode: createdCouponCode,
        planId: createdPlanId,
        amount: 4999,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.valid, true);
      const expectedDiscount = Number((4999 * 0.3).toFixed(2));
      assert.strictEqual(res.data.discountAmount, expectedDiscount);
      assert.strictEqual(res.data.finalAmount, Number((4999 - expectedDiscount).toFixed(2)));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. PLATFORM BROADCAST CENTER
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Platform Broadcast Announcements', () => {
    it('GET /api/super-admin/broadcasts/audience-count - computes target audience size', async () => {
      const res = await api(
        'GET',
        '/api/super-admin/broadcasts/audience-count?targetAudience=ALL_ORGS',
        null,
        superadminToken
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(typeof res.data.count, 'number');
    });

    it('POST /api/super-admin/broadcast - dispatches system announcement to tenant audience', async () => {
      const res = await api(
        'POST',
        '/api/super-admin/broadcast',
        {
          title: 'Automated Test Broadcast: System Update',
          message: 'All client tenants are scheduled for performance optimization.',
          targetAudience: 'ALL_ORGS',
          priority: 'NORMAL',
        },
        superadminToken
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.broadcast);
      assert.strictEqual(res.data.broadcast.title, 'Automated Test Broadcast: System Update');
    });

    it('GET /api/super-admin/broadcasts - returns history of dispatched announcements', async () => {
      const res = await api('GET', '/api/super-admin/broadcasts', null, superadminToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(Array.isArray(res.data.broadcasts), true);
      assert.ok(res.data.broadcasts.length > 0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. GLOBAL LEADS REMOVAL VERIFICATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Global Leads Removal Verification', () => {
    it('GET /api/super-admin/leads - route is removed and returns 404', async () => {
      const res = await api('GET', '/api/super-admin/leads', null, superadminToken);
      assert.strictEqual(res.status, 404);
    });
  });
});
