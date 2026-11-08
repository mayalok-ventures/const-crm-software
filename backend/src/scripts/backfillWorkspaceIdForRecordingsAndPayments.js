/**
 * Idempotent Backfill Script: Recording & Payment workspaceId Derivation
 *
 * Scans all Recording and Payment documents where workspaceId is null, undefined, or missing,
 * resolves workspaceId from their parent Lead, and assigns it.
 *
 * Default mode: DRY RUN (no modifications)
 * To apply updates: node src/scripts/backfillWorkspaceIdForRecordingsAndPayments.js --apply
 */

const mongoose = require('mongoose');

async function runBackfill(options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  console.log(`\n============================================================`);
  console.log(`🛠️  BACKFILL: Recording & Payment workspaceId Derivation`);
  console.log(`🔒 Mode: ${isApply ? 'APPLY (Active Database Writes)' : 'DRY RUN (Read Only Preview)'}`);
  console.log(`============================================================\n`);

  const Recording = require('../models/Recording');
  const Payment = require('../models/Payment');
  const Lead = require('../models/Lead');

  const query = {
    $or: [{ workspaceId: null }, { workspaceId: { $exists: false } }],
  };

  // 1. Process Recordings
  const totalRecordings = await Recording.countDocuments(query);
  console.log(`🎙️  Found ${totalRecordings} recordings with missing workspaceId.`);

  let recResolved = 0;
  let recUnresolved = 0;

  const recCursor = Recording.find(query).cursor();
  for await (const rec of recCursor) {
    if (rec.leadId) {
      const lead = await Lead.findById(rec.leadId).select('workspaceId').lean();
      if (lead && lead.workspaceId) {
        recResolved++;
        if (isApply) {
          await Recording.updateOne({ _id: rec._id }, { $set: { workspaceId: lead.workspaceId } });
        }
      } else {
        recUnresolved++;
      }
    } else {
      recUnresolved++;
    }
  }

  // 2. Process Payments
  const totalPayments = await Payment.countDocuments(query);
  console.log(`💳 Found ${totalPayments} payments with missing workspaceId.`);

  let payResolved = 0;
  let payUnresolved = 0;

  const payCursor = Payment.find(query).cursor();
  for await (const pay of payCursor) {
    const parentLeadId = pay.leadId || pay.lead_id;
    if (parentLeadId) {
      const lead = await Lead.findById(parentLeadId).select('workspaceId').lean();
      if (lead && lead.workspaceId) {
        payResolved++;
        if (isApply) {
          await Payment.updateOne({ _id: pay._id }, { $set: { workspaceId: lead.workspaceId } });
        }
      } else {
        payUnresolved++;
      }
    } else {
      payUnresolved++;
    }
  }

  console.log(`\n============================================================`);
  console.log(`📋 BACKFILL SUMMARY:`);
  console.log(`  Recordings:`);
  console.log(`    - Scanned:      ${totalRecordings}`);
  console.log(`    - Resolvable:   ${recResolved}`);
  console.log(`    - Unresolvable: ${recUnresolved}`);
  console.log(`  Payments:`);
  console.log(`    - Scanned:      ${totalPayments}`);
  console.log(`    - Resolvable:   ${payResolved}`);
  console.log(`    - Unresolvable: ${payUnresolved}`);
  console.log(`============================================================\n`);

  if (!isApply && (recResolved > 0 || payResolved > 0)) {
    console.log(`ℹ️  To commit these updates, run:`);
    console.log(`   node src/scripts/backfillWorkspaceIdForRecordingsAndPayments.js --apply\n`);
  }

  return {
    recordings: { total: totalRecordings, resolved: recResolved, unresolved: recUnresolved },
    payments: { total: totalPayments, resolved: payResolved, unresolved: payUnresolved },
  };
}

if (require.main === module) {
  const connectDB = require('../config/db');
  connectDB().then(async () => {
    try {
      await runBackfill();
      process.exit(0);
    } catch (err) {
      console.error('Backfill error:', err);
      process.exit(1);
    }
  });
}

module.exports = { runBackfill };
