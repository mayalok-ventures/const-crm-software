/**
 * Safe Migration Script: Lead Stage & Status Synchronization & Normalization (Stage B3)
 *
 * Scans Lead documents where status and pipelineStage have drifted or where legacy
 * `pipeline_stage` field exists, and synchronizes them to canonical enum values.
 *
 * Usage:
 *   node backend/src/scripts/repairLeadStageStatus.js           (Dry Run by default)
 *   node backend/src/scripts/repairLeadStageStatus.js --apply   (Applies updates)
 */

const mongoose = require('mongoose');

const STATUS_TO_STAGE = {
  new_lead: 'new_lead',
  contacted: 'contacted',
  qualified: 'contacted',
  proposal_sent: 'application_submitted',
  converted: 'admitted',
  lost: 'rejected',
  not_interested: 'rejected',
};

const STAGE_TO_STATUS = {
  new_lead: 'new_lead',
  contacted: 'contacted',
  application_submitted: 'proposal_sent',
  offer_received: 'proposal_sent',
  visa_approved: 'converted',
  fee_paid: 'converted',
  enrolled: 'converted',
  admitted: 'converted',
  rejected: 'lost',
  withdrawn: 'lost',
};

async function repairLeadStageStatus(options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  console.log('='.repeat(75));
  console.log('🛠️  REPAIR: Lead Stage & Status Synchronization');
  console.log(`🔒 Mode: ${isApply ? 'APPLY (Active Database Writes)' : 'DRY RUN (Read Only Preview)'}`);
  console.log('='.repeat(75));

  const Lead = mongoose.models.Lead || require('../models/Lead');

  const query = {
    $or: [
      { pipelineStage: null },
      { pipelineStage: { $exists: false } },
      { pipeline_stage: { $exists: true, $ne: null } },
      { status: null },
      { status: { $exists: false } },
    ],
  };

  const totalCandidates = await Lead.countDocuments(query);
  console.log(`📊 Found ${totalCandidates} lead(s) requiring stage/status normalization.`);

  if (totalCandidates === 0) {
    console.log('✅ All leads have synchronized canonical stage and status. Zero repairs needed.\n');
    return { total: 0, repaired: 0 };
  }

  let scanned = 0;
  let repairedCount = 0;
  const cursor = Lead.find(query).cursor();

  for await (const lead of cursor) {
    scanned++;
    if (scanned % 500 === 0) {
      console.log(`  ⏳ Processed ${scanned}/${totalCandidates} leads...`);
    }

    const updates = {};
    const legacyStage = lead.get('pipeline_stage');
    let effectiveStage = lead.pipelineStage || legacyStage;
    let effectiveStatus = lead.status;

    if (!effectiveStage && effectiveStatus) {
      effectiveStage = STATUS_TO_STAGE[effectiveStatus] || 'new_lead';
      updates.pipelineStage = effectiveStage;
    } else if (!effectiveStatus && effectiveStage) {
      effectiveStatus = STAGE_TO_STATUS[effectiveStage] || 'new_lead';
      updates.status = effectiveStatus;
    }

    if (legacyStage !== undefined && legacyStage !== null) {
      updates.pipelineStage = legacyStage;
    }

    if (Object.keys(updates).length > 0) {
      repairedCount++;
      if (isApply) {
        await Lead.collection.updateOne({ _id: lead._id }, { $set: updates, $unset: { pipeline_stage: '' } });
      }
    }
  }

  console.log('\n' + '='.repeat(75));
  console.log(`SUMMARY: ${repairedCount} lead(s) ${isApply ? 'repaired and normalized' : 'would be repaired (dry run)'}.`);
  console.log('='.repeat(75) + '\n');

  return { total: totalCandidates, repaired: repairedCount, mode: isApply ? 'apply' : 'dry-run' };
}

if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  mongoose.connect(mongoUri)
    .then(async () => {
      await repairLeadStageStatus();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal Lead Stage/Status Repair Error:', err.message);
      process.exit(1);
    });
}

module.exports = { repairLeadStageStatus };
