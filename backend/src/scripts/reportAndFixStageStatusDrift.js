const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Pipeline = require('../models/Pipeline');
const { resolveStageAndStatus, mapStageToCanonicalStatus } = require('../utils/leadStageStatus');

/**
 * Report and Fix Stage and Status Drift across all Leads.
 * Runs in dry-run mode by default. Pass --apply to persist changes.
 */
async function reportAndFixStageStatusDrift(options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  console.log(`[Stage-Status Drift] Starting in ${isApply ? 'APPLY' : 'DRY-RUN'} mode...`);

  const leads = await Lead.find({});
  console.log(`[Stage-Status Drift] Scanning ${leads.length} leads...`);

  let driftedCount = 0;
  const pipelineCache = new Map();

  for (const lead of leads) {
    let pipeline = null;
    if (lead.pipelineId) {
      const pidStr = lead.pipelineId.toString();
      if (!pipelineCache.has(pidStr)) {
        pipelineCache.set(pidStr, await Pipeline.findById(lead.pipelineId));
      }
      pipeline = pipelineCache.get(pidStr);
    }

    const { status: expectedStatus } = resolveStageAndStatus({
      stageId: lead.pipelineStage,
      status: lead.status,
      pipeline,
    });

    const isRawStageId = typeof lead.status === 'string' && (lead.status.startsWith('stage_') || /^[a-f0-9]{24}$/.test(lead.status));
    const isDrifted = isRawStageId || (expectedStatus && lead.status !== expectedStatus);

    if (isDrifted) {
      driftedCount++;
      console.log(
        `[Drift Detected] Lead ${lead._id} (${lead.name}): status='${lead.status}', pipelineStage='${lead.pipelineStage}' -> Expected status='${expectedStatus}'`
      );

      if (isApply) {
        await Lead.updateOne(
          { _id: lead._id },
          {
            $set: {
              status: expectedStatus,
            },
          }
        );
      }
    }
  }

  console.log(
    `[Stage-Status Drift] Scan complete. Total: ${leads.length}, Drifted: ${driftedCount}, Applied: ${isApply ? 'YES' : 'NO (Dry Run)'}.`
  );

  return { total: leads.length, drifted: driftedCount, applied: isApply };
}

if (require.main === module) {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mobile-crm';
  mongoose
    .connect(mongoUri)
    .then(async () => {
      await reportAndFixStageStatusDrift();
      await mongoose.disconnect();
    })
    .catch((err) => {
      console.error('[Stage-Status Drift Error]:', err);
      process.exit(1);
    });
}

module.exports = { reportAndFixStageStatusDrift };
