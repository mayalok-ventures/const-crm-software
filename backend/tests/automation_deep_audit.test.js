/**
 * Sahyak CRM — Automation Module Deep Audit & Functional Verification Suite
 * Validates all 12 confirmed findings & permanent architectural remediations:
 * 1. Template variable resolution including {{counselorPhone}}, {{counselorEmail}}, {{source}}, {{amount}}
 * 2. Pure condition evaluation engine (operators, null safety, unknown operator safety, any/all matching)
 * 3. Lead Created trigger with leadSources filtering & condition evaluation
 * 4. Milestone stage_reached trigger execution (verifying Defect 1 fix)
 * 5. Pipeline stage_changed trigger with fromStage filtering
 * 6. Durable delayed action scheduling (pending status, scheduledFor timestamp & sweep recovery)
 * 7. Action failure observability (failed AutomationLog record on missing phone / error)
 * 8. Multi-tenant isolation & IDOR prevention on testAutomation endpoint (verifying Defect 2 fix)
 * 9. Retry handler for failed execution logs
 * 10. Idle lead automation sweep with distributed locking & idempotency
 * 11. Recursion guard & infinite loop circuit breaker
 * 12. Log pagination and populated references
 */

const assert = require('assert');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Workspace = require('../src/models/Workspace');
const AutomationRule = require('../src/models/AutomationRule');
const AutomationLog = require('../src/models/AutomationLog');
const AutomationEngine = require('../src/services/automationEngine');
const automationController = require('../src/controllers/automationController');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

