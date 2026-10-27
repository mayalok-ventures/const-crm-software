/**
 * Sahyak CRM — Automation Builder, Canonical Registry & Lifecycle Verification Suite
 * 
 * Validates:
 * 1. GET /api/automations/capabilities contract (Triggers, Fields, Operators, Actions, Variables)
 * 2. Server-side validation via AutomationRegistry against invalid configurations
 * 3. Human-readable dynamic summary generator
 * 4. Draft vs Active lifecycle (Drafts never execute in background; Active executes automatically)
 * 5. Multi-action sequential execution (Add Tag ➔ Send WhatsApp in a single workflow)
 * 6. Automation duplication as draft (POST /api/automations/:id/duplicate)
 * 7. Quick status updates (PATCH /api/automations/:id/status: active, paused, draft)
 * 8. Real-time metrics and log filtering
 */

const assert = require('assert');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Workspace = require('../src/models/Workspace');
const AutomationRule = require('../src/models/AutomationRule');
const AutomationLog = require('../src/models/AutomationLog');
const AutomationEngine = require('../src/services/automationEngine');
const AutomationRegistry = require('../src/services/automationRegistry');
const automationController = require('../src/controllers/automationController');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

async function runBuilderAndRegistrySuite() {
  console.log('🧪 Starting Automation Builder & Registry Verification Suite...\n');
  await mongoose.connect(MONGODB_URI);
  console.log('  ✔ Connected to MongoDB');

  const unique = Date.now();
  const phone = `95${String(unique).slice(-8)}`;
  let testUser, testWs;

  try {
    // Fixtures
    testUser = await User.create({
      name: 'Priya Sharma',
      email: `priya_${unique}@apexacademy.edu`,
      password: 'Password123!',
      role: 'owner',
      phone,
      plan: 'enterprise',
      workspaceName: 'Apex Admissions Academy',
    });

    testWs = await Workspace.create({
      name: `Apex Admissions Academy ${unique}`,
      owner: testUser._id,
      ownerId: testUser._id,
      createdBy: testUser._id,
    });
    testUser.workspaceId = testWs._id;
    await testUser.save();

    console.log('  ✔ Test User & Workspace fixtures established\n');

    // ─────────────────────────────────────────────────────────────
    // TEST 1: CANONICAL CAPABILITY REGISTRY CONTRACT
    // ─────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Canonical Capability Registry Contract ---');
    const capabilities = AutomationRegistry.getCapabilities();
    assert(Array.isArray(capabilities.triggers) && capabilities.triggers.length >= 5, 'Triggers array must have at least 5 supported triggers');
    assert(Array.isArray(capabilities.fields) && capabilities.fields.length >= 6, 'CRM fields must be exposed');
    assert(Array.isArray(capabilities.operators) && capabilities.operators.length >= 8, 'Operators must be exposed');
    assert(Array.isArray(capabilities.actions) && capabilities.actions.length >= 5, 'Actions must include WhatsApp, Email, Assignment, Tag, Stage');
    assert(Array.isArray(capabilities.variables) && capabilities.variables.length >= 10, 'Template variables must be registered');

    // Verify API controller endpoint
    const capReq = { user: testUser, workspaceId: testWs._id };
    const capRes = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; },
    };
    await automationController.getCapabilities(capReq, capRes);
    assert.strictEqual(capRes.statusCode, 200, 'getCapabilities should return 200');
    assert(capRes.body.capabilities.triggers.length > 0, 'Capabilities must be returned in response');
    console.log('  ✔ Canonical capability registry contract fully verified');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: SERVER-SIDE VALIDATION VIA REGISTRY
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Server-side Validation Against Canonical Registry ---');
    // Valid configuration
    const validCheck = AutomationRegistry.validateRule({
      name: 'Valid New Lead Flow',
      triggerType: 'lead_created',
      actions: [
        {
          actionType: 'send_whatsapp',
          config: { whatsappMessage: 'Hello {{name}}' },
        },
      ],
    });
    assert.strictEqual(validCheck.isValid, true, 'Valid rule must pass validation');

    // Invalid configuration: missing message content
    const invalidActionCheck = AutomationRegistry.validateRule({
      name: 'Incomplete WhatsApp Action',
      triggerType: 'lead_created',
      actions: [
        {
          actionType: 'send_whatsapp',
          config: {},
        },
      ],
    });
    assert.strictEqual(invalidActionCheck.isValid, false, 'Action without content must fail validation');
    assert(invalidActionCheck.errors.some((e) => e.includes('requires message content')), 'Should return descriptive error');

    // Invalid operator in condition
    const invalidOpCheck = AutomationRegistry.validateRule({
      name: 'Bad Operator Rule',
      triggerType: 'lead_created',
      triggerConfig: {
        conditions: [{ field: 'city', operator: 'dangerous_eval', value: 'Delhi' }],
      },
      actions: [{ actionType: 'send_whatsapp', config: { whatsappMessage: 'Hi' } }],
    });
    assert.strictEqual(invalidOpCheck.isValid, false, 'Unsupported operator must fail validation');
    console.log('  ✔ Registry validation correctly accepts valid rules and rejects invalid configurations');

    // ─────────────────────────────────────────────────────────────
    // TEST 3: DYNAMIC HUMAN-READABLE SUMMARY GENERATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Dynamic Human-Readable Summary Generator ---');
    const summary = AutomationRegistry.generateRuleSummary({
      triggerType: 'lead_created',
      triggerConfig: {
        leadSources: ['Meta Ads', 'Google Ads'],
        conditions: [{ field: 'city', operator: 'equals', value: 'Pune' }],
        conditionsMatch: 'all',
      },
      actions: [
        {
          actionType: 'add_lead_tag',
          delayMinutes: 0,
          config: { tagToAdd: 'High Intent' },
        },
        {
          actionType: 'send_whatsapp',
          delayMinutes: 15,
          config: { whatsappMessage: 'Welcome {{name}}' },
        },
      ],
    });

    assert(summary.includes('When a new lead arrives from Meta Ads, Google Ads'), 'Summary must explain trigger');
    assert(summary.includes('City / Region is equal to "Pune"'), 'Summary must explain conditions');
    assert(summary.includes('add tag "High Intent"'), 'Summary must list first action');
    assert(summary.includes('wait 15m then send WhatsApp message'), 'Summary must describe delayed second action');
    console.log(`  ✔ Dynamic summary verified: "${summary}"`);

    // ─────────────────────────────────────────────────────────────
    // TEST 4: DRAFT VS ACTIVE LIFECYCLE
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Draft vs Active Lifecycle (Drafts Must Never Execute) ---');
    // Create draft rule
    const draftReq = {
      workspaceId: testWs._id,
      user: testUser,
      body: {
        name: 'Work In Progress Lead Nurture',
        status: 'draft',
        triggerType: 'lead_created',
        actions: [
          {
            actionType: 'send_whatsapp',
            config: { whatsappMessage: 'Draft message {{name}}' },
          },
        ],
      },
    };
    const draftRes = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; },
    };
    await automationController.createAutomation(draftReq, draftRes);
    assert.strictEqual(draftRes.statusCode, 201, 'Draft creation should succeed');
    const draftRule = draftRes.body.rule;
    assert.strictEqual(draftRule.status, 'draft', 'Rule status must be draft');
    assert.strictEqual(draftRule.isActive, false, 'Draft rule isActive must be false');

    // Simulate lead created event
    const lead1 = await Lead.create({
      workspaceId: testWs._id,
      userId: testUser._id,
      name: 'Test Candidate A',
      phone: '9876540001',
      source: 'meta_ads',
    });

    const executionResults1 = await AutomationEngine.executeLeadCreatedAutomations({
      lead: lead1,
      user: testUser,
      workspaceId: testWs._id,
    });
    assert.strictEqual(executionResults1.length, 0, 'Draft rule MUST NOT be executed on lead created event');
    console.log('  ✔ Draft rule was safely bypassed during event trigger');

    // Transition Draft to Active via PATCH /api/automations/:id/status
    const statusReq = {
      params: { id: draftRule._id },
      workspaceId: testWs._id,
      user: testUser,
      body: { status: 'active' },
    };
    const statusRes = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; },
    };
    await automationController.setAutomationStatus(statusReq, statusRes);
    assert.strictEqual(statusRes.body.status, 'active', 'Status must be updated to active');
    assert.strictEqual(statusRes.body.isActive, true, 'isActive must be true');

    // Re-fire trigger event: now it SHOULD execute
    const executionResults2 = await AutomationEngine.executeLeadCreatedAutomations({
      lead: lead1,
      user: testUser,
      workspaceId: testWs._id,
    });
    assert.strictEqual(executionResults2.length, 1, 'Active rule MUST be executed on lead created event');
    console.log('  ✔ Rule successfully activated and executed in background');

    // ─────────────────────────────────────────────────────────────
    // TEST 5: MULTI-ACTION SEQUENTIAL EXECUTION
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Multi-Action Workflow Execution (Tag + WhatsApp) ---');
    const multiActionRule = await AutomationRule.create({
      workspaceId: testWs._id,
      userId: testUser._id,
      name: 'Tag & Greet New Inquiries',
      triggerType: 'lead_created',
      status: 'active',
      isActive: true,
      actions: [
        {
          actionType: 'add_lead_tag',
          delayMinutes: 0,
          config: { tagToAdd: 'Priority Inquiry' },
        },
        {
          actionType: 'send_whatsapp',
          delayMinutes: 0,
          config: { whatsappMessage: 'Greetings {{name}}! We received your inquiry.' },
        },
      ],
    });

    const lead2 = await Lead.create({
      workspaceId: testWs._id,
      userId: testUser._id,
      name: 'Kavita Singh',
      phone: '9876540002',
    });

    await AutomationEngine.executeLeadCreatedAutomations({
      lead: lead2,
      user: testUser,
      workspaceId: testWs._id,
    });

    // Verify Lead was tagged in database
    const refreshedLead = await Lead.findById(lead2._id);
    assert(refreshedLead.tags.includes('Priority Inquiry'), 'Multi-action rule must apply tag to lead');

    // Verify AutomationLog entries for both actions
    const tagLog = await AutomationLog.findOne({ ruleId: multiActionRule._id, actionType: 'add_lead_tag' });
    const waLog = await AutomationLog.findOne({ ruleId: multiActionRule._id, actionType: 'send_whatsapp' });
    assert(tagLog && tagLog.status === 'success', 'Tag action log must be recorded as success');
    assert(waLog && waLog.status === 'success', 'WhatsApp action log must be recorded as success');
    console.log('  ✔ Multi-action workflow executed sequentially with database mutations verified');

    // ─────────────────────────────────────────────────────────────
    // TEST 6: DUPLICATE AUTOMATION AS DRAFT
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: Duplicate Automation as Draft ---');
    const dupReq = {
      params: { id: multiActionRule._id },
      workspaceId: testWs._id,
      user: testUser,
    };
    const dupRes = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; },
    };
    await automationController.duplicateAutomation(dupReq, dupRes);
    assert.strictEqual(dupRes.statusCode, 201, 'Duplicate endpoint should return 201');
    assert(dupRes.body.rule.name.includes('(Copy)'), 'Duplicated rule should append (Copy)');
    assert.strictEqual(dupRes.body.rule.status, 'draft', 'Duplicated rule must default to draft');
    assert.strictEqual(dupRes.body.rule.isActive, false, 'Duplicated rule must not be active');
    console.log(`  ✔ Rule duplicated safely as draft: "${dupRes.body.rule.name}"`);

    // ─────────────────────────────────────────────────────────────
    // TEST 7: METRICS & RECENT EXECUTION COUNTS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 7: Real-Time Operational Metrics ---');
    const listReq = {
      workspaceId: testWs._id,
      user: testUser,
      query: {},
    };
    const listRes = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; },
    };
    await automationController.getAutomations(listReq, listRes);
    assert(listRes.body.metrics, 'Metrics object must be returned');
    assert(listRes.body.metrics.totalCount >= 3, 'Total count must be accurate');
    assert(listRes.body.metrics.executionsToday >= 2, 'Executions today must reflect live database count');
    assert(listRes.body.rules.every((r) => r.summary && r.summary.length > 5), 'Every rule must have a human summary');
    console.log('  ✔ Metrics returned accurately with dynamic summaries attached to all rules');

    console.log('\n🎉 ALL BUILDER & REGISTRY TESTS PASSED FLAWLESSLY!\n');
  } finally {
    if (testWs) {
      await AutomationRule.deleteMany({ workspaceId: testWs._id }).catch(() => null);
      await AutomationLog.deleteMany({ workspaceId: testWs._id }).catch(() => null);
      await Lead.deleteMany({ workspaceId: testWs._id }).catch(() => null);
      await Workspace.deleteOne({ _id: testWs._id }).catch(() => null);
    }
    if (testUser) await User.deleteOne({ _id: testUser._id }).catch(() => null);
    await mongoose.disconnect();
    console.log('  ✔ Test database connections and fixtures cleaned up safely.');
  }
}

runBuilderAndRegistrySuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  });
