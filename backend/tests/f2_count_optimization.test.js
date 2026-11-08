const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

let replSet;
let Lead;
let User;
let Workspace;

const leadsController = require('../src/controllers/leadsController');

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  Lead = require('../src/models/Lead');
  User = require('../src/models/User');
  Workspace = require('../src/models/Workspace');
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

describe('F2.1: Lead List countDocuments Optimization and Caching', () => {
  it('infers total on page 1 without executing countDocuments when leads < limit', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({ name: 'Count Test WS', ownerId });
    const user = await User.create({
      _id: ownerId,
      name: 'Agent FastCount',
      email: 'fastcount@test.com',
      password: 'Password123!',
      role: 'admin',
      companyRole: 'owner',
      workspaceRole: 'owner',
      workspaceId: ws._id,
      companyId: ws._id,
      isActive: true,
    });

    // Seed 5 leads (limit is 50)
    for (let i = 1; i <= 5; i++) {
      await Lead.create({
        workspaceId: ws._id,
        companyId: ws._id,
        userId: user._id,
        assignedTo: user._id,
        name: `Lead ${i}`,
        phone: `911110000${i}`,
        phoneDigits: `911110000${i}`,
        status: 'new',
        targetDomain: 'Engineering (B.Tech/BE)',
      });
    }

    let countDocumentsCalled = 0;
    const originalCountDocuments = Lead.countDocuments;
    Lead.countDocuments = function (...args) {
      countDocumentsCalled++;
      return originalCountDocuments.apply(this, args);
    };

    try {
      const req = {
        query: { page: '1', limit: '50' },
        headers: {},
        user,
        workspaceId: ws._id,
      };
      const res = {
        status(s) { this.statusCode = s; return this; },
        json(b) { this.body = b; return this; },
      };

      await leadsController.getLeads(req, res);
      assert.strictEqual(res.body.leads.length, 5);
      assert.strictEqual(res.body.total, 5);
      assert.strictEqual(countDocumentsCalled, 0, 'Lead.countDocuments must NOT be called when page 1 has fewer leads than cap');
    } finally {
      Lead.countDocuments = originalCountDocuments;
    }
  });

  it('skips count entirely when includeTotal=false or x-skip-total-count header is present', async () => {
    const ws = await Workspace.findOne();
    const user = await User.findOne();

    let countDocumentsCalled = 0;
    const originalCountDocuments = Lead.countDocuments;
    Lead.countDocuments = function (...args) {
      countDocumentsCalled++;
      return originalCountDocuments.apply(this, args);
    };

    try {
      const req = {
        query: { page: '1', limit: '50', includeTotal: 'false' },
        headers: {},
        user,
        workspaceId: ws._id,
      };
      const res = {
        status(s) { this.statusCode = s; return this; },
        json(b) { this.body = b; return this; },
      };

      await leadsController.getLeads(req, res);
      assert.strictEqual(res.body.total, -1);
      assert.strictEqual(countDocumentsCalled, 0, 'countDocuments must be bypassed on includeTotal=false');
    } finally {
      Lead.countDocuments = originalCountDocuments;
    }
  });

  it('serves subsequent default pagination from in-memory cache and invalidates on lead creation', async () => {
    const ws = await Workspace.findOne();
    const user = await User.findOne();
    leadsController.invalidateLeadCountCache(ws._id);

    // Force countDocuments to be called once by requesting page 2
    let countDocumentsCalled = 0;
    const originalCountDocuments = Lead.countDocuments;
    Lead.countDocuments = function (...args) {
      countDocumentsCalled++;
      return originalCountDocuments.apply(this, args);
    };

    try {
      const req1 = {
        query: { page: '2', limit: '2' },
        headers: {},
        user,
        workspaceId: ws._id,
      };
      const res1 = {
        status(s) { this.statusCode = s; return this; },
        json(b) { this.body = b; return this; },
      };

      await leadsController.getLeads(req1, res1);
      assert.strictEqual(res1.body.total, 5);
      assert.strictEqual(countDocumentsCalled, 1, 'First call on page 2 executes countDocuments');

      // Second call to page 2 (must hit count cache)
      const req2 = {
        query: { page: '2', limit: '2' },
        headers: {},
        user,
        workspaceId: ws._id,
      };
      const res2 = {
        status(s) { this.statusCode = s; return this; },
        json(b) { this.body = b; return this; },
      };

      await leadsController.getLeads(req2, res2);
      assert.strictEqual(res2.body.total, 5);
      assert.strictEqual(countDocumentsCalled, 1, 'Second call must be served from cache without DB countDocuments');

      // Create new lead which must invalidate cache
      const createReq = {
        body: {
          name: 'New Invalidation Lead',
          phone: '9111199999',
          targetDomain: 'Engineering (B.Tech/BE)',
          status: 'new',
        },
        headers: {},
        user,
        workspaceId: ws._id,
      };
      const createRes = {
        status(s) { this.statusCode = s; return this; },
        json(b) { this.body = b; return this; },
      };

      await leadsController.createLead(createReq, createRes);
      assert.strictEqual(createRes.statusCode || 200, 201);

      // Reset spy count before third getLeads call
      countDocumentsCalled = 0;

      // Third call to page 2: must see invalidated cache and re-query DB for updated count
      const req3 = {
        query: { page: '2', limit: '2' },
        headers: {},
        user,
        workspaceId: ws._id,
      };
      const res3 = {
        status(s) { this.statusCode = s; return this; },
        json(b) { this.body = b; return this; },
      };

      await leadsController.getLeads(req3, res3);
      assert.strictEqual(res3.body.total, 6, 'Total must reflect newly created lead');
      assert.strictEqual(countDocumentsCalled, 1, 'countDocuments called exactly once for getLeads after cache invalidation');
    } finally {
      Lead.countDocuments = originalCountDocuments;
    }
  });
});
