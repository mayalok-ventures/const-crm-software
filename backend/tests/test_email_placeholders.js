/**
 * Comprehensive Automated Verification Suite for Email Placeholders & Dynamic Merge Tags
 * Tests:
 * 1. PlaceholderResolver unit mappings & clean stripping of unmatched tags
 * 2. EmailService.sendEmail dynamic placeholder replacement on subject, HTML, and text
 * 3. Scheduled email placeholder resolution on schedule creation and sendScheduledNow
 * 4. EmailService.getPlaceholders live registry evaluation
 */

const mongoose = require('mongoose');
const path = require('path');
const assert = require('assert');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const EmailService = require('../src/services/email/emailService');
const EmailAccount = require('../src/models/EmailAccount');
const EmailMessage = require('../src/models/EmailMessage');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const { resolvePlaceholders, getPlaceholderRegistry } = require('../src/utils/placeholderResolver');
const { SmtpAdapter } = require('../src/services/email/emailProviderAdapters');

// Intercept SmtpAdapter.sendEmail to inspect parameters passed to provider
let lastDispatchedOptions = null;
const originalSendEmail = SmtpAdapter.sendEmail;
SmtpAdapter.sendEmail = async function (account, options) {
  lastDispatchedOptions = options;
  return {
    messageId: 'mock_msg_' + Date.now(),
    threadId: options.threadId || 'mock_thread_' + Date.now(),
    providerMessageId: 'mock_provider_' + Date.now(),
  };
};

