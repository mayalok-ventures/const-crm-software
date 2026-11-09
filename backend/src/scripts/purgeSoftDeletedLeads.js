/**
 * Soft-Delete Retention Purge Script (Stage B4)
 *
 * Permanently deletes leads soft-deleted beyond the retention window (default: >90 days ago)
 * and purges linked deals, payments, installments, and recordings in the same transaction.
 *
 * Usage:
 *   node backend/src/scripts/purgeSoftDeletedLeads.js                           (Dry Run by default)
 *   node backend/src/scripts/purgeSoftDeletedLeads.js --apply                  (Applies permanent purge)
 *   node backend/src/scripts/purgeSoftDeletedLeads.js --apply --retention-days 60
 */

const mongoose = require('mongoose');

async function purgeSoftDeletedLeads(options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  const retentionDaysArg = options.retentionDays || (() => {
    const idx = process.argv.indexOf('--retention-days');
    return idx !== -1 ? Number(process.argv[idx + 1]) : 90;
  })();
  const retentionDays = Number.isFinite(retentionDaysArg) ? retentionDaysArg : 90;
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  console.log('='.repeat(75));
  console.log('🗑️  SOFT-DELETE RETENTION PURGE ENGINE');
  console.log(`🔒 Mode: ${isApply ? 'APPLY (Permanent Hard Deletes)' : 'DRY RUN (Preview Only)'}`);
  console.log(`⏱️  Retention Threshold: Older than ${retentionDays} days (Cutoff: ${cutoffDate.toISOString()})`);
  console.log('='.repeat(75));

  const Lead = mongoose.models.Lead || require('../models/Lead');
  const Payment = mongoose.models.Payment || require('../models/Payment');
  const FeeInstallment = mongoose.models.FeeInstallment || require('../models/FeeInstallment');
  const AdmissionDeal = mongoose.models.AdmissionDeal || require('../models/AdmissionDeal');
  const Recording = mongoose.models.Recording || require('../models/Recording');

  const purgeQuery = {
    deletedAt: { $ne: null, $lt: cutoffDate },
  };

  const totalCandidates = await Lead.countDocuments(purgeQuery);
  console.log(`📊 Found ${totalCandidates} lead(s) soft-deleted prior to cutoff.\n`);

  if (totalCandidates === 0) {
    console.log('✅ Zero leads exceed the retention window. Zero purge actions required.\n');
    return { totalCandidates: 0, purgedLeads: 0, cascadePurged: 0 };
  }

  const candidateLeads = await Lead.find(purgeQuery).select('_id name phone deletedAt').lean();
  const leadIds = candidateLeads.map((l) => l._id);

  // Discover cascade entities
  const linkedPayments = await Payment.countDocuments({
    $or: [{ leadId: { $in: leadIds } }, { lead_id: { $in: leadIds } }],
  });
  const linkedInstallments = await FeeInstallment.countDocuments({ leadId: { $in: leadIds } });
  const linkedDeals = await AdmissionDeal.countDocuments({ leadId: { $in: leadIds } });
  const linkedRecordings = await Recording.countDocuments({ leadId: { $in: leadIds } });
  const totalCascade = linkedPayments + linkedInstallments + linkedDeals + linkedRecordings;

  console.log('📦 Cascade Entities Identified for Purge:');
  console.log(`   - Linked Payments:      ${linkedPayments}`);
  console.log(`   - Fee Installments:     ${linkedInstallments}`);
  console.log(`   - Admission Deals:      ${linkedDeals}`);
  console.log(`   - Voice Recordings:     ${linkedRecordings}`);
  console.log(`   - Total Cascade Items:  ${totalCascade}`);

  if (!isApply) {
    console.log('\n[Dry Run] Sample Candidate Leads (max 5):');
    candidateLeads.slice(0, 5).forEach((l, i) => {
      console.log(`  ${i + 1}. Lead ID: ${l._id} (${l.name || 'Unnamed'}) - Soft Deleted: ${l.deletedAt.toISOString()}`);
    });
    console.log('\nℹ️  To permanently execute this purge in a transaction, pass --apply.');
    return {
      mode: 'dry-run',
      totalCandidates,
      totalCascade,
      leadIds,
    };
  }

  // Execute hard purge inside transaction
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(
      async () => {
        // 1. Purge payments
        await Payment.deleteMany(
          { $or: [{ leadId: { $in: leadIds } }, { lead_id: { $in: leadIds } }] },
          { session }
        );

        // 2. Purge fee installments
        await FeeInstallment.deleteMany({ leadId: { $in: leadIds } }, { session });

        // 3. Purge admission deals
        await AdmissionDeal.deleteMany({ leadId: { $in: leadIds } }, { session });

        // 4. Purge recordings
        await Recording.deleteMany({ leadId: { $in: leadIds } }, { session });

        // 5. Purge leads themselves
        const leadDeleteRes = await Lead.deleteMany({ _id: { $in: leadIds } }, { session });
        console.log(`\n✓ Successfully hard-deleted ${leadDeleteRes.deletedCount} leads and ${totalCascade} cascade items.`);
      },
      {
        writeConcern: { w: 'majority', j: true },
      }
    );
  } finally {
    await session.endSession();
  }

  console.log('\n' + '='.repeat(75));
  console.log(`SUMMARY: Permanently purged ${leadIds.length} leads and ${totalCascade} cascade items.`);
  console.log('='.repeat(75) + '\n');

  return {
    mode: 'apply',
    purgedLeadsCount: leadIds.length,
    purgedCascadeCount: totalCascade,
    purgedLeadIds: leadIds,
  };
}

if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  mongoose.connect(mongoUri)
    .then(async () => {
      await purgeSoftDeletedLeads();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal Purge Error:', err.message);
      process.exit(1);
    });
}

module.exports = { purgeSoftDeletedLeads };
