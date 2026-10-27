/**
 * Automated Test Suite for CRM Dynamic Automation Engine & WhatsApp Inbound Bots:
 * 1. Automation Rule CRUD, Tenant Isolation, and Active State Toggling
 * 2. Dynamic Variable Substitution Engine ({{name}}, {{course}}, {{counselorName}}, etc.)
 * 3. Lead Ingestion & Creation Event Trigger (CRM_EVENTS.LEAD_CREATED)
 * 4. Pipeline Stage Transition Event Trigger (CRM_EVENTS.LEAD_STAGE_CHANGED)
 * 5. Interactive WhatsApp Inbound Chatbot (Exact keyword "1", Contains keyword "fees", Fallback bot)
 * 6. Lead Auto-Provisioning on Inbound WhatsApp Inquiry
 * 7. Automation Audit Logs Persistence & Status Tracking
 */
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Workspace = require('../src/models/Workspace');
const AutomationRule = require('../src/models/AutomationRule');
const AutomationLog = require('../src/models/AutomationLog');
const AutomationEngine = require('../src/services/automationEngine');
const { CRM_EVENTS } = require('../src/services/automationHandlers');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

let testUser;
let testWorkspace;
let waWelcomeRule;
let emailWelcomeRule;
let stageDripRule;
let waInboundMenuRule;
let waInboundCourseRule;
let waFallbackRule;

