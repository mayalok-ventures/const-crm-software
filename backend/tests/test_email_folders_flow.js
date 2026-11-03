const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const EmailAccount = require('../src/models/EmailAccount');
const EmailMessage = require('../src/models/EmailMessage');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const EmailService = require('../src/services/email/emailService');

async function runEmailFoldersTest() {
  console.log('====================================================');
  console.log('🧪 RUNNING EMAIL SECTION: INBOX, DRAFTS, SCHEDULE, ARCHIVE, TRASH TEST SUITE');
  console.log('====================================================');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mobile-crm';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  try {
    // 1. Setup Workspace & User
    const uniqueSuffix = Date.now();
    let workspace = await Workspace.findOne();
    if (!workspace) {
      workspace = await Workspace.create({
        name: `Email Test Workspace ${uniqueSuffix}`,
        slug: `email-test-${uniqueSuffix}`,
        currency: 'INR',
      });
    }

    let user = await User.findOne({ email: 'admin@platform.com' });
    if (!user) {
      user = await User.create({
        name: 'Email Test Admin',
        email: `emailadmin_${uniqueSuffix}@crm.com`,
        password: 'Password123!',
        role: 'owner',
        workspaceId: workspace._id,
      });
    }

    // 2. Setup Mock Email Account
    let account = await EmailAccount.findOne({ workspaceId: workspace._id, email: `test_${uniqueSuffix}@crm.com` });
    if (!account) {
      account = await EmailAccount.create({
        workspaceId: workspace._id,
        userId: user._id,
        provider: 'smtp',
        email: `test_${uniqueSuffix}@crm.com`,
        displayName: 'Admissions Office',
        status: 'active',
        isShared: true,
        isGlobal: true,
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUser: `test_${uniqueSuffix}@crm.com`,
        smtpPassEncrypted: 'mock_pass',
      });
    }
    console.log(`✓ Email Account established: ${account.email} (${account._id})`);

    // ----------------------------------------------------
    // TEST 1: SAVE DRAFT WITHOUT RECIPIENTS (Empty To)
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Save Draft with Empty Recipient (User just started writing) ---');
    const draft1 = await EmailService.saveDraft({
      workspaceId: workspace._id,
      userId: user._id,
      accountId: account._id,
      to: [],
      subject: 'Candidate Counseling Draft Notes',
      bodyHtml: '<p>Preliminary notes about scholarship criteria.</p>',
    });

    if (!draft1 || !draft1._id) {
      throw new Error('TEST 1 FAILED: Draft was not created');
    }
    if (draft1.folder !== 'drafts' || draft1.status !== 'draft') {
      throw new Error(`TEST 1 FAILED: Invalid folder/status: folder=${draft1.folder}, status=${draft1.status}`);
    }
    console.log(`✓ Draft saved successfully without recipient: id=${draft1._id}, folder=${draft1.folder}`);

    // ----------------------------------------------------
    // TEST 2: UPDATE EXISTING DRAFT VIA draftId
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Update Existing Draft (Adding recipient and details) ---');
    const draft2 = await EmailService.saveDraft({
      workspaceId: workspace._id,
      userId: user._id,
      accountId: account._id,
      draftId: draft1._id,
      to: ['candidate@student.edu'],
      subject: 'Updated: Admission Guidance Details',
      bodyHtml: '<p>Full details about your MBA application.</p>',
    });

    if (draft2._id.toString() !== draft1._id.toString()) {
      throw new Error(`TEST 2 FAILED: Expected draft update on same ID, got new ID: ${draft2._id}`);
    }
    if (draft2.to.length !== 1 || draft2.to[0].email !== 'candidate@student.edu') {
      throw new Error(`TEST 2 FAILED: Draft recipient not updated properly: ${JSON.stringify(draft2.to)}`);
    }
    console.log(`✓ Existing draft updated properly on same ID: ${draft2._id}, to=${draft2.to[0].email}`);

    // ----------------------------------------------------
    // TEST 3: SCHEDULE EMAIL FOR FUTURE DISPATCH
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Schedule Email with Future Date ---');
    const futureDate = new Date(Date.now() + 2 * 3600 * 1000); // 2 hours in future
    const scheduledEmail = await EmailService.sendEmail({
      workspaceId: workspace._id,
      userId: user._id,
      userName: user.name,
      accountId: account._id,
      to: [{ email: 'admitted.student@college.edu' }],
      subject: 'Scheduled Welcome Package for Tomorrow',
      bodyHtml: '<p>Welcome to the program!</p>',
      scheduledAt: futureDate.toISOString(),
      draftId: draft2._id, // converting prior draft into scheduled
    });

    if (!scheduledEmail || scheduledEmail.folder !== 'scheduled' || scheduledEmail.status !== 'queued') {
      throw new Error(`TEST 3 FAILED: Message was not scheduled properly: folder=${scheduledEmail.folder}, status=${scheduledEmail.status}`);
    }
    if (!scheduledEmail.scheduledAt) {
      throw new Error('TEST 3 FAILED: scheduledAt field is missing on scheduled email');
    }

    // Verify prior draft was cleaned up when converting to scheduled
    const priorDraftCheck = await EmailMessage.findById(draft2._id);
    if (priorDraftCheck && priorDraftCheck.folder === 'drafts') {
      throw new Error('TEST 3 FAILED: Prior draft was not converted/cleaned up');
    }
    console.log(`✓ Email scheduled successfully: id=${scheduledEmail._id}, folder=${scheduledEmail.folder}, status=${scheduledEmail.status}, scheduledAt=${scheduledEmail.scheduledAt}`);

    // ----------------------------------------------------
    // TEST 4: CANCEL SCHEDULED EMAIL (Reverts to Drafts)
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Cancel Scheduled Email -> Revert to Drafts ---');
    const cancelledMsg = await EmailService.cancelScheduled(workspace._id, scheduledEmail._id, user);
    if (cancelledMsg.folder !== 'drafts' || cancelledMsg.status !== 'draft' || cancelledMsg.scheduledAt !== null) {
      throw new Error(`TEST 4 FAILED: Cancel schedule did not revert to draft: folder=${cancelledMsg.folder}, status=${cancelledMsg.status}, scheduledAt=${cancelledMsg.scheduledAt}`);
    }
    console.log(`✓ Scheduled email reverted to drafts: id=${cancelledMsg._id}, folder=${cancelledMsg.folder}`);

    // ----------------------------------------------------
    // TEST 5: RE-SCHEDULE AND DISPATCH VIA sendScheduledNow
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Re-Schedule and Dispatch via sendScheduledNow ---');
    const reScheduled = await EmailService.sendEmail({
      workspaceId: workspace._id,
      userId: user._id,
      userName: user.name,
      accountId: account._id,
      to: [{ email: 'priority.student@college.edu' }],
      subject: 'Time-sensitive Admission Update',
      bodyHtml: '<p>Urgent update regarding seat allotment.</p>',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      draftId: cancelledMsg._id,
    });

    // Mock the adapter sendEmail so we don't need real external SMTP server for unit assertion
    const { getProviderAdapter } = require('../src/services/email/emailProviderAdapters');
    const SmtpAdapter = getProviderAdapter('smtp');
    const origSend = SmtpAdapter.sendEmail;
    SmtpAdapter.sendEmail = async () => ({
      messageId: `<mock_${Date.now()}@smtp.example.com>`,
      providerMessageId: `prov_${Date.now()}`,
      threadId: reScheduled.threadId,
    });

    const dispatchedNow = await EmailService.sendScheduledNow(workspace._id, reScheduled._id, user);
    if (dispatchedNow.folder !== 'sent' || dispatchedNow.status !== 'sent') {
      throw new Error(`TEST 5 FAILED: sendScheduledNow failed: folder=${dispatchedNow.folder}, status=${dispatchedNow.status}`);
    }
    console.log(`✓ sendScheduledNow dispatched immediately: id=${dispatchedNow._id}, folder=${dispatchedNow.folder}, status=${dispatchedNow.status}`);
    SmtpAdapter.sendEmail = origSend; // restore

    // ----------------------------------------------------
    // TEST 6: ARCHIVE & UNARCHIVE (MOVE TO INBOX)
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Archive Message and Move Back to Inbox ---');
    const archivedMsg = await EmailService.moveMessageFolder(workspace._id, dispatchedNow._id, 'archive', user);
    if (archivedMsg.folder !== 'archive') {
      throw new Error(`TEST 6 FAILED: Failed to move to archive: folder=${archivedMsg.folder}`);
    }
    console.log(`✓ Message archived: folder=${archivedMsg.folder}`);

    const unarchivedMsg = await EmailService.moveMessageFolder(workspace._id, dispatchedNow._id, 'inbox', user);
    if (unarchivedMsg.folder !== 'inbox') {
      throw new Error(`TEST 6 FAILED: Failed to move to inbox (unarchive): folder=${unarchivedMsg.folder}`);
    }
    console.log(`✓ Message unarchived back to inbox: folder=${unarchivedMsg.folder}`);

    // ----------------------------------------------------
    // TEST 7: MOVE TO TRASH & RESTORE TO INBOX
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Move to Trash and Restore to Inbox ---');
    const trashedMsg = await EmailService.moveMessageFolder(workspace._id, dispatchedNow._id, 'trash', user);
    if (trashedMsg.folder !== 'trash') {
      throw new Error(`TEST 7 FAILED: Failed to move to trash: folder=${trashedMsg.folder}`);
    }
    console.log(`✓ Message moved to trash: folder=${trashedMsg.folder}`);

    const restoredMsg = await EmailService.moveMessageFolder(workspace._id, dispatchedNow._id, 'inbox', user);
    if (restoredMsg.folder !== 'inbox') {
      throw new Error(`TEST 7 FAILED: Failed to restore from trash: folder=${restoredMsg.folder}`);
    }
    console.log(`✓ Message restored from trash to inbox: folder=${restoredMsg.folder}`);

    // ----------------------------------------------------
    // TEST 8: PERMANENT DELETE FROM TRASH & EMPTY TRASH
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Permanent Deletion & Empty Trash ---');
    await EmailService.moveMessageFolder(workspace._id, dispatchedNow._id, 'trash', user);

    // Create 2 extra mock trashed messages
    const trashExtra1 = await EmailMessage.create({
      workspaceId: workspace._id,
      accountId: account._id,
      userId: user._id,
      folder: 'trash',
      status: 'received',
      threadId: `thread_${Date.now()}_1`,
      from: { name: 'Spam Bot', email: 'spam1@bot.com' },
      to: [{ name: account.displayName, email: account.email }],
      subject: 'Spam 1',
      date: new Date(),
    });

    const trashExtra2 = await EmailMessage.create({
      workspaceId: workspace._id,
      accountId: account._id,
      userId: user._id,
      folder: 'trash',
      status: 'received',
      threadId: `thread_${Date.now()}_2`,
      from: { name: 'Spam Bot', email: 'spam2@bot.com' },
      to: [{ name: account.displayName, email: account.email }],
      subject: 'Spam 2',
      date: new Date(),
    });

    // Individual permanent delete
    const delResult = await EmailService.deleteMessage(workspace._id, trashExtra1._id, true, user);
    if (!delResult.success || !delResult.permanent) {
      throw new Error(`TEST 8 FAILED: Delete permanent failed: ${JSON.stringify(delResult)}`);
    }
    const checkDeleted = await EmailMessage.findById(trashExtra1._id);
    if (checkDeleted) {
      throw new Error('TEST 8 FAILED: Message still exists after permanent delete');
    }
    console.log(`✓ Individual message permanently deleted: id=${trashExtra1._id}`);

    // Empty Trash
    const emptyResult = await EmailService.emptyTrash(workspace._id, account._id, user);
    if (!emptyResult.success || emptyResult.deletedCount < 2) {
      throw new Error(`TEST 8 FAILED: Empty trash did not delete remaining trashed items: ${JSON.stringify(emptyResult)}`);
    }
    const remainingTrashCount = await EmailMessage.countDocuments({ workspaceId: workspace._id, folder: 'trash' });
    if (remainingTrashCount !== 0) {
      throw new Error(`TEST 8 FAILED: Expected 0 messages in trash, found: ${remainingTrashCount}`);
    }
    console.log(`✓ Empty trash executed: deletedCount=${emptyResult.deletedCount}, remainingTrashCount=0`);

    // ----------------------------------------------------
    // TEST 9: VERIFY getMessages FOLDER COUNTS
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Verify getMessages with Folders Badges Counts ---');
    const folderStats = await EmailService.getMessages({
      workspaceId: workspace._id,
      folder: 'inbox',
      user,
    });
    if (folderStats.unreadInboxCount === undefined || folderStats.draftsCount === undefined || folderStats.scheduledCount === undefined) {
      throw new Error(`TEST 9 FAILED: Missing folder count metrics: ${JSON.stringify(folderStats)}`);
    }
    console.log(`✓ Folder count badges verified: unreadInboxCount=${folderStats.unreadInboxCount}, draftsCount=${folderStats.draftsCount}, scheduledCount=${folderStats.scheduledCount}`);

    console.log('\n====================================================');
    console.log('🎉 ALL EMAIL SECTION TESTS PASSED PERFECTLY (100%)!');
    console.log('====================================================\n');
  } finally {
    await mongoose.disconnect();
  }
}

runEmailFoldersTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
