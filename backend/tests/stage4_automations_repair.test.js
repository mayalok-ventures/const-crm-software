/**
 * Stage 4 Verification: Automation Engine Repair & Hardening
 * Verifies that:
 * 1. 'tag_added' trigger fires end-to-end when a tag is applied to a lead
 * 2. Idempotent execution: duplicate trigger calls with same idempotencyKey do not double-fire
 * 3. Delayed actions survive restart: queued pending action with scheduledFor <= now is swept and executed
 * 4. Loop & depth guard: recursive trigger chains terminate at depth 3 and prevent self-retriggering loops
 * 5. Graceful channel failure: disconnected/missing WhatsApp logs 'failed' with clear error message, not 'success'
 * 6. Multi-tenant isolation: rule in Workspace A never triggers or executes against Workspace B lead
 * 7. Plan limits: workspace exceeding maxAutomations cannot activate new rules (403 PLAN_LIMIT_REACHED)
 * 8. Retry with dead-letter: failing logs retried >= 3 times transition to 'dead_letter'
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'stage4_test_jwt_secret_2026';
process.env.NODE_ENV = 'test';

const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const Lead = require('../src/models/Lead');
const AutomationRule = require('../src/models/AutomationRule');
const AutomationLog = require('../src/models/AutomationLog');
const AutomationEngine = require('../src/services/automationEngine');
const AutomationRegistry = require('../src/services/automationRegistry');
const { crmEvents, CRM_EVENTS } = require('../src/services/automationEvents');
require('../src/services/automationHandlers'); // register listeners

const { generateToken } = require('../src/middleware/auth');
const automationRoutes = require('../src/routes/automationRoutes');
const leadsRoutes = require('../src/routes/leads');

describe('Stage 4: Automation Engine Repair & Hardening', function () {
  this.timeout(45000);
  let mongoServer;
  let server;
  let baseUrl;

  let wsA, wsB;
  let userA, userB;
  let tokenA, tokenB;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const app = express();
    app.use(express.json());

    // Middleware to set workspace context
    app.use((req, res, next) => {
      req.workspaceId = req.headers['x-workspace-id'] || null;
      next();
    });

    app.use('/api/automations', automationRoutes);
    app.use('/api/leads', leadsRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Generate ObjectIds for owners
    const ownerIdA = new mongoose.Types.ObjectId();
    const ownerIdB = new mongoose.Types.ObjectId();

    // Seed Workspaces
    wsA = await Workspace.create({
      name: 'Alpha Admissions',
      slug: 'alpha-adm',
      tier: 'pro',
      status: 'active',
      plan: 'pro',
      ownerId: ownerIdA,
    });

    wsB = await Workspace.create({
      name: 'Beta Consultants',
      slug: 'beta-con',
      tier: 'starter',
      status: 'active',
      plan: 'starter',
      ownerId: ownerIdB,
    });

    // Seed Users
    userA = await User.create({
      name: 'Admin Alpha',
      email: 'admin@alpha.org',
      password: 'Password123!',
      role: 'admin',
      workspaceId: wsA._id,
      companyId: wsA._id,
    });

    userB = await User.create({
      name: 'Admin Beta',
      email: 'admin@beta.org',
      password: 'Password123!',
      role: 'admin',
      workspaceId: wsB._id,
      companyId: wsB._id,
    });

    await WorkspaceMembership.create({
      workspaceId: wsA._id,
      userId: userA._id,
      role: 'owner',
      status: 'active',
    });

    await WorkspaceMembership.create({
      workspaceId: wsB._id,
      userId: userB._id,
      role: 'owner',
      status: 'active',
    });

    tokenA = generateToken(userA);
    tokenB = generateToken(userB);
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  afterEach(async () => {
    await AutomationRule.deleteMany({});
    await AutomationLog.deleteMany({});
    await Lead.deleteMany({});
  });

  // Helper for HTTP requests
  async function api(method, path, body = null, token = tokenA, wsId = wsA._id.toString()) {
    const url = new URL(path, baseUrl);
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-workspace-id': wsId,
    };

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  it('1. tag_added trigger fires end-to-end when a tag is applied to a lead', async () => {
    // Create rule: when tag 'vip' is added, update lead stage to 'Qualified'
    const rule = await AutomationRule.create({
      workspaceId: wsA._id,
      userId: userA._id,
      name: 'VIP Tag Handler',
      triggerType: 'tag_added',
      triggerConfig: { targetTag: 'vip' },
      actions: [
        {
          order: 1,
          actionType: 'update_lead_stage',
          config: { newStage: 'Qualified' },
        },
      ],
      isActive: true,
      status: 'active',
    });

    // Create a lead in wsA
    const lead = await Lead.create({
      name: 'Siddharth Patel',
      phone: '+919876543210',
      email: 'siddharth@example.com',
      workspaceId: wsA._id,
      userId: userA._id,
      status: 'Fresh Lead',
      tags: [],
    });

    // Fire tag_added automation directly
    await AutomationEngine.executeTagAddedAutomations(lead, 'vip', {
      workspaceId: wsA._id,
      user: userA,
    });

    // Verify lead stage was updated to 'Qualified'
    const updatedLead = await Lead.findById(lead._id);
    assert.strictEqual(updatedLead.status, 'Qualified', 'Lead stage should be updated to Qualified by automation');

    // Verify execution log exists
    const logs = await AutomationLog.find({ ruleId: rule._id });
    assert.strictEqual(logs.length, 1, 'Should create exactly one execution log');
    assert.strictEqual(logs[0].status, 'success');
    assert.strictEqual(logs[0].actionType, 'update_lead_stage');
  });

  it('2. Idempotency prevents double-firing the same trigger for the same event', async () => {
    const rule = await AutomationRule.create({
      workspaceId: wsA._id,
      userId: userA._id,
      name: 'Welcome Stage Transition',
      triggerType: 'stage_changed',
      triggerConfig: { targetStage: 'Prospect' },
      actions: [
        {
          order: 1,
          actionType: 'add_lead_tag',
          config: { tagToAdd: 'auto-prospect' },
        },
      ],
      isActive: true,
      status: 'active',
    });

    const lead = await Lead.create({
      name: 'Meera Rao',
      phone: '+919876543211',
      workspaceId: wsA._id,
      userId: userA._id,
      status: 'Prospect',
      tags: [],
    });

    // First execution
    await AutomationEngine.executeStageChangeAutomations(lead, 'Fresh Lead', 'Prospect', {
      workspaceId: wsA._id,
      user: userA,
    });

    // Second execution with same parameters (e.g. event replay or retry)
    await AutomationEngine.executeStageChangeAutomations(lead, 'Fresh Lead', 'Prospect', {
      workspaceId: wsA._id,
      user: userA,
    });

    // Verify lead only processed once
    const logs = await AutomationLog.find({ ruleId: rule._id, leadId: lead._id });
    assert.strictEqual(logs.length, 1, 'Idempotency key must prevent second execution log');

    const updatedLead = await Lead.findById(lead._id);
    const prospectTags = updatedLead.tags.filter((t) => t === 'auto-prospect');
    assert.strictEqual(prospectTags.length, 1, 'Tag must not be added multiple times');
  });

  it('3. Delayed actions survive restart: sweepPendingDelayedAutomations processes pending records', async () => {
    const rule = await AutomationRule.create({
      workspaceId: wsA._id,
      userId: userA._id,
      name: 'Delayed Follow-up Tagger',
      triggerType: 'lead_created',
      actions: [
        {
          order: 1,
          actionType: 'add_lead_tag',
          delayMinutes: 10,
          config: { tagToAdd: 'post-delay' },
        },
      ],
      isActive: true,
      status: 'active',
    });

    const lead = await Lead.create({
      name: 'Delayed Target',
      phone: '+919876543212',
      workspaceId: wsA._id,
      userId: userA._id,
      status: 'Fresh Lead',
      tags: [],
    });

    // Simulate an action queued before restart whose scheduledFor timestamp has passed
    const pastTime = new Date(Date.now() - 5000); // 5 seconds ago
    const pendingLog = await AutomationLog.create({
      ruleId: rule._id,
      ruleName: rule.name,
      workspaceId: wsA._id,
      userId: userA._id,
      leadId: lead._id,
      leadName: lead.name,
      triggerType: 'lead_created',
      actionType: 'add_lead_tag',
      status: 'pending',
      scheduledFor: pastTime,
      actionPayload: {
        action: {
          actionType: 'add_lead_tag',
          config: { tagToAdd: 'post-delay' },
        },
      },
    });

    // Run startup sweep
    await AutomationEngine.sweepPendingDelayedAutomations();

    // Verify log is now completed
    const reloadedLog = await AutomationLog.findById(pendingLog._id);
    assert.strictEqual(reloadedLog.status, 'completed', 'Sweeper must complete pending delayed action');

    // Verify action took effect on lead
    const reloadedLead = await Lead.findById(lead._id);
    assert.ok(reloadedLead.tags.includes('post-delay'), 'Lead must have tag added by sweeper');
  });

  it('4. Loop & depth guard terminates recursive trigger chains at depth 3', async () => {
    const rule = await AutomationRule.create({
      workspaceId: wsA._id,
      userId: userA._id,
      name: 'Self-Triggering Rule',
      triggerType: 'tag_added',
      triggerConfig: { targetTag: 'recursive' },
      actions: [
        {
          order: 1,
          actionType: 'add_lead_tag',
          config: { tagToAdd: 'recursive' },
        },
      ],
      isActive: true,
      status: 'active',
    });

    const lead = await Lead.create({
      name: 'Loop Test',
      phone: '+919876543213',
      workspaceId: wsA._id,
      userId: userA._id,
      tags: ['initial'],
    });

    // Call handleTagAdded with depth >= 3
    const handled = await AutomationEngine.handleTagAdded(lead, 'recursive', {
      workspaceId: wsA._id,
      user: userA,
      depth: 3, // at max depth
      chain: [String(rule._id)],
    });

    assert.strictEqual(handled.length, 0, 'Depth guard must refuse execution at depth >= 3');
  });

  it('5. Graceful channel failure: disconnected WhatsApp logs failed status with clear message', async () => {
    const rule = await AutomationRule.create({
      workspaceId: wsA._id,
      userId: userA._id,
      name: 'WhatsApp Outreach',
      triggerType: 'lead_created',
      actions: [
        {
          order: 1,
          actionType: 'send_whatsapp',
          config: { whatsappMessage: 'Hello {{name}}' },
        },
      ],
      isActive: true,
      status: 'active',
    });

    const lead = await Lead.create({
      name: 'Unconnected Lead',
      phone: '+919876543214',
      workspaceId: wsA._id,
      userId: userA._id,
      status: 'Fresh Lead',
    });

    // Execute performAction directly
    await AutomationEngine.performAction(rule.actions[0], rule, {
      lead,
      user: userA,
      workspaceId: wsA._id,
    });

    // Verify log exists and is marked as 'failed', NOT 'success'
    const log = await AutomationLog.findOne({ ruleId: rule._id });
    assert.ok(log, 'Must create an automation log');
    assert.strictEqual(log.status, 'failed', 'Unconnected WhatsApp must log failed status');
    assert.ok(log.errorMessage.includes('WhatsApp is not connected'), 'Must contain clear actionable error');
  });

  it('6. Multi-tenant isolation: rule in Workspace A never executes against Workspace B lead', async () => {
    const ruleA = await AutomationRule.create({
      workspaceId: wsA._id,
      userId: userA._id,
      name: 'Workspace A Tag Rule',
      triggerType: 'tag_added',
      triggerConfig: { targetTag: 'hot' },
      actions: [
        {
          order: 1,
          actionType: 'update_lead_stage',
          config: { newStage: 'Hot Lead' },
        },
      ],
      isActive: true,
      status: 'active',
    });

    // Lead belongs to Workspace B
    const leadB = await Lead.create({
      name: 'Workspace B Lead',
      phone: '+919876543215',
      workspaceId: wsB._id,
      userId: userB._id,
      status: 'Fresh Lead',
      tags: [],
    });

    // Execute in context of Workspace B
    await AutomationEngine.executeTagAddedAutomations(leadB, 'hot', {
      workspaceId: wsB._id,
      user: userB,
    });

    // Rule A should NOT have touched leadB
    const unchangedLeadB = await Lead.findById(leadB._id);
    assert.strictEqual(unchangedLeadB.status, 'Fresh Lead', 'Workspace A rule must not modify Workspace B lead');

    const logs = await AutomationLog.find({ ruleId: ruleA._id });
    assert.strictEqual(logs.length, 0, 'Workspace A rule must not execute or log for Workspace B lead');
  });

  it('7. Plan limits: workspace exceeding maxAutomations cannot create active rule', async () => {
    // Set workspace plan limits mock via workspace
    await Workspace.findByIdAndUpdate(wsA._id, {
      $set: { 'limits.maxAutomations': 2 },
    });

    // Create 2 active rules
    await AutomationRule.create([
      {
        workspaceId: wsA._id,
        userId: userA._id,
        name: 'Rule 1',
        triggerType: 'lead_created',
        actions: [{ order: 1, actionType: 'add_lead_tag', config: { tagToAdd: 'r1' } }],
        status: 'active',
        isActive: true,
      },
      {
        workspaceId: wsA._id,
        userId: userA._id,
        name: 'Rule 2',
        triggerType: 'lead_created',
        actions: [{ order: 1, actionType: 'add_lead_tag', config: { tagToAdd: 'r2' } }],
        status: 'active',
        isActive: true,
      },
    ]);

    // Try creating a 3rd active rule via POST /api/automations
    const res = await api('POST', '/api/automations', {
      name: 'Rule 3 (Exceeds Limit)',
      triggerType: 'lead_created',
      status: 'active',
      isActive: true,
      actions: [{ order: 1, actionType: 'add_lead_tag', config: { tagToAdd: 'r3' } }],
    });

    assert.strictEqual(res.status, 403, 'Should reject creation with 403 Plan Limit Reached');
    assert.strictEqual(res.data.code, 'PLAN_LIMIT_REACHED');
  });

  it('8. Retry with dead-letter: failing execution log retried 3 times transitions to dead_letter', async () => {
    const rule = await AutomationRule.create({
      workspaceId: wsA._id,
      userId: userA._id,
      name: 'Failing Outreach Rule',
      triggerType: 'lead_created',
      actions: [{ order: 1, actionType: 'send_whatsapp', config: { whatsappMessage: 'Hi' } }],
      status: 'active',
      isActive: true,
    });

    const lead = await Lead.create({
      name: 'Retry Lead',
      phone: '+919876543216',
      workspaceId: wsA._id,
      userId: userA._id,
      status: 'Fresh Lead',
    });

    const log = await AutomationLog.create({
      ruleId: rule._id,
      ruleName: rule.name,
      workspaceId: wsA._id,
      userId: userA._id,
      leadId: lead._id,
      triggerType: 'lead_created',
      actionType: 'send_whatsapp',
      status: 'failed',
      retryCount: 2, // already retried twice
    });

    // 3rd retry via POST /api/automations/logs/:logId/retry
    const res = await api('POST', `/api/automations/logs/${log._id}/retry`);

    assert.strictEqual(res.status, 400, 'Retry should fail because WhatsApp is disconnected');
    assert.strictEqual(res.data.log.status, 'dead_letter', 'Status must transition to dead_letter on 3rd failure');
    assert.strictEqual(res.data.log.retryCount, 3);
  });
});