async function runTests() {
  console.log('🧪 Starting Sahyak CRM Dynamic Email Placeholders Verification Suite...\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/salescrm';
  await mongoose.connect(mongoUri, { connectTimeoutMS: 15000 });
  console.log('  ✔ Connected to Database');

  const testWorkspaceId = new mongoose.Types.ObjectId();
  const testUserId = new mongoose.Types.ObjectId();

  try {
    // ─────────────────────────────────────────────────────────────
    // TEST 1: PURE PLACEHOLDER RESOLVER UNIT TEST
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 1: PlaceholderResolver Logic ---');
    const mockLead = {
      name: 'Pooja Agarwal',
      targetCourse: 'MBA International Business',
      phone: '+91 98765 00001',
      email: 'pooja.agarwal@example.com',
      targetCity: 'Bangalore',
      status: 'Inquiry',
      admissionFinalFee: 250000,
      assignedToName: 'Admissions Desk Senior',
    };
    const mockUser = {
      name: 'Prof. Rajesh Gupta',
      phone: '+91 91234 56789',
      email: 'rajesh.gupta@sahyak.edu',
    };
    const mockWorkspace = { name: 'Sahyak Business School' };

    const rawTemplate = 'Hi {{name}} (First: {{firstName}}, Last: {{lastName}})! Welcome to {{course}} at {{companyName}} in {{city}}. Contact {{counselorName}} (Phone: {{counselorPhone}}, Email: {{counselorEmail}}). Status: {{stage}}. Fee: {{amount}}. Date: {{today}}, Year: {{year}}. Unknown: {{nonExistentField}}';

    const resolved = resolvePlaceholders(rawTemplate, {
      lead: mockLead,
      user: mockUser,
      workspace: mockWorkspace,
    });

    assert(resolved.includes('Hi Pooja Agarwal (First: Pooja, Last: Agarwal)!'), 'Full name, first name, and last name must resolve');
    assert(resolved.includes('Welcome to MBA International Business at Sahyak Business School in Bangalore.'), 'Course, company, and city must resolve');
    assert(resolved.includes('Contact Admissions Desk Senior (Phone: +91 91234 56789, Email: rajesh.gupta@sahyak.edu).'), 'Counselor details must resolve');
    assert(resolved.includes('Status: Inquiry.'), 'Stage must resolve');
    assert(resolved.includes('Fee: 250000.'), 'Amount must resolve');
    assert(!resolved.includes('{{'), 'No raw double curly braces should remain');
    assert(!resolved.includes('nonExistentField'), 'Unknown fields should cleanly resolve without leaking syntax');
    console.log('  ✔ Unit placeholder replacement verified with zero raw tags remaining');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: GET PLACEHOLDER REGISTRY WITH LIVE EVALUATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Dynamic Placeholders Registry ---');
    const registry = getPlaceholderRegistry({
      lead: mockLead,
      user: mockUser,
      workspace: mockWorkspace,
    });
    assert(Array.isArray(registry) && registry.length >= 15, 'Registry must contain all canonical CRM variables');
    const nameItem = registry.find(r => r.tag === '{{name}}');
    assert(nameItem && nameItem.liveValue === 'Pooja Agarwal', 'Live value for name must evaluate to lead name');
    assert(nameItem.hasLiveData === true, 'hasLiveData must be true when connected to live candidate');
    console.log(`  ✔ Registry returned ${registry.length} dynamic placeholders with live evaluated data`);

    // ─────────────────────────────────────────────────────────────
    // TEST 3: EMAIL SERVICE SEND EMAIL RESOLUTION (INSTANT DISPATCH)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: EmailService.sendEmail Dynamic Placeholder Substitution ---');
    // Create test lead in DB
    const dbLead = await Lead.create({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      name: 'Aarav Sharma',
      email: `aarav_${Date.now()}@testleads.org`,
      phone: '9876543210',
      targetCourse: 'B.Tech Computer Science & AI',
      targetCity: 'Delhi',
      status: 'New Inquiry',
      primarySource: 'MANUAL',
      admissionFinalFee: 180000,
      assignedToName: 'Counselor Priya Verma',
    });

    // Create test connected email account in DB
    const dbAccount = await EmailAccount.create({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      email: `counseling_${Date.now()}@university.org`,
      displayName: 'Admissions Office',
      provider: 'smtp',
      status: 'active',
      isShared: true,
      authMethod: 'password',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpSecure: false,
      smtpUserEncrypted: 'mock_user',
      smtpPassEncrypted: 'mock_pass',
      imapHost: 'imap.ethereal.email',
      imapPort: 993,
      imapSecure: true,
      imapUserEncrypted: 'mock_user',
      imapPassEncrypted: 'mock_pass',
    });

    // Send email with placeholders in Subject, bodyHtml, and bodyText
    const sentMsg = await EmailService.sendEmail({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      userName: 'Counselor Priya Verma',
      accountId: dbAccount._id,
      leadId: dbLead._id,
      to: dbLead.email,
      subject: 'Offer Letter & Fee Structure for {{name}} - {{course}}',
      bodyHtml: '<p>Dear {{name}},</p><p>Congratulations! Your admission to {{course}} is provisionally approved. Your fee is {{amount}}.</p><p>Regards,<br/>{{counselorName}}<br/>{{companyName}}</p>',
      bodyText: 'Dear {{name}}, Congratulations! Your admission to {{course}} is provisionally approved.',
    });

    assert(sentMsg, 'Email message must be created');
    assert(lastDispatchedOptions, 'Adapter must have received options');
    assert(lastDispatchedOptions.subject.includes('Aarav Sharma - B.Tech Computer Science & AI'), 'Adapter received resolved subject');
    assert(lastDispatchedOptions.bodyHtml.includes('Dear Aarav Sharma,'), 'Adapter received resolved HTML body');
    assert(!lastDispatchedOptions.bodyHtml.includes('{{'), 'Adapter received zero raw double curly braces');
    assert(sentMsg.subject.includes('Aarav Sharma - B.Tech Computer Science & AI'), `Subject must have placeholders resolved. Got: ${sentMsg.subject}`);
    assert(!sentMsg.subject.includes('{{name}}'), 'Subject must NOT contain {{name}}');
    assert(!sentMsg.subject.includes('{{course}}'), 'Subject must NOT contain {{course}}');
    assert(sentMsg.bodyHtml.includes('Dear Aarav Sharma,'), 'HTML body must have {{name}} replaced with Aarav Sharma');
    assert(sentMsg.bodyHtml.includes('admission to B.Tech Computer Science & AI'), 'HTML body must have {{course}} replaced');
    assert(!sentMsg.bodyHtml.includes('{{'), 'HTML body must have zero raw {{ remaining');
    assert(sentMsg.snippet.includes('Dear Aarav Sharma,'), 'Snippet must be generated from resolved text');
    console.log(`  ✔ Email sent with fully resolved subject: "${sentMsg.subject}"`);
    console.log(`  ✔ Email snippet cleanly generated: "${sentMsg.snippet.slice(0, 70)}..."`);

    // ─────────────────────────────────────────────────────────────
    // TEST 4: SCHEDULED EMAIL RESOLUTION (SCHEDULED AT CREATION & SEND-NOW)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Scheduled Email Placeholder Resolution ---');
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours later
    const scheduledMsg = await EmailService.sendEmail({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      userName: 'Counselor Priya Verma',
      accountId: dbAccount._id,
      leadId: dbLead._id,
      to: dbLead.email,
      scheduledAt: futureDate.toISOString(),
      subject: 'Scheduled Follow-Up for {{name}} regarding {{course}}',
      bodyHtml: '<p>Hi {{name}}, just checking in regarding {{course}} at {{companyName}}.</p>',
    });

    assert(scheduledMsg.isScheduled === true, 'Message must be marked as scheduled');
    assert(scheduledMsg.subject.includes('Aarav Sharma regarding B.Tech Computer Science & AI'), 'Scheduled message subject must have placeholders resolved at schedule-time');
    assert(scheduledMsg.bodyHtml.includes('Hi Aarav Sharma, just checking in regarding B.Tech Computer Science & AI'), 'Scheduled message HTML must have placeholders resolved');
    assert(!scheduledMsg.bodyHtml.includes('{{'), 'Scheduled message must not contain raw {{');
    console.log('  ✔ Scheduled email created with placeholders cleanly pre-resolved');

    // Test sendScheduledNow on this message
    const sendNowResult = await EmailService.sendScheduledNow(testWorkspaceId, scheduledMsg._id, { _id: testUserId, role: 'admin' });
    assert(sendNowResult.status === 'sent', 'sendScheduledNow must transition status to sent');
    assert(sendNowResult.folder === 'sent', 'sendScheduledNow must move email to sent folder');
    assert(!sendNowResult.subject.includes('{{'), 'sendScheduledNow must deliver resolved subject');
    console.log('  ✔ Scheduled email dispatched immediately with 100% placeholder accuracy');

    // Clean up test documents
    await Lead.deleteMany({ workspaceId: testWorkspaceId });
    await EmailAccount.deleteMany({ workspaceId: testWorkspaceId });
    await EmailMessage.deleteMany({ workspaceId: testWorkspaceId });
    console.log('\n  ✔ Test data cleaned up successfully');

    console.log('\n🎉 ALL 4 DYNAMIC PLACEHOLDER INTEGRATION TESTS PASSED PERFECTLY!\n');
  } catch (err) {
    console.error('\n❌ Test failure:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
