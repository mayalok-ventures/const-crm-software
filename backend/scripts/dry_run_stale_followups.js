/**
 * Read-Only Diagnostic Dry-Run: Stale Follow-Up Data Audit
 * Safe execution: only reads and aggregates counts. Mutates ZERO data.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edcrm';

async function runDiagnostic() {
  console.log('\n🔍 ========================================================');
  console.log('   READ-ONLY DIAGNOSTIC AUDIT: STALE FOLLOW-UP RECORDS');
  console.log('========================================================\n');

  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    const leadsCollection = db.collection('leads');
    const followupsCollection = db.collection('followups');

    const totalLeads = await leadsCollection.countDocuments();
    const totalFollowUps = await followupsCollection.countDocuments();

    console.log(`📊 Total Leads in DB: ${totalLeads}`);
    console.log(`📊 Total FollowUp Documents in DB: ${totalFollowUps}\n`);

    // 1. Leads marked completed/cancelled/none but retaining non-null activeFollowUp.scheduledAt
    const zombieCompletedScheduledAt = await leadsCollection.countDocuments({
      $or: [
        { followUpStatus: { $in: ['completed', 'cancelled', 'none'] }, 'activeFollowUp.scheduledAt': { $ne: null } },
        { 'activeFollowUp.status': { $in: ['completed', 'cancelled', 'none'] }, 'activeFollowUp.scheduledAt': { $ne: null } },
      ]
    });
    console.log(`⚠️  Case 1 (Completed/Cancelled leads with stale scheduledAt timestamp): ${zombieCompletedScheduledAt} leads`);

    // 2. Leads with followUpDate === null but activeFollowUp.scheduledAt holding a timestamp
    const nullFollowUpDateWithScheduledAt = await leadsCollection.countDocuments({
      followUpDate: null,
      'activeFollowUp.scheduledAt': { $ne: null },
    });
    console.log(`⚠️  Case 2 (followUpDate is null, but activeFollowUp.scheduledAt is non-null): ${nullFollowUpDateWithScheduledAt} leads`);

    // 3. Leads in terminal lead stages (Closed, Lost, Dropped) with an active follow-up scheduled
    const terminalLeadsWithFollowUp = await leadsCollection.countDocuments({
      status: {
        $in: [
          'closed', 'lost', 'Closed', 'Lost',
          'Closed / Won', 'Lost / Dropped', 'payment_done',
          'converted', 'not_interested'
        ]
      },
      $or: [
        { followUpDate: { $ne: null } },
        { 'activeFollowUp.scheduledAt': { $ne: null }, 'activeFollowUp.status': { $nin: ['completed', 'cancelled', 'none'] } }
      ]
    });
    console.log(`⚠️  Case 3 (Terminal stage leads [Lost/Closed] with active follow-ups): ${terminalLeadsWithFollowUp} leads`);

    // 4. Orphaned open follow-up docs in FollowUp collection whose lead is completed or cancelled
    const openFollowUps = await followupsCollection.find({ status: { $in: ['open', 'postponed'] } }).toArray();
    let orphanedFollowUpsCount = 0;
    if (openFollowUps.length > 0) {
      const leadIds = openFollowUps.map(f => f.lead_id || f.leadId).filter(Boolean);
      const matchingInactiveLeads = await leadsCollection.find({
        _id: { $in: leadIds },
        $or: [
          { followUpStatus: { $in: ['completed', 'cancelled', 'none'] } },
          { 'activeFollowUp.status': { $in: ['completed', 'cancelled', 'none'] } }
        ]
      }).project({ _id: 1 }).toArray();

      const inactiveSet = new Set(matchingInactiveLeads.map(l => String(l._id)));
      orphanedFollowUpsCount = openFollowUps.filter(f => inactiveSet.has(String(f.lead_id || f.leadId))).length;
    }
    console.log(`⚠️  Case 4 (Open FollowUp documents for completed/cancelled leads): ${orphanedFollowUpsCount} records`);

    console.log('\n--------------------------------------------------------');
    console.log('RECOMMENDED IDEMPOTENT REPAIR (DO NOT RUN WITHOUT USER APPROVAL):');
    console.log('--------------------------------------------------------');
    console.log(`1. Clear activeFollowUp.scheduledAt = null for leads where followUpStatus in ['completed', 'cancelled', 'none'].`);
    console.log(`2. Update FollowUp collection status to 'completed' / 'cancelled' for leads already completed/cancelled.`);
    console.log('✅ Diagnostic finished safely. Zero mutations executed.\n');

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runDiagnostic();