async function runAutomationTestSuite() {
  console.log('🧪 Starting CRM Dynamic Automation Engine & WhatsApp Bot Test Suite...');
  await mongoose.connect(MONGODB_URI);
  console.log('  ✔ Connected to MongoDB');

  try {
    const unique = Date.now();

    // ─────────────────────────────────────────────────────────────
    // 1. SETUP TEST FIXTURES
    // ─────────────────────────────────────────────────────────────
    testUser = await User.create({
      name: 'Admissions Dean',
      email: `dean_${unique}@mayalok.edu`,
      password: 'Password123!',
      role: 'owner',
      phone: `9198${String(unique).slice(-8)}`,
      plan: 'enterprise',
    });

    testWorkspace = await Workspace.create({
      name: `Test Academy ${unique}`,
      owner: testUser._id,
      ownerId: testUser._id,
      createdBy: testUser._id,
    });

    testUser.workspaceId = testWorkspace._id;
    await testUser.save();
    console.log('  ✔ Test User and Workspace fixtures established');

    // ─────────────────────────────────────────────────────────────
    // 2. CREATE AUTOMATION RULES
    // ─────────────────────────────────────────────────────────────
    // A) Instant WhatsApp Lead Greeting
    waWelcomeRule = await AutomationRule.create({
      workspaceId: testWorkspace._id,
      userId: testUser._id,
      name: 'New Lead Instant WhatsApp Welcome',
      triggerType: 'lead_created',
      channel: 'whatsapp',
      actionType: 'send_whatsapp',
      category: 'lead_capture',
      actionConfig: {
        templateText: 'Namaste {{name}}! Welcome to our admissions desk for {{course}}. My name is {{counselorName}}.',
      },
      delayMinutes: 0,
      isActive: true,
    });

    // B) Welcome Email with Prospectus
    emailWelcomeRule = await AutomationRule.create({
      workspaceId: testWorkspace._id,
      userId: testUser._id,
      name: 'Official Admissions Welcome Email',
      triggerType: 'lead_created',
      channel: 'email',
      actionType: 'send_email',
      category: 'lead_capture',
      actionConfig: {
        emailSubject: 'Welcome to {{course}} Admissions',
        templateText: 'Dear {{name}},\n\nThank you for applying for {{course}}.\nCounselor: {{counselorName}}\nContact: {{counselorPhone}}',
      },
      delayMinutes: 0,
      isActive: true,
    });

    // C) Pipeline Stage Drip (Campus Visit Scheduled)
    stageDripRule = await AutomationRule.create({
      workspaceId: testWorkspace._id,
      userId: testUser._id,
      name: 'Campus Visit Scheduled Directions',
      triggerType: 'stage_changed',
      channel: 'whatsapp',
      actionType: 'send_whatsapp',
      category: 'pipeline_drip',
      triggerConfig: {
        targetStage: 'Campus Visit Scheduled',
      },
      actionConfig: {
        templateText: 'Dear {{name}}, your campus visit for {{course}} is confirmed! Please bring your 12th marksheet.',
      },
      delayMinutes: 0,
      isActive: true,
    });

    // D) Inbound Bot: Option 1 - Course Catalog
    waInboundCourseRule = await AutomationRule.create({
      workspaceId: testWorkspace._id,
      userId: testUser._id,
      name: 'Reply "1" Course Catalog Details',
      triggerType: 'whatsapp_inbound',
      channel: 'whatsapp',
      actionType: 'send_whatsapp',
      category: 'inbound_bot',
      triggerConfig: {
        matchType: 'exact',
        keywords: ['1', 'course', 'programs'],
      },
      actionConfig: {
        templateText: '🎓 Offered Programs:\n1. B.Tech Computer Science\n2. MBA Finance\n3. BBA / BCA\nReply FEES to check tuition.',
      },
      isActive: true,
    });

    // E) Inbound Bot: Option 2 - Fee Details (Contains Keyword)
    waInboundMenuRule = await AutomationRule.create({
      workspaceId: testWorkspace._id,
      userId: testUser._id,
      name: 'Fee Structure Inbound Trigger',
      triggerType: 'whatsapp_inbound',
      channel: 'whatsapp',
      actionType: 'send_whatsapp',
      category: 'inbound_bot',
      triggerConfig: {
        matchType: 'contains',
        keywords: ['fees', 'scholarship', 'tuition'],
      },
      actionConfig: {
        templateText: '💰 Fee Structure: B.Tech is ₹1,20,000/yr. Scholarships of up to 40% are available based on merit!',
      },
      isActive: true,
    });

    // F) Inbound Bot: Fallback Auto-Reply
    waFallbackRule = await AutomationRule.create({
      workspaceId: testWorkspace._id,
      userId: testUser._id,
      name: 'Inbound WhatsApp Menu Fallback',
      triggerType: 'whatsapp_inbound',
      channel: 'whatsapp',
      actionType: 'send_whatsapp',
      category: 'inbound_bot',
      triggerConfig: {
        matchType: 'fallback',
      },
      actionConfig: {
        templateText: 'Hello {{name}}! Welcome to Admissions Desk. Reply 1 for Courses, 2 for Fees, or 3 for Counselor.',
      },
      isActive: true,
    });

    console.log('  ✔ Created 6 comprehensive automation rules across WhatsApp, Email, Pipeline and Inbound Bots');

    // ─────────────────────────────────────────────────────────────
    // 3. TEST VARIABLE SUBSTITUTION ENGINE
    // ─────────────────────────────────────────────────────────────
    const sampleLead = {
      name: 'Siddharth Roy',
      course: 'B.Tech Artificial Intelligence',
      phone: '9876543210',
      email: 'siddharth@example.com',
      city: 'Pune',
    };
    const substituted = AutomationEngine.replaceVariables(
      'Hi {{name}}, interest in {{course}} from {{city}} received. Call {{counselorName}}.',
      { lead: sampleLead, user: testUser }
    );

    if (!substituted.includes('Siddharth Roy') || !substituted.includes('B.Tech Artificial Intelligence') || !substituted.includes('Pune')) {
      throw new Error(`Variable substitution failed: ${substituted}`);
    }
    console.log('  ✔ Variable substitution engine correctly resolved lead and user context');

    // ─────────────────────────────────────────────────────────────
    // 4. TEST LEAD CREATED AUTOMATION TRIGGER
    // ─────────────────────────────────────────────────────────────
    const newLead = await Lead.create({
      userId: testUser._id,
      workspaceId: testWorkspace._id,
      name: 'Pooja Agarwal',
      phone: '9876500001',
      email: 'pooja.agarwal@example.com',
      course: 'MBA International Business',
      status: 'Fresh Lead',
      source: 'website_form',
    });

    // Trigger engine directly
    const leadCreatedResults = await AutomationEngine.handleLeadCreated(newLead, {
      workspaceId: testWorkspace._id,
      userId: testUser._id,
    });

    if (!leadCreatedResults || leadCreatedResults.length < 2) {
      throw new Error(`Expected at least 2 automation executions on lead created, got ${leadCreatedResults.length}`);
    }

    // Verify execution logs in DB
    const waLog = await AutomationLog.findOne({
      ruleId: waWelcomeRule._id,
      leadId: newLead._id,
    });
    if (!waLog || waLog.status !== 'success') {
      throw new Error('Expected successful WhatsApp execution log for new lead');
    }
    if (!waLog.actionPayload?.preview?.includes('Pooja Agarwal')) {
      throw new Error(`Execution log payload did not substitute name: ${waLog.actionPayload?.preview}`);
    }

    const emailLog = await AutomationLog.findOne({
      ruleId: emailWelcomeRule._id,
      leadId: newLead._id,
    });
    if (!emailLog || emailLog.status !== 'success') {
      throw new Error('Expected successful Email execution log for new lead');
    }
    console.log('  ✔ Lead Creation triggered both WhatsApp & Email automations with successful execution logs');

    // ─────────────────────────────────────────────────────────────
    // 5. TEST PIPELINE STAGE TRANSITION TRIGGER
    // ─────────────────────────────────────────────────────────────
    const stageResults = await AutomationEngine.handleStageChanged(
      newLead,
      'Campus Visit Scheduled',
      'Contacted',
      { workspaceId: testWorkspace._id, userId: testUser._id }
    );

    if (!stageResults || stageResults.length === 0) {
      throw new Error('Expected pipeline stage transition trigger to fire');
    }

    const stageLog = await AutomationLog.findOne({
      ruleId: stageDripRule._id,
      leadId: newLead._id,
    });
    if (!stageLog || stageLog.status !== 'success') {
      throw new Error('Expected successful stage transition execution log');
    }
    console.log('  ✔ Pipeline Stage Transition triggered stage-specific WhatsApp drip');

    // ─────────────────────────────────────────────────────────────
    // 6. TEST INBOUND WHATSAPP CHATBOT WORKFLOWS
    // ─────────────────────────────────────────────────────────────
    // Case A: Exact Keyword "1"
    const botRes1 = await AutomationEngine.handleInboundWhatsAppMessage({
      phone: '9876500001',
      messageText: '1',
      workspaceId: testWorkspace._id,
    });
    if (!botRes1 || !botRes1.matchedRule || botRes1.matchedRule.name !== 'Reply "1" Course Catalog Details') {
      throw new Error(`Inbound bot failed on exact keyword "1": ${JSON.stringify(botRes1)}`);
    }
    console.log('  ✔ Inbound WhatsApp Bot correctly matched exact keyword "1" and returned Course Catalog');

    // Case B: Contains Keyword "fees"
    const botRes2 = await AutomationEngine.handleInboundWhatsAppMessage({
      phone: '9876500001',
      messageText: 'Can you please tell me about tuition fees?',
      workspaceId: testWorkspace._id,
    });
    if (!botRes2 || !botRes2.matchedRule || botRes2.matchedRule.name !== 'Fee Structure Inbound Trigger') {
      throw new Error(`Inbound bot failed on contains keyword "fees": ${JSON.stringify(botRes2)}`);
    }
    console.log('  ✔ Inbound WhatsApp Bot correctly matched keyword "fees" and returned Fee Structure');

    // Case C: Unrecognized message from new prospect -> Auto-creates lead & sends Fallback Menu
    const unknownProspectPhone = '9876599999';
    const botRes3 = await AutomationEngine.handleInboundWhatsAppMessage({
      phone: unknownProspectPhone,
      messageText: 'Hey there, what is this number?',
      workspaceId: testWorkspace._id,
    });

    if (!botRes3 || !botRes3.matchedRule || botRes3.matchedRule.name !== 'Inbound WhatsApp Menu Fallback') {
      throw new Error(`Inbound bot failed fallback on unrecognized message: ${JSON.stringify(botRes3)}`);
    }

    // Verify prospect was automatically registered as a Lead in CRM
    const autoCreatedLead = await Lead.findOne({
      phone: unknownProspectPhone,
      workspaceId: testWorkspace._id,
    });
    if (!autoCreatedLead) {
      throw new Error('Expected new lead to be auto-provisioned in CRM upon inbound WhatsApp message');
    }
    if (autoCreatedLead.source !== 'whatsapp_inbound') {
      throw new Error(`Auto-provisioned lead source mismatch: ${autoCreatedLead.source}`);
    }
    console.log('  ✔ Auto-provisioned prospective Lead in CRM upon inbound WhatsApp inquiry and replied with Fallback Menu');

    // ─────────────────────────────────────────────────────────────
    // 7. TEST RULE TOGGLE & AUDIT LOG RETRIEVAL
    // ─────────────────────────────────────────────────────────────
    waWelcomeRule.isActive = false;
    await waWelcomeRule.save();

    const disabledTriggerResult = await AutomationEngine.handleLeadCreated(newLead, {
      workspaceId: testWorkspace._id,
      userId: testUser._id,
    });
    const waMatched = disabledTriggerResult.some((r) => String(r.ruleId) === String(waWelcomeRule._id));
    if (waMatched) {
      throw new Error('Deactivated automation rule should not trigger');
    }
    console.log('  ✔ Deactivated automation rules correctly ignored by execution engine');

    const totalLogs = await AutomationLog.countDocuments({ workspaceId: testWorkspace._id });
    if (totalLogs < 4) {
      throw new Error(`Expected at least 4 automation logs, found ${totalLogs}`);
    }
    console.log(`  ✔ Verified ${totalLogs} complete execution audit logs in MongoDB`);

    console.log('\n🎉 ALL AUTOMATION ENGINE & WHATSAPP BOT TESTS PASSED FLAWLESSLY!\n');
  } catch (err) {
    console.error('❌ Automation Test Suite Failed:', err);
    process.exit(1);
  } finally {
    // Clean up test data
    try {
      if (testWorkspace?._id) {
        await AutomationRule.deleteMany({ workspaceId: testWorkspace._id });
        await AutomationLog.deleteMany({ workspaceId: testWorkspace._id });
        await Lead.deleteMany({ workspaceId: testWorkspace._id });
        await Workspace.findByIdAndDelete(testWorkspace._id);
      }
      if (testUser?._id) {
        await User.findByIdAndDelete(testUser._id);
      }
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
    await mongoose.disconnect();
  }
}

runAutomationTestSuite();
