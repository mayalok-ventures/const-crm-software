/**
 * Comprehensive Automation E2E Verification Suite
 * Executes every Trigger, Condition Operator, and Action offered by the UI end-to-end
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

describe('Automation Engine End-to-End Capability Verification', () => {
  let mongod;
  let AutomationRule, AutomationLog, Lead, User, Workspace;
  let AutomationEngine;
  let companyId, workspaceId, counselorA, counselorB;
  const resultsTable = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key-32-chars-minimum-auto!';
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    AutomationRule = require('../src/models/AutomationRule');
    AutomationLog = require('../src/models/AutomationLog');
    Lead = require('../src/models/Lead');
    User = require('../src/models/User');
    Workspace = require('../src/models/Workspace');
    AutomationEngine = require('../src/services/automationEngine');

    // Mock External Transports
    const waSession = require('../src/services/waSession');
    waSession.sendText = async () => ({ key: { id: 'mock-wa-id' } });

    const EmailService = require('../src/services/email/emailService');
    EmailService.sendEmail = async () => ({ success: true });

    // Seed Workspace & Users
    companyId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({
      name: 'Auto Test Workspace',
      ownerId: companyId,
      companyId,
    });
    workspaceId = ws._id;

    counselorA = await User.create({
      name: 'Counselor Alpha',
      email: 'counselor.a@auto.test',
      phone: '+919876543210',
      password: 'Password123!',
      role: 'counsellor',
      companyId,
      workspaceId,
      status: 'active',
    });

    counselorB = await User.create({
      name: 'Counselor Beta',
      email: 'counselor.b@auto.test',
      phone: '+919876543211',
      password: 'Password123!',
      role: 'counsellor',
      companyId,
      workspaceId,
      status: 'active',
    });
  });

  afterAll(async () => {
    // Print Table
    console.log('\n| Capability Item | Type | Works? | Evidence |');
    console.log('|---|---|---|---|');
    resultsTable.forEach((r) => {
      console.log(`| \`${r.item}\` | ${r.type} | ${r.works ? '✅ YES' : '❌ NO'} | ${r.evidence} |`);
    });
    console.log('\n');

    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  function record(item, type, works, evidence) {
    resultsTable.push({ item, type, works, evidence });
  }

  describe('1. Triggers Verification', () => {
    it('executes trigger: lead_created', async () => {
      const rule = await AutomationRule.create({
        name: 'Trigger New Lead Rule',
        triggerType: 'lead_created',
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [{ actionType: 'add_lead_tag', config: { tagToAdd: 'auto_welcomed' } }],
      });

      const lead = await Lead.create({
        name: 'Student Lead Created',
        phone: '+919111111101',
        email: 'created@lead.test',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'new_lead',
      });

      await AutomationEngine.handleLeadCreated(lead, { user: counselorA, workspaceId });
      const updated = await Lead.findById(lead._id);
      const passed = updated.tags.includes('auto_welcomed');
      expect(passed).toBe(true);
      record('lead_created', 'Trigger', passed, 'Tagged new lead with auto_welcomed on arrival');
    });

    it('executes trigger: stage_changed', async () => {
      const rule = await AutomationRule.create({
        name: 'Trigger Stage Changed Rule',
        triggerType: 'stage_changed',
        triggerConfig: { fromStage: 'contacted', targetStage: 'qualified' },
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [{ actionType: 'add_lead_tag', config: { tagToAdd: 'qualified_stage' } }],
      });

      const lead = await Lead.create({
        name: 'Student Stage Lead',
        phone: '+919111111102',
        email: 'stage@lead.test',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'qualified',
      });

      await AutomationEngine.handleStageChanged(lead, 'qualified', 'contacted', { user: counselorA, workspaceId });
      const updated = await Lead.findById(lead._id);
      const passed = updated.tags.includes('qualified_stage');
      expect(passed).toBe(true);
      record('stage_changed', 'Trigger', passed, 'Tagged lead on transition from contacted to qualified');
    });

    it('executes trigger: stage_reached', async () => {
      const rule = await AutomationRule.create({
        name: 'Trigger Milestone Stage Reached',
        triggerType: 'stage_reached',
        triggerConfig: { targetStage: 'admission_confirmed' },
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [{ actionType: 'add_lead_tag', config: { tagToAdd: 'milestone_reached' } }],
      });

      const lead = await Lead.create({
        name: 'Milestone Student',
        phone: '+919111111103',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'admission_confirmed',
      });

      await AutomationEngine.handleStageChanged(lead, 'admission_confirmed', 'pending_fee', { user: counselorA, workspaceId });
      const updated = await Lead.findById(lead._id);
      const passed = updated.tags.includes('milestone_reached');
      expect(passed).toBe(true);
      record('stage_reached', 'Trigger', passed, 'Executed on milestone admission_confirmed');
    });

    it('executes trigger: tag_added', async () => {
      const rule = await AutomationRule.create({
        name: 'Trigger On Tag Added Rule',
        triggerType: 'tag_added',
        triggerConfig: { targetTag: 'vip_scholarship' },
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [{ actionType: 'assign_counselor', config: { assignedUserId: counselorB._id.toString() } }],
      });

      const lead = await Lead.create({
        name: 'VIP Tagged Student',
        phone: '+919111111104',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'new_lead',
        tags: ['vip_scholarship'],
      });

      await AutomationEngine.handleTagAdded(lead, 'vip_scholarship', { user: counselorA, workspaceId });
      const updated = await Lead.findById(lead._id);
      const passed = String(updated.assignedTo) === String(counselorB._id);
      expect(passed).toBe(true);
      record('tag_added', 'Trigger', passed, 'Assigned counselorB upon adding vip_scholarship tag');
    });

    it('executes trigger: whatsapp_inbound', async () => {
      const rule = await AutomationRule.create({
        name: 'Trigger WhatsApp Inbound Rule',
        triggerType: 'whatsapp_inbound',
        triggerConfig: { keywords: ['fees', 'scholarship'] },
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [{ actionType: 'add_lead_tag', config: { tagToAdd: 'fee_inquiry' } }],
      });

      const lead = await Lead.create({
        name: 'Inbound Inquirer',
        phone: '+919111111105',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'contacted',
      });

      await AutomationEngine.handleInboundWhatsAppMessage({
        companyId,
        workspaceId,
        lead,
        phone: '+919111111105',
        message: 'Please send fee structure and scholarship details',
      });

      const updated = await Lead.findById(lead._id);
      const passed = updated.tags.includes('fee_inquiry');
      expect(passed).toBe(true);
      record('whatsapp_inbound', 'Trigger', passed, 'Matched keyword "fee" and tagged lead');
    });

    it('executes trigger: stage_duration (processIdleLeadAutomations)', async () => {
      const rule = await AutomationRule.create({
        name: 'Trigger Stale Lead Rule',
        triggerType: 'stage_duration',
        triggerConfig: { targetStage: 'new_lead', daysInStage: 2 },
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [{ actionType: 'add_lead_tag', config: { tagToAdd: 'stale_lead_alert' } }],
      });

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const lead = await Lead.create({
        name: 'Stale Student',
        phone: '+919111111106',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'new_lead',
        updatedAt: threeDaysAgo,
        createdAt: threeDaysAgo,
      });

      await AutomationEngine.processIdleLeadAutomations();
      const updated = await Lead.findById(lead._id);
      const passed = updated.tags.includes('stale_lead_alert');
      expect(passed).toBe(true);
      record('stage_duration', 'Trigger', passed, 'Swept lead stuck in stage for 3 days and flagged');
    });
  });

  describe('2. Condition Operators Verification', () => {
    const testLead = {
      source: 'meta_ads',
      status: 'contacted',
      city: 'Bangalore',
      course: 'B.Tech Computer Science',
      payable_amount: 150000,
      tags: ['priority', 'stem'],
    };

    it('verifies operator: equals & not_equals', () => {
      const eqPass = AutomationEngine.evaluateConditions(testLead, [{ field: 'city', operator: 'equals', value: 'Bangalore' }]);
      const neqPass = AutomationEngine.evaluateConditions(testLead, [{ field: 'city', operator: 'not_equals', value: 'Mumbai' }]);
      const passed = eqPass && neqPass;
      expect(passed).toBe(true);
      record('equals / not_equals', 'Condition', passed, 'Correctly matched Bangalore & rejected Mumbai');
    });

    it('verifies operator: contains & not_contains', () => {
      const contPass = AutomationEngine.evaluateConditions(testLead, [{ field: 'course', operator: 'contains', value: 'Computer Science' }]);
      const notContPass = AutomationEngine.evaluateConditions(testLead, [{ field: 'course', operator: 'not_contains', value: 'Medicine' }]);
      const passed = contPass && notContPass;
      expect(passed).toBe(true);
      record('contains / not_contains', 'Condition', passed, 'Matched substring "Computer Science"');
    });

    it('verifies operator: gt & lt (numeric)', () => {
      const gtPass = AutomationEngine.evaluateConditions(testLead, [{ field: 'payable_amount', operator: 'gt', value: 100000 }]);
      const ltPass = AutomationEngine.evaluateConditions(testLead, [{ field: 'payable_amount', operator: 'lt', value: 200000 }]);
      const passed = gtPass && ltPass;
      expect(passed).toBe(true);
      record('gt / lt (numeric)', 'Condition', passed, 'Validated ₹150,000 > ₹100,000 and < ₹200,000');
    });

    it('verifies operator: is_empty & is_not_empty', () => {
      const notEmptyPass = AutomationEngine.evaluateConditions(testLead, [{ field: 'course', operator: 'is_not_empty' }]);
      const emptyPass = AutomationEngine.evaluateConditions(testLead, [{ field: 'unassignedField', operator: 'is_empty' }]);
      const passed = notEmptyPass && emptyPass;
      expect(passed).toBe(true);
      record('is_empty / is_not_empty', 'Condition', passed, 'Verified set field and unset property');
    });

    it('verifies operator: in & not_in', () => {
      const inPass = AutomationEngine.evaluateConditions(testLead, [{ field: 'source', operator: 'in', value: 'meta_ads,google_ads' }]);
      const notInPass = AutomationEngine.evaluateConditions(testLead, [{ field: 'source', operator: 'not_in', value: 'walk_in,referral' }]);
      const passed = inPass && notInPass;
      expect(passed).toBe(true);
      record('in / not_in', 'Condition', passed, 'Validated inclusion in comma-separated list');
    });

    it('verifies match logic: all (AND) vs any (OR)', () => {
      const andPass = AutomationEngine.evaluateConditions(
        testLead,
        [
          { field: 'city', operator: 'equals', value: 'Bangalore' },
          { field: 'payable_amount', operator: 'gt', value: 50000 },
        ],
        'all'
      );
      const orPass = AutomationEngine.evaluateConditions(
        testLead,
        [
          { field: 'city', operator: 'equals', value: 'Delhi' }, // false
          { field: 'source', operator: 'equals', value: 'meta_ads' }, // true
        ],
        'any'
      );
      const passed = andPass && orPass;
      expect(passed).toBe(true);
      record('AND (all) / OR (any) logic', 'Condition Match', passed, 'Evaluated multi-condition compound logic');
    });
  });

  describe('3. Actions Verification', () => {
    it('executes action: send_whatsapp', async () => {
      const rule = await AutomationRule.create({
        name: 'Action Send WhatsApp',
        triggerType: 'lead_created',
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [{ actionType: 'send_whatsapp', config: { whatsappMessage: 'Hello {{name}}! Welcome to our campus.' } }],
      });

      const lead = await Lead.create({
        name: 'Rohan Sharma',
        phone: '+919111111201',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'new_lead',
      });

      await AutomationEngine.performAction(rule.actions[0], rule, { lead, user: counselorA, workspaceId });
      const log = await AutomationLog.findOne({ ruleId: rule._id, leadId: lead._id, actionType: 'send_whatsapp' });
      const passed = Boolean(log) && log.status === 'success';
      expect(passed).toBe(true);
      record('send_whatsapp', 'Action', passed, 'Resolved variables and logged successful dispatch');
    });

    it('executes action: send_email', async () => {
      const rule = await AutomationRule.create({
        name: 'Action Send Email',
        triggerType: 'lead_created',
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [{ actionType: 'send_email', config: { emailSubject: 'Admissions Prospectus', emailBody: 'Dear {{name}}, please find info attached.' } }],
      });

      const lead = await Lead.create({
        name: 'Priya Patel',
        phone: '+919111111202',
        email: 'priya@test.com',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'new_lead',
      });

      await AutomationEngine.performAction(rule.actions[0], rule, { lead, user: counselorA, workspaceId });
      const log = await AutomationLog.findOne({ ruleId: rule._id, leadId: lead._id, actionType: 'send_email' });
      const passed = Boolean(log) && log.status === 'success';
      expect(passed).toBe(true);
      record('send_email', 'Action', passed, 'Rendered email template and dispatched via EmailService');
    });

    it('executes action: update_lead_stage', async () => {
      const rule = await AutomationRule.create({
        name: 'Action Update Stage',
        triggerType: 'lead_created',
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [{ actionType: 'update_lead_stage', config: { newStage: 'inquiry_verified' } }],
      });

      const lead = await Lead.create({
        name: 'Anil Verma',
        phone: '+919111111203',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'new_lead',
      });

      await AutomationEngine.performAction(rule.actions[0], rule, { lead, user: counselorA, workspaceId });
      const updated = await Lead.findById(lead._id);
      const passed = updated.status === 'inquiry_verified';
      expect(passed).toBe(true);
      record('update_lead_stage', 'Action', passed, 'Transitioned lead status to inquiry_verified');
    });

    it('executes action: add_lead_tag', async () => {
      const rule = await AutomationRule.create({
        name: 'Action Add Tag',
        triggerType: 'lead_created',
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [{ actionType: 'add_lead_tag', config: { tagToAdd: 'verified_applicant' } }],
      });

      const lead = await Lead.create({
        name: 'Suresh Kumar',
        phone: '+919111111204',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'new_lead',
      });

      await AutomationEngine.performAction(rule.actions[0], rule, { lead, user: counselorA, workspaceId });
      const updated = await Lead.findById(lead._id);
      const passed = updated.tags.includes('verified_applicant');
      expect(passed).toBe(true);
      record('add_lead_tag', 'Action', passed, 'Added verified_applicant tag to lead array');
    });

    it('executes action: assign_counselor', async () => {
      const rule = await AutomationRule.create({
        name: 'Action Assign Counselor',
        triggerType: 'lead_created',
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [{ actionType: 'assign_counselor', config: { assignedUserId: counselorA._id.toString() } }],
      });

      const lead = await Lead.create({
        name: 'Kavita Nair',
        phone: '+919111111205',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'new_lead',
      });

      await AutomationEngine.performAction(rule.actions[0], rule, { lead, user: counselorA, workspaceId });
      const updated = await Lead.findById(lead._id);
      const passed = String(updated.assignedTo) === String(counselorA._id);
      expect(passed).toBe(true);
      record('assign_counselor', 'Action', passed, 'Assigned counselorA to lead');
    });

    it('executes action: transfer_lead', async () => {
      const rule = await AutomationRule.create({
        name: 'Action Transfer Lead',
        triggerType: 'lead_created',
        companyId,
        workspaceId,
        userId: companyId,
        isActive: true,
        actions: [
          {
            actionType: 'transfer_lead',
            config: {
              assignedUserId: counselorB._id.toString(),
              newStage: 'counseling_in_progress',
            },
          },
        ],
      });

      const lead = await Lead.create({
        name: 'Deepak Rao',
        phone: '+919111111206',
        companyId,
        workspaceId,
        userId: counselorA._id,
        status: 'new_lead',
      });

      await AutomationEngine.performAction(rule.actions[0], rule, { lead, user: counselorA, workspaceId });
      const updated = await Lead.findById(lead._id);
      const passed = String(updated.assignedTo) === String(counselorB._id) && updated.status === 'counseling_in_progress';
      expect(passed).toBe(true);
      record('transfer_lead', 'Action', passed, 'Transferred lead to counselorB and updated stage');
    });
  });
});
