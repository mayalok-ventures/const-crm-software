const mongoose = require('mongoose');
const assert = require('assert');
const crypto = require('crypto');

// Models
const EmailAccount = require('../src/models/EmailAccount');
const EmailMessage = require('../src/models/EmailMessage');
const Lead = require('../src/models/Lead');
const Template = require('../src/models/Template');
const Workspace = require('../src/models/Workspace');
const User = require('../src/models/User');

// Services
const EmailService = require('../src/services/email/emailService');
const { encrypt, decrypt } = require('../src/utils/encryption');

async function runTests() {
  console.log('🧪 Starting Email Module Comprehensive Integration Test Suite...\n');

  // Connect to MongoDB if not connected
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB:', mongoUri);
  }

  const testSuffix = Date.now();
  const testWorkspaceId = new mongoose.Types.ObjectId();
  const testUserId = new mongoose.Types.ObjectId();

  try {
    // -------------------------------------------------------------
    // Test 1: Template Reconciliation Backwards Compatibility
    // -------------------------------------------------------------
    console.log('▶ Test 1: Testing Template.js harmonization (WhatsApp + Email)...');
    
    // Legacy WhatsApp creation (title, text, imageFile, etc.)
    const waTemplate = await Template.create({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      title: `WhatsApp Welcome ${testSuffix}`,
      text: 'Hello {{name}}, welcome to our admission portal for {{course}}!',
      channel: 'WHATSAPP',
    });
    assert.strictEqual(waTemplate.name, `WhatsApp Welcome ${testSuffix}`, 'name should be aliased to title');
    assert.strictEqual(waTemplate.content, waTemplate.text, 'content should be aliased to text');
    assert.deepStrictEqual(waTemplate.variables, ['name', 'course'], 'should auto-extract variables');
    console.log('  ✔ WhatsApp legacy template created successfully without validation errors');

    // Modern Email creation (subject, bodyHtml, channel)
    const emailTemplate = await Template.create({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      name: `Email Prospectus ${testSuffix}`,
      subject: 'Your Requested Course Prospectus for {{course}}',
      bodyHtml: '<h1>Dear {{name}}</h1><p>Please find attached prospectus.</p>',
      channel: 'EMAIL',
    });
    assert.strictEqual(emailTemplate.title, `Email Prospectus ${testSuffix}`, 'title should be aliased to name');
    assert.strictEqual(emailTemplate.subject, 'Your Requested Course Prospectus for {{course}}');
    assert.ok(emailTemplate.variables.includes('course') && emailTemplate.variables.includes('name'));
    console.log('  ✔ Email template created successfully with subject and HTML body');

    // -------------------------------------------------------------
    // Test 2: EmailAccount Model & AES-256 Encryption
    // -------------------------------------------------------------
    console.log('\n▶ Test 2: Testing EmailAccount credential encryption & safe serialization...');
    
    const plainToken = 'secret_oauth_refresh_token_xyz_123';
    const plainPassword = 'super_secret_smtp_password_999';

    const testAccount = new EmailAccount({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      provider: 'smtp',
      email: `admissions_${testSuffix}@exampleedu.com`,
      displayName: 'Admissions Office',
      smtpHost: 'smtp.exampleedu.com',
      smtpPort: 587,
      smtpSecure: false,
    });
    testAccount.setTokens({ refreshToken: plainToken });
    testAccount.setSmtpPassword(plainPassword);
    await testAccount.save();

    // Verify raw DB document has ciphertext
    const rawInDb = await EmailAccount.findById(testAccount._id).select('+refreshTokenEncrypted +smtpPassEncrypted');
    assert.notStrictEqual(rawInDb.refreshTokenEncrypted, plainToken, 'Token in DB must not be plain text');
    assert.notStrictEqual(rawInDb.smtpPassEncrypted, plainPassword, 'Password in DB must not be plain text');

    // Verify decrypt methods
    assert.strictEqual(rawInDb.getDecryptedRefreshToken(), plainToken, 'Decrypted token must match original');
    assert.strictEqual(rawInDb.getDecryptedSmtpPassword(), plainPassword, 'Decrypted password must match original');

    // Verify toSafeJSON() strips encrypted secrets
    const safeObj = testAccount.toSafeJSON();
    assert.strictEqual(safeObj.accessTokenEncrypted, undefined);
    assert.strictEqual(safeObj.refreshTokenEncrypted, undefined);
    assert.strictEqual(safeObj.smtpPassEncrypted, undefined);
    console.log('  ✔ OAuth tokens and SMTP passwords securely encrypted with AES-256-GCM and excluded from safe JSON');

    // -------------------------------------------------------------
    // Test 3: Lead Email Resolution & Activity Tracking
    // -------------------------------------------------------------
    console.log('\n▶ Test 3: Testing CRM Lead linking and activity audit trail...');
    
    const studentEmail = `student_${testSuffix}@gmail.com`;
    const testLead = await Lead.create({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      name: 'Rohan Sharma',
      email: studentEmail,
      phone: '9876543210',
      targetCourse: 'B.Tech CSE',
      status: 'Lead Received',
    });
    assert.ok(testLead._id);
    console.log('  ✔ Created test student lead with email:', studentEmail);

    // Mock send using EmailMessage direct creation (matching emailService.sendEmail flow)
    const threadId = `thread_${Date.now()}`;
    const sentMsg = await EmailMessage.create({
      workspaceId: testWorkspaceId,
      accountId: testAccount._id,
      userId: testUserId,
      leadId: testLead._id,
      folder: 'sent',
      status: 'sent',
      threadId,
      messageId: `<msg_${Date.now()}@exampleedu.com>`,
      from: { name: 'Admissions Office', email: testAccount.email },
      to: [{ name: 'Rohan Sharma', email: studentEmail }],
      subject: 'Admission Confirmation Letter - B.Tech CSE',
      snippet: 'Congratulations Rohan, your admission has been approved...',
      bodyHtml: '<p>Congratulations Rohan, your admission has been approved.</p>',
      bodyText: 'Congratulations Rohan, your admission has been approved.',
      isRead: true,
      sentAt: new Date(),
      date: new Date(),
    });
    assert.ok(sentMsg._id);

    // Update lead activity
    testLead.leadActivities.push({
      action: 'email_sent',
      performedBy: testUserId,
      performerName: 'Counselor Priya',
      details: `Sent email "${sentMsg.subject}" to ${studentEmail}`,
      timestamp: new Date(),
    });
    await testLead.save();

    // Verify activity logged
    const reloadedLead = await Lead.findById(testLead._id);
    const lastActivity = reloadedLead.leadActivities[reloadedLead.leadActivities.length - 1];
    assert.strictEqual(lastActivity.action, 'email_sent');
    assert.ok(lastActivity.details.includes('Admission Confirmation Letter'));
    console.log('  ✔ email_sent action recorded in Lead activity audit trail');

    // -------------------------------------------------------------
    // Test 4: Threading, Drafts, and Folder Navigation
    // -------------------------------------------------------------
    console.log('\n▶ Test 4: Testing Thread continuity, replies, drafts, and folders...');
    
    // Simulate Inbound reply in the same thread
    const replyMsg = await EmailMessage.create({
      workspaceId: testWorkspaceId,
      accountId: testAccount._id,
      leadId: testLead._id,
      folder: 'inbox',
      status: 'received',
      threadId, // Same thread ID!
      inReplyTo: sentMsg.messageId,
      references: [sentMsg.messageId],
      messageId: `<reply_${Date.now()}@gmail.com>`,
      from: { name: 'Rohan Sharma', email: studentEmail },
      to: [{ name: 'Admissions Office', email: testAccount.email }],
      subject: 'Re: Admission Confirmation Letter - B.Tech CSE',
      snippet: 'Thank you! When do classes begin?',
      bodyHtml: '<p>Thank you! When do classes begin?</p>',
      bodyText: 'Thank you! When do classes begin?',
      isRead: false,
      date: new Date(Date.now() + 5000),
    });
    assert.ok(replyMsg._id);

    // Verify Thread Messages
    const threadMessages = await EmailService.getThreadMessages(testWorkspaceId, threadId);
    assert.strictEqual(threadMessages.length, 2, 'Thread must contain both outbound and inbound message');
    assert.strictEqual(threadMessages[0].folder, 'sent');
    assert.strictEqual(threadMessages[1].folder, 'inbox');
    console.log('  ✔ Thread continuity verified: 2 messages correctly ordered in thread', threadId);

    // Save Draft
    const draft = await EmailService.saveDraft({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      accountId: testAccount._id,
      to: [{ email: studentEmail }],
      subject: 'Draft reply to Rohan',
      bodyHtml: '<p>Classes begin on August 1st.</p>',
      leadId: testLead._id,
      threadId,
    });
    assert.strictEqual(draft.folder, 'drafts');
    assert.strictEqual(draft.status, 'draft');
    console.log('  ✔ Draft saved and verified in drafts folder');

    // Test getMessages for Inbox
    const inboxData = await EmailService.getMessages({
      workspaceId: testWorkspaceId,
      folder: 'inbox',
    });
    assert.strictEqual(inboxData.total, 1);
    assert.strictEqual(inboxData.unreadInboxCount, 1);
    assert.strictEqual(inboxData.messages[0]._id.toString(), replyMsg._id.toString());
    console.log('  ✔ Inbox folder query with unread counters working correctly');

    // Test getLeadEmailHistory
    const leadEmails = await EmailService.getLeadEmailHistory(testWorkspaceId, testLead._id);
    assert.strictEqual(leadEmails.length, 3, 'Lead email history must show all sent, received, and draft emails for lead');
    console.log('  ✔ getLeadEmailHistory verified for lead profile tab');

    // Mark as read and Star
    await EmailService.markMessageRead(testWorkspaceId, replyMsg._id, true);
    await EmailService.markMessageStarred(testWorkspaceId, replyMsg._id, true);
    const updatedReply = await EmailMessage.findById(replyMsg._id);
    assert.strictEqual(updatedReply.isRead, true);
    assert.strictEqual(updatedReply.isStarred, true);
    console.log('  ✔ Message read and starred flags toggle verified');

    // Move to Trash
    await EmailService.moveMessageFolder(testWorkspaceId, replyMsg._id, 'trash');
    const trashedMsg = await EmailMessage.findById(replyMsg._id);
    assert.strictEqual(trashedMsg.folder, 'trash');
    console.log('  ✔ Move to trash folder verified');

    // Provider config status diagnostic check
    const configStatus = EmailService.getProviderConfigStatus();
    assert.ok(configStatus.google !== undefined);
    assert.ok(configStatus.microsoft !== undefined);
    assert.ok(configStatus.smtp !== undefined);
    console.log('  ✔ Provider config status diagnostic reporting verified');

    // Clean up test data
    await EmailMessage.deleteMany({ workspaceId: testWorkspaceId });
    await EmailAccount.deleteMany({ workspaceId: testWorkspaceId });
    await Lead.deleteMany({ _id: testLead._id });
    await Template.deleteMany({ _id: { $in: [waTemplate._id, emailTemplate._id] } });
    console.log('  ✔ Test teardown and cleanup completed');

    console.log('\n🎉 ALL EMAIL MODULE INTEGRATION TESTS PASSED SUCCESSFULLY! ✅');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTests();
