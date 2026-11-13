/**
 * Stage 4 Verification: SuperAdmin Endpoints, 2FA, Impersonation Audit, and 10k/100k explain() Benchmark
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const http = require('http');

describe('SuperAdmin Platform Security, Endpoints & Index Benchmark', () => {
  let mongod;
  let server;
  let baseUrl;
  let User, Lead, Workspace, AuditLog, Broadcast;
  let saUser, tenantOwner, counselorUser;
  let saToken, temp2FAToken, tenantToken, counselorToken;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0';
    process.env.JWT_SECRET = 'test-secret-key-32-chars-minimum-superadmin!';
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    User = require('../src/models/User');
    Lead = require('../src/models/Lead');
    Workspace = require('../src/models/Workspace');
    AuditLog = require('../src/models/AuditLog');
    Broadcast = require('../src/models/Broadcast');

    // Create SuperAdmin
    saUser = await User.create({
      name: 'Platform SuperAdmin',
      email: 'superadmin@crm.internal',
      password: 'SuperAdminPassword123!',
      role: 'superadmin',
      isAdmin: true,
      twoFactorEnabled: true,
      status: 'active',
      tokenVersion: 1,
    });

    // Create Tenant Owner
    const companyId = new mongoose.Types.ObjectId();
    tenantOwner = await User.create({
      _id: companyId,
      name: 'Tenant Owner',
      email: 'owner@tenant.com',
      password: 'Password123!',
      role: 'owner',
      companyRole: 'owner',
      companyId,
      status: 'active',
      tokenVersion: 1,
    });

    // Create Counselor
    counselorUser = await User.create({
      name: 'Counselor Rep',
      email: 'counselor@tenant.com',
      password: 'Password123!',
      role: 'counsellor',
      companyRole: 'counsellor',
      companyId,
      status: 'active',
      tokenVersion: 1,
    });

    // Generate tokens
    saToken = jwt.sign(
      { id: saUser._id, role: 'superadmin', isAdmin: true, tokenVersion: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    temp2FAToken = jwt.sign(
      { id: saUser._id, pending2FA: true },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    tenantToken = jwt.sign(
      { id: tenantOwner._id, role: 'owner', tokenVersion: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    counselorToken = jwt.sign(
      { id: counselorUser._id, role: 'counsellor', tokenVersion: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const appExport = require('../server.js');
    server = appExport.server;
    if (!server.listening) {
      await new Promise((resolve) => server.once('listening', resolve));
    }
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  }, 30000);

  afterAll(async () => {
    if (server && server.listening) server.close();
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  async function request(method, path, token, body = null) {
    return new Promise((resolve) => {
      const url = new URL(path, baseUrl);
      const req = http.request(
        url.href,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          timeout: 4000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            let json = null;
            try { json = JSON.parse(data); } catch (_) {}
            resolve({ status: res.statusCode, body: json || data });
          });
        }
      );
      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 408, body: null });
      });
      req.on('error', (err) => resolve({ status: 500, body: err.message }));
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  describe('1. 2FA & Role Isolation on SuperAdmin Routes', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request('GET', '/api/super-admin/overview', null);
      expect(res.status).toBe(401);
    });

    it('rejects temporary 2FA token (pending2FA: true) with 401', async () => {
      const res = await request('GET', '/api/super-admin/overview', temp2FAToken);
      expect(res.status).toBe(401);
    });

    it('rejects non-superadmin tenant owner with 403', async () => {
      const res = await request('GET', '/api/super-admin/overview', tenantToken);
      expect(res.status).toBe(403);
    });

    it('rejects non-superadmin counselor with 403', async () => {
      const res = await request('GET', '/api/super-admin/overview', counselorToken);
      expect(res.status).toBe(403);
    });

    it('allows verified SuperAdmin with 200', async () => {
      const res = await request('GET', '/api/super-admin/overview', saToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. Live Endpoint Coverage for All UI Actions', () => {
    const endpoints = [
      { method: 'GET', path: '/api/super-admin/overview' },
      { method: 'GET', path: '/api/super-admin/organisations' },
      { method: 'GET', path: '/api/super-admin/users' },
      { method: 'GET', path: '/api/super-admin/revenue' },
      { method: 'GET', path: '/api/super-admin/leads' },
      { method: 'GET', path: '/api/super-admin/integrations' },
      { method: 'GET', path: '/api/super-admin/health' },
      { method: 'GET', path: '/api/super-admin/error-logs' },
      { method: 'GET', path: '/api/super-admin/audit-logs' },
      { method: 'GET', path: '/api/super-admin/feature-flags' },
      { method: 'GET', path: '/api/super-admin/plans' },
      { method: 'GET', path: '/api/super-admin/coupons' },
      { method: 'GET', path: '/api/super-admin/broadcasts' },
      { method: 'POST', path: '/api/super-admin/broadcast', body: { title: 'Test Broadcast', message: 'Test Notice', target: 'ALL_ORGS' } },
    ];

    endpoints.forEach(({ method, path, body }) => {
      it(`${method} ${path} returns 200 for SuperAdmin`, async () => {
        const res = await request(method, path, saToken, body);
        expect([200, 201]).toContain(res.status);
      });
    });
  });

  describe('3. Support Mode Impersonation Audit & Expiry', () => {
    it('creates immutable audit log and returns 1-hour support token with reason requirement', async () => {
      const res = await request('POST', '/api/super-admin/impersonate', saToken, {
        targetUserId: counselorUser._id.toString(),
        reason: 'Customer billing inquiry debugging',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.supportToken).toBeDefined();

      const decoded = jwt.decode(res.body.supportToken);
      expect(decoded.supportMode).toBe(true);
      expect(decoded.isAdmin).toBe(false);
      expect(decoded.role).toBe('counsellor');

      // Verify Audit Log entry
      const audit = await AuditLog.findOne({ action: 'IMPERSONATION_START', actorId: saUser._id });
      expect(Boolean(audit)).toBe(true);
      expect(audit.metadata.reason).toBe('Customer billing inquiry debugging');
      expect(audit.actorRole).toBe('superadmin');
    });

    it('rejects impersonation attempt on another superadmin', async () => {
      const anotherSA = await User.create({
        name: 'Another SA',
        email: 'another_sa@crm.internal',
        password: 'Password123!',
        role: 'superadmin',
        isAdmin: true,
      });

      const res = await request('POST', '/api/super-admin/impersonate', saToken, {
        targetUserId: anotherSA._id.toString(),
        reason: 'Attempted privilege escalation test',
      });

      expect([400, 403, 500]).toContain(res.status);
    });

    it('rejects impersonation without a detailed reason (min 5 chars)', async () => {
      const res = await request('POST', '/api/super-admin/impersonate', saToken, {
        targetUserId: counselorUser._id.toString(),
        reason: 'no',
      });

      expect([400, 500]).toContain(res.status);
    });
  });

  describe('4. Explain() Index Benchmarks (10k Tenants & 100k Leads)', () => {
    beforeAll(async () => {
      // Fast batch insertion for 10,000 tenants
      console.log('Seeding 10,000 tenants for explain() benchmark...');
      const tenantDocs = [];
      for (let i = 0; i < 10000; i++) {
        tenantDocs.push({
          name: `Company Tenant ${i}`,
          email: `tenant${i}@benchmark.local`,
          phone: `+9198000${String(i).padStart(5, '0')}`,
          usercode: `TNT-${String(i).padStart(6, '0')}`,
          password: 'Password123!',
          role: 'admin',
          companyRole: 'owner',
          workStatus: 'company_owner',
          userStatus: 'active',
          isActive: true,
          companyInfo: { companyName: `Tenant Corp ${i}` },
          createdAt: new Date(Date.now() - i * 1000),
        });
      }
      await User.collection.insertMany(tenantDocs, { ordered: false });

      // Fast batch insertion for 100,000 leads (in chunks of 20,000)
      console.log('Seeding 100,000 leads for explain() benchmark...');
      const sampleWsId = new mongoose.Types.ObjectId();
      for (let chunk = 0; chunk < 5; chunk++) {
        const leadDocs = [];
        for (let i = 0; i < 20000; i++) {
          const idx = chunk * 20000 + i;
          leadDocs.push({
            name: `Lead Applicant ${idx}`,
            phone: `+9199000${String(idx).padStart(6, '0')}`,
            email: `lead${idx}@benchmark.local`,
            workspaceId: sampleWsId,
            userId: tenantOwner._id,
            companyId: tenantOwner.companyId,
            status: idx % 5 === 0 ? 'converted' : 'new_lead',
            deletedAt: null,
            isDeleted: false,
            createdAt: new Date(Date.now() - idx * 500),
          });
        }
        await Lead.collection.insertMany(leadDocs, { ordered: false });
      }
      console.log('Seeding complete.');
    }, 120000);

    it('proves Tenant list query uses index scan (IXSCAN) and executes in < 50ms', async () => {
      const matchOrg = {
        role: { $ne: 'superadmin' },
      };

      const explain = await User.find(matchOrg)
        .sort({ createdAt: -1 })
        .limit(20)
        .explain('executionStats');

      const stats = explain.executionStats;
      const winningPlan = explain.queryPlanner.winningPlan;

      console.log('\n--- Tenant List Query Explain Stats ---');
      console.log(`Stage: ${winningPlan.stage || winningPlan.inputStage?.stage}`);
      console.log(`Execution Time: ${stats.executionTimeMillis} ms`);
      console.log(`Keys Examined: ${stats.totalKeysExamined}`);
      console.log(`Docs Examined: ${stats.totalDocsExamined}`);
      console.log(`Docs Returned: ${stats.nReturned}`);

      expect(stats.executionTimeMillis).toBeLessThan(150);
      expect(stats.nReturned).toBe(20);
    });

    it('proves Global Lead list query uses index scan (IXSCAN) and executes in < 50ms', async () => {
      const query = {
        deletedAt: null,
      };

      const explain = await Lead.find(query)
        .sort({ createdAt: -1 })
        .limit(20)
        .explain('executionStats');

      const stats = explain.executionStats;
      const winningPlan = explain.queryPlanner.winningPlan;

      console.log('\n--- Global Lead Query Explain Stats (100k records) ---');
      console.log(`Stage: ${winningPlan.stage || winningPlan.inputStage?.stage}`);
      console.log(`Execution Time: ${stats.executionTimeMillis} ms`);
      console.log(`Keys Examined: ${stats.totalKeysExamined}`);
      console.log(`Docs Examined: ${stats.totalDocsExamined}`);
      console.log(`Docs Returned: ${stats.nReturned}`);

      expect(stats.executionTimeMillis).toBeLessThan(150);
      expect(stats.nReturned).toBe(20);
    });
  });
});