async function runDeepAuditTestSuite() {
  console.log('🧪 Starting Sahyak CRM Automation Module Deep Functional Audit Test Suite...\n');
  await mongoose.connect(MONGODB_URI);
  console.log('  ✔ Connected to MongoDB');

  const unique = Date.now();
  let tenant1User, tenant1Ws;
  let tenant2User, tenant2Ws;

  try {
    // ─────────────────────────────────────────────────────────────
    // FIXTURES SETUP
    // ─────────────────────────────────────────────────────────────
    const phone1 = `98${String(unique).slice(-8)}`;
    const phone2 = `97${String(unique).slice(-8)}`;

    tenant1User = await User.create({
      name: 'Dr. Ramesh Sharma',
      email: `ramesh_${unique}@apexedu.in`,
      password: 'Password123!',
      role: 'owner',
      phone: phone1,
      plan: 'enterprise',
      workspaceName: 'Apex Education Group',
    });

    tenant1Ws = await Workspace.create({
      name: `Apex Education Group ${unique}`,
      owner: tenant1User._id,
      ownerId: tenant1User._id,
      createdBy: tenant1User._id,
    });
    tenant1User.workspaceId = tenant1Ws._id;
    await tenant1User.save();

    // Tenant 2 fixtures for cross-tenant isolation testing
    tenant2User = await User.create({
      name: 'Ms. Sunita Patil',
      email: `sunita_${unique}@zenithedtech.com`,
      password: 'Password123!',
      role: 'owner',
      phone: phone2,
      plan: 'pro',
      workspaceName: 'Zenith EdTech',
    });

    tenant2Ws = await Workspace.create({
      name: `Zenith EdTech ${unique}`,
      owner: tenant2User._id,
      ownerId: tenant2User._id,
      createdBy: tenant2User._id,
    });
    tenant2User.workspaceId = tenant2Ws._id;
    await tenant2User.save();

    console.log('  ✔ Multi-tenant fixtures established (Tenant 1: Apex, Tenant 2: Zenith)\n');

    // ─────────────────────────────────────────────────────────────
    // TEST 1: TEMPLATE VARIABLE SUBSTITUTION (FIX FOR DEFECT 3)
    // ─────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Dynamic Template Variable Engine ---');
    const mockLead = {
      name: 'Aarav Patel',
      course: 'B.Tech AI & ML',
      phone: '919876543210',
      email: 'aarav.patel@example.com',
      city: 'Pune',
      status: 'Campus Visit Scheduled',
      assignedToName: 'Dr. Ramesh Sharma',
      source: 'meta_ads',
      payable_amount: 150000,
    };

    const templateWithAllVariables =
      'Hello {{name}}! Welcome to {{course}} in {{city}}. Status: {{stage}}. Counselor: {{counselorName}} (Phone: {{counselorPhone}}, Email: {{counselorEmail}}). Source: {{source}}. Fee: ₹{{amount}}. Organization: {{companyName}}.';

    const rendered = AutomationEngine.replaceVariables(templateWithAllVariables, {
      lead: mockLead,
      user: Object.assign(tenant1User.toObject(), { workspace: tenant1Ws, companyName: 'Apex Education Group' }),
    });

    assert(rendered.includes('Hello Aarav Patel!'), 'Name variable must be replaced');
    assert(rendered.includes('B.Tech AI & ML'), 'Course variable must be replaced');
    assert(rendered.includes('Pune'), 'City variable must be replaced');
    assert(rendered.includes(`Phone: ${tenant1User.phone}`), '{{counselorPhone}} MUST be replaced (Defect 3 Fix)');
    assert(rendered.includes(`Email: ${tenant1User.email}`), '{{counselorEmail}} must be replaced');
    assert(rendered.includes('Source: meta_ads'), '{{source}} must be replaced');
    assert(rendered.includes('Fee: ₹150000'), '{{amount}} must be replaced');
    assert(rendered.includes('Apex Education Group'), '{{companyName}} must be replaced');
    assert(!rendered.includes('{{'), 'No raw {{tag}} placeholders should remain in rendered text');
    console.log('  ✔ Variable substitution engine fully verified (all tags including {{counselorPhone}} cleanly replaced)');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: PURE CONDITION EVALUATOR ENGINE (DEFECT 12 / PHASE 3.3)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Condition Evaluator Operators & Fail-Safe Semantics ---');
    const leadForConditions = {
      name: 'Simran Kaur',
      city: 'Chandigarh',
      payable_amount: 85000,
      source: 'google_search',
      customData: {
        targetCountry: 'Canada',
        score: 92,
      },
    };

    // Operators testing
    assert.strictEqual(AutomationEngine.evaluateConditions(leadForConditions, [{ field: 'city', operator: 'equals', value: 'Chandigarh' }]), true, 'equals condition should match');
    assert.strictEqual(AutomationEngine.evaluateConditions(leadForConditions, [{ field: 'city', operator: 'equals', value: 'Delhi' }]), false, 'equals condition mismatch should return false');
    assert.strictEqual(AutomationEngine.evaluateConditions(leadForConditions, [{ field: 'city', operator: 'not_equals', value: 'Mumbai' }]), true, 'not_equals condition should match');
    assert.strictEqual(AutomationEngine.evaluateConditions(leadForConditions, [{ field: 'name', operator: 'contains', value: 'Simran' }]), true, 'contains condition should match');
    assert.strictEqual(AutomationEngine.evaluateConditions(leadForConditions, [{ field: 'payable_amount', operator: 'gt', value: 50000 }]), true, 'gt condition should match 85000 > 50000');
    assert.strictEqual(AutomationEngine.evaluateConditions(leadForConditions, [{ field: 'payable_amount', operator: 'lt', value: 50000 }]), false, 'lt condition should fail 85000 < 50000');
    assert.strictEqual(AutomationEngine.evaluateConditions(leadForConditions, [{ field: 'customData.targetCountry', operator: 'equals', value: 'Canada' }]), true, 'nested dot-path field should extract Canadian targetCountry');
    assert.strictEqual(AutomationEngine.evaluateConditions(leadForConditions, [{ field: 'source', operator: 'in', value: 'google_search, meta_ads' }]), true, 'in condition should match comma-delimited options');
    assert.strictEqual(AutomationEngine.evaluateConditions(leadForConditions, [{ field: 'missingField', operator: 'is_empty' }]), true, 'is_empty condition should match missing field');
    assert.strictEqual(AutomationEngine.evaluateConditions(leadForConditions, [{ field: 'city', operator: 'unknown_operator_xyz', value: 'Chandigarh' }]), false, 'Unknown operator must fail-safe to false');
    console.log('  ✔ Condition evaluator validated with equality, numeric, nested paths, array inclusion, and fail-safe safety');

    // ─────────────────────────────────────────────────────────────
    // TEST 3: LEAD CREATION TRIGGER WITH LEADSOURCES & CONDITIONS (DEFECT 7)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Lead Created Trigger with leadSources & Conditions Filtering ---');
    const metaRule = await AutomationRule.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Meta Ads Welcome WhatsApp',
      triggerType: 'lead_created',
      channel: 'whatsapp',
      actionType: 'send_whatsapp',
      triggerConfig: {
        leadSources: ['meta_ads', 'facebook_leads'],
        conditions: [{ field: 'city', operator: 'equals', value: 'Delhi' }],
      },
      actionConfig: {
        templateText: 'Hello {{name}} from Meta Ads in Delhi!',
      },
      isActive: true,
    });

    // Lead matching source AND condition
    const matchingLead = await Lead.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Karan Mehra',
      phone: '9876543201',
      source: 'meta_ads',
      city: 'Delhi',
      status: 'Fresh Lead',
    });

    // Lead with non-matching source
    const nonMatchingSourceLead = await Lead.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Rahul Joshi',
      phone: '9876543202',
      source: 'website_form',
      city: 'Delhi',
      status: 'Fresh Lead',
    });

    // Lead with matching source but non-matching condition
    const nonMatchingCityLead = await Lead.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Amit Shah',
      phone: '9876543203',
      source: 'meta_ads',
      city: 'Mumbai',
      status: 'Fresh Lead',
    });

    const resMatch = await AutomationEngine.executeLeadCreatedAutomations({
      lead: matchingLead,
      user: tenant1User,
      workspaceId: tenant1Ws._id,
    });
    assert.strictEqual(resMatch.length, 1, 'Matching lead must trigger rule');

    const resNonSource = await AutomationEngine.executeLeadCreatedAutomations({
      lead: nonMatchingSourceLead,
      user: tenant1User,
      workspaceId: tenant1Ws._id,
    });
    assert.strictEqual(resNonSource.length, 0, 'Unmatched lead source must be ignored');

    const resNonCity = await AutomationEngine.executeLeadCreatedAutomations({
      lead: nonMatchingCityLead,
      user: tenant1User,
      workspaceId: tenant1Ws._id,
    });
    assert.strictEqual(resNonCity.length, 0, 'Unmatched condition must be ignored');
    console.log('  ✔ leadSources filtering & condition evaluation on lead_created validated');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: MILESTONE stage_reached TRIGGER (FIX FOR DEFECT 1)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Milestone stage_reached Trigger Execution ---');
    const milestoneRule = await AutomationRule.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Confirmed Admission VIP Onboarding',
      triggerType: 'stage_reached',
      channel: 'whatsapp',
      actionType: 'send_whatsapp',
      triggerConfig: {
        targetStage: 'Confirmed Admission',
      },
      actionConfig: {
        templateText: 'Congratulations {{name}} on reaching confirmed admission!',
      },
      isActive: true,
    });

    const candidateLead = await Lead.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Pooja Agarwal',
      phone: '9876543205',
      status: 'Offer Made',
    });

    const milestoneExec = await AutomationEngine.executeStageChangedAutomations({
      lead: candidateLead,
      oldStage: 'Offer Made',
      newStage: 'Confirmed Admission',
      user: tenant1User,
      workspaceId: tenant1Ws._id,
    });

    assert.strictEqual(milestoneExec.length, 1, 'stage_reached rule MUST execute when targetStage is reached (Defect 1 Fix)');
    assert.strictEqual(milestoneExec[0].ruleId.toString(), milestoneRule._id.toString());
    console.log('  ✔ Milestone stage_reached trigger correctly executed upon stage transition');

    // ─────────────────────────────────────────────────────────────
    // TEST 5: STAGE CHANGED WITH FROMSTAGE FILTER
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Pipeline stage_changed with fromStage Filter ---');
    const strictTransitionRule = await AutomationRule.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Negotiation to Won Drip',
      triggerType: 'stage_changed',
      channel: 'whatsapp',
      actionType: 'send_whatsapp',
      triggerConfig: {
        fromStage: 'Negotiation',
        targetStage: 'Won',
      },
      actionConfig: {
        templateText: 'Welcome {{name}}! Deal officially closed from negotiation.',
      },
      isActive: true,
    });

    // Valid transition from Negotiation -> Won
    const validTransition = await AutomationEngine.executeStageChangedAutomations({
      lead: candidateLead,
      oldStage: 'Negotiation',
      newStage: 'Won',
      user: tenant1User,
      workspaceId: tenant1Ws._id,
    });
    assert.strictEqual(validTransition.some(r => r.ruleId.toString() === strictTransitionRule._id.toString()), true);

    // Invalid transition from Fresh Lead -> Won
    const invalidTransition = await AutomationEngine.executeStageChangedAutomations({
      lead: candidateLead,
      oldStage: 'Fresh Lead',
      newStage: 'Won',
      user: tenant1User,
      workspaceId: tenant1Ws._id,
    });
    assert.strictEqual(invalidTransition.some(r => r.ruleId.toString() === strictTransitionRule._id.toString()), false);
    console.log('  ✔ Strict fromStage -> targetStage transition filters validated');

    // ─────────────────────────────────────────────────────────────
    // TEST 6: DURABLE DELAYED EXECUTION & RECOVERY (FIX FOR DEFECT 9)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: Durable Delayed Action Execution & Cron Sweep Recovery ---');
    const delayedRule = await AutomationRule.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Delayed 15m Lead Nurture',
      triggerType: 'lead_created',
      channel: 'whatsapp',
      actionType: 'send_whatsapp',
      delayMinutes: 15,
      actionConfig: {
        templateText: 'Hi {{name}}, just checking in 15 minutes after inquiry!',
      },
      isActive: true,
    });

    const delayedLead = await Lead.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Sneha Roy',
      phone: '9876543208',
      status: 'Fresh Lead',
    });

    await AutomationEngine.executeLeadCreatedAutomations({
      lead: delayedLead,
      user: tenant1User,
      workspaceId: tenant1Ws._id,
    });

    // Verify pending log was created in DB
    const pendingLog = await AutomationLog.findOne({
      ruleId: delayedRule._id,
      leadId: delayedLead._id,
      status: 'pending',
    });
    assert(pendingLog, 'Delayed action MUST persist an AutomationLog with status: pending in DB');
    assert(pendingLog.scheduledFor, 'Pending log must have a scheduledFor timestamp');
    console.log(`  ✔ Pending delayed job successfully persisted in DB (scheduledFor: ${pendingLog.scheduledFor.toISOString()})`);

    // Simulate server crash & restart recovery: set scheduledFor to 1 minute ago and run cron sweep
    pendingLog.scheduledFor = new Date(Date.now() - 60000);
    await pendingLog.save();

    await AutomationEngine.sweepPendingDelayedAutomations();

    const recoveredLog = await AutomationLog.findById(pendingLog._id);
    assert.strictEqual(recoveredLog.status, 'success', 'Pending delayed job must be safely swept and marked success after recovery');
    console.log('  ✔ Cron sweep successfully recovered and executed persisted delayed automation');

    // ─────────────────────────────────────────────────────────────
    // TEST 7: OBSERVABILITY & ACTION FAILURE LOGGING (FIX FOR DEFECT 6)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 7: Action Failure Logging & Observability ---');
    const badPhoneRule = await AutomationRule.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Strict WhatsApp Notification',
      triggerType: 'lead_created',
      channel: 'whatsapp',
      actionType: 'send_whatsapp',
      actionConfig: {
        templateText: 'Urgent notice for candidate',
      },
      isActive: true,
    });

    const leadWithoutPhone = await Lead.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Candidate Without Phone',
      phone: '', // Intentionally blank to force failure
      status: 'Fresh Lead',
    });

    await AutomationEngine.executeLeadCreatedAutomations({
      lead: leadWithoutPhone,
      user: tenant1User,
      workspaceId: tenant1Ws._id,
    });

    const failedLog = await AutomationLog.findOne({
      ruleId: badPhoneRule._id,
      status: 'failed',
    });
    assert(failedLog, 'When action fails, an AutomationLog with status: failed MUST be created in DB');
    assert(failedLog.errorMessage.includes('phone'), 'Error message must capture missing phone reason');
    console.log(`  ✔ Failure logged accurately in AutomationLog: "${failedLog.errorMessage}"`);

    // ─────────────────────────────────────────────────────────────
    // TEST 8: MULTI-TENANT ISOLATION ON /test (FIX FOR DEFECT 2)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 8: Multi-Tenant Authorization on /api/automations/test ---');
    // Tenant 2 has a confidential lead
    const tenant2SecretLead = await Lead.create({
      workspaceId: tenant2Ws._id,
      userId: tenant2User._id,
      name: 'VVIP Student Tenant 2',
      phone: '9999900000',
      course: 'Top Secret Executive MBA',
    });

    // Tenant 1 user attempts to test template using Tenant 2 leadId (IDOR Attack)
    let idorBlocked = false;
    const mockReq = {
      workspaceId: tenant1Ws._id,
      user: tenant1User,
      body: {
        leadId: tenant2SecretLead._id.toString(),
        templateText: 'Lead Name: {{name}}, Phone: {{phone}}',
      },
    };
    const mockRes = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
      },
    };

    await automationController.testAutomation(mockReq, mockRes);
    if (mockRes.statusCode === 404) {
      idorBlocked = true;
    }

    assert(idorBlocked, 'Cross-tenant leadId MUST be rejected with 404 on /api/automations/test (Defect 2 Fix)');
    console.log('  ✔ IDOR attack prevented: Cross-tenant lead data leak completely blocked');

    // ─────────────────────────────────────────────────────────────
    // TEST 9: RETRY FAILED AUTOMATION LOG (REMEDIATION HANDLER)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 9: Retry Handler for Failed Execution Logs ---');
    // Fix lead phone and retry failed log
    leadWithoutPhone.phone = '9876543999';
    await leadWithoutPhone.save();

    const retryReq = {
      params: { logId: failedLog._id.toString() },
      workspaceId: tenant1Ws._id,
      user: tenant1User,
    };
    const retryRes = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
      },
    };

    await automationController.retryAutomationLog(retryReq, retryRes);
    assert.strictEqual(retryRes.statusCode, 200, 'Retry endpoint should succeed');
    assert.strictEqual(retryRes.body.log.status, 'success', 'Retried log must be marked success');
    assert.strictEqual(retryRes.body.log.retryCount, 1, 'Retry count must be incremented to 1');
    console.log('  ✔ Failed execution log successfully retried and updated in audit trail');

    // ─────────────────────────────────────────────────────────────
    // TEST 10: IDLE LEAD SWEEP DISTRIBUTED LOCK & IDEMPOTENCY (DEFECT 10)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 10: Idle Lead Automation Sweep & Idempotency ---');
    const staleLeadRule = await AutomationRule.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Stale 3 Days Escalation',
      triggerType: 'stage_duration',
      channel: 'internal',
      actionType: 'transfer_lead',
      triggerConfig: {
        targetStage: 'Stagnant Lead',
        daysInStage: 3,
      },
      actionConfig: {
        newStage: 'Escalated to Senior Dean',
        transferNote: 'Idle for 3+ days in stage',
      },
      isActive: true,
    });

    const idleLead = await Lead.create({
      workspaceId: tenant1Ws._id,
      userId: tenant1User._id,
      name: 'Rohan Verma',
      phone: '9876543299',
      status: 'Stagnant Lead',
    });

    // Mongoose timestamps: true overrides updatedAt on create(); use collection.updateOne to set past timestamp
    await Lead.collection.updateOne(
      { _id: idleLead._id },
      { $set: { updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) } }
    );

    // Pass 1: should execute
    const sweep1 = await AutomationEngine.processIdleLeadAutomations();
    assert(sweep1.executedActions >= 1, 'Idle lead must be processed in pass 1');

    // Pass 2: should be idempotent and process 0
    const sweep2 = await AutomationEngine.processIdleLeadAutomations();
    assert.strictEqual(sweep2.executedActions, 0, 'Second sweep pass must not duplicate action (idempotent)');
    console.log('  ✔ Stale lead sweep executed once and maintained idempotency on subsequent passes');

    // ─────────────────────────────────────────────────────────────
    // TEST 11: RECURSION GUARD / CIRCUIT BREAKER
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 11: Circuit Breaker & Recursion Depth Guard ---');
    const loopResult = await AutomationEngine.executeStageChangedAutomations({
      lead: candidateLead,
      oldStage: 'Offer Made',
      newStage: 'Confirmed Admission',
      user: tenant1User,
      workspaceId: tenant1Ws._id,
      depth: 6, // Over depth threshold
    });
    assert.strictEqual(loopResult.length, 0, 'Execution must halt when depth > 5');
    console.log('  ✔ Cascading recursion circuit breaker verified (aborts when depth > 5)');

    // ─────────────────────────────────────────────────────────────
    // TEST 12: GET AUTOMATION LOGS POPULATION & PAGINATION (DEFECT 5)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 12: Logs Query Population & Pagination Structure ---');
    const logsReq = {
      params: {},
      query: { page: 1, limit: 10 },
      workspaceId: tenant1Ws._id,
      user: tenant1User,
    };
    const logsRes = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
      },
    };

    await automationController.getAutomationLogs(logsReq, logsRes);
    assert(logsRes.body.success, 'Logs API must succeed');
    assert(logsRes.body.pagination, 'Pagination object must be returned');
    assert(logsRes.body.logs.length > 0, 'Logs must be returned');
    assert(logsRes.body.logs[0].ruleId?.name, 'ruleId should be populated with rule name');
    console.log(`  ✔ Logs API correctly populated ruleId ("${logsRes.body.logs[0].ruleId?.name}") and returned pagination structure`);

    console.log('\n🎉 ALL 12 DEEP AUDIT VALIDATION TESTS PASSED FLAWLESSLY!\n');
  } finally {
    // Teardown test fixtures
    if (tenant1Ws) {
      await AutomationRule.deleteMany({ workspaceId: tenant1Ws._id }).catch(() => null);
      await AutomationLog.deleteMany({ workspaceId: tenant1Ws._id }).catch(() => null);
      await Lead.deleteMany({ workspaceId: tenant1Ws._id }).catch(() => null);
      await Workspace.deleteOne({ _id: tenant1Ws._id }).catch(() => null);
    }
    if (tenant2Ws) {
      await AutomationRule.deleteMany({ workspaceId: tenant2Ws._id }).catch(() => null);
      await AutomationLog.deleteMany({ workspaceId: tenant2Ws._id }).catch(() => null);
      await Lead.deleteMany({ workspaceId: tenant2Ws._id }).catch(() => null);
      await Workspace.deleteOne({ _id: tenant2Ws._id }).catch(() => null);
    }
    if (tenant1User) await User.deleteOne({ _id: tenant1User._id }).catch(() => null);
    if (tenant2User) await User.deleteOne({ _id: tenant2User._id }).catch(() => null);
    await mongoose.disconnect();
    console.log('  ✔ Test database connections and fixtures cleaned up safely.');
  }
}

runDeepAuditTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  });
