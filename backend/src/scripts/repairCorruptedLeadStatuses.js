const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Pipeline = require('../models/Pipeline');
const { mapStageToCanonicalStatus } = require('../utils/leadStageStatus');

/**
 * Repairs corrupted lead.status fields that contain raw stage IDs (e.g., 'stage_1730000000000').
 * Runs in dry-run mode by default. Pass --apply to persist changes.
 */
async function repairCorruptedLeadStatuses(options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  console.log(`[Status Repair] Starting in ${isApply ? 'APPLY' : 'DRY-RUN'} mode...`);

  // Find leads where status starts with stage_ or contains an internal ID
  const corruptedLeads = await Lead.find({
    $or: [
      { status: /^stage_/ },
      { status: { $regex: /^[a-f0-9]{24}$/ } }, // ObjectId-like string as status
    ],
  });

  console.log(`[Status Repair] Found ${corruptedLeads.length} leads with corrupted status.`);
  let repairedCount = 0;

  // Cache pipelines to avoid repetitive DB lookups
  const pipelineCache = new Map();

  for (const lead of corruptedLeads) {
    let pipeline = null;
    if (lead.pipelineId) {
      const pidStr = lead.pipelineId.toString();
      if (!pipelineCache.has(pidStr)) {
        pipelineCache.set(pidStr, await Pipeline.findById(lead.pipelineId));
      }
      pipeline = pipelineCache.get(pidStr);
    }

    let targetStage = null;
    if (pipeline && Array.isArray(pipeline.stages)) {
      targetStage = pipeline.stages.find(
        (s) => s.stageId === lead.pipelineStage || s.stageId === lead.status
      );
    }

    const canonicalStatus = mapStageToCanonicalStatus(targetStage || { stageId: lead.pipelineStage });

    console.log(
      `[Repair] Lead ${lead._id} (${lead.name}): status='${lead.status}', pipelineStage='${lead.pipelineStage}' -> New status: '${canonicalStatus}'`
    );

    if (isApply) {
      await Lead.updateOne(
        { _id: lead._id },
        {
          $set: {
            status: canonicalStatus,
          },
        }
      );
    }
    repairedCount++;
  }

  console.log(
    `[Status Repair] Completed. Evaluated: ${corruptedLeads.length}, Repaired: ${repairedCount}, Applied: ${isApply ? 'YES' : 'NO (Dry Run)'}.`
  );

  return { total: corruptedLeads.length, repaired: repairedCount, applied: isApply };
}

if (require.main === module) {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mobile-crm';
  mongoose
    .connect(mongoUri)
    .then(async () => {
      await repairCorruptedLeadStatuses();
      await mongoose.disconnect();
    })
    .catch((err) => {
      console.error('[Status Repair Error]:', err);
      process.exit(1);
    });
}

module.exports = { repairCorruptedLeadStatuses };
