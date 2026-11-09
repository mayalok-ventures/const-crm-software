/**
 * Safe Index Synchronization Script (Stage B2)
 *
 * Scans Mongoose models, identifies missing or drifted indexes,
 * enforces a strict duplicate-finder precheck before partial-unique index creation,
 * and builds indexes safely.
 *
 * Usage:
 *   node backend/src/scripts/syncIndexes.js           (Dry Run by default)
 *   node backend/src/scripts/syncIndexes.js --apply   (Applies index changes)
 */

const mongoose = require('mongoose');

const MONITORED_MODELS = [
  'Lead',
  'User',
  'Workspace',
  'WorkspaceMembership',
  'Payment',
  'FeeInstallment',
  'ImportJob',
  'AdmissionDeal',
  'AuditLog',
];

/**
 * Pre-check for duplicate phone numbers within the same workspace
 * Prevents catastrophic failure when building partial-unique index on { workspaceId: 1, phone: 1 }
 */
async function precheckLeadPhoneDuplicates(LeadModel) {
  const duplicates = await LeadModel.aggregate([
    {
      $match: {
        phone: { $type: 'string', $gt: '' },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: { workspaceId: '$workspaceId', phone: '$phone' },
        count: { $sum: 1 },
        leadIds: { $push: '$_id' },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
      },
    },
  ]);

  if (duplicates.length > 0) {
    console.error('\n🚨 ========================================================');
    console.error('   FATAL: DUPLICATE PHONE NUMBERS DETECTED IN WORKSPACES');
    console.error('========================================================');
    console.error(`Found ${duplicates.length} phone collision group(s) preventing unique index creation:\n`);

    duplicates.forEach((dup, i) => {
      console.error(`  [${i + 1}] Workspace: ${dup._id.workspaceId || 'NULL'}, Phone: "${dup._id.phone}"`);
      console.error(`      Colliding Lead IDs (${dup.count}): ${dup.leadIds.join(', ')}`);
    });

    console.error('\nABORTING: Clean up or merge the duplicate leads above before applying partial-unique index.\n');
    const err = new Error(`DUPLICATE_PHONE_CONFLICT: ${duplicates.length} duplicate groups detected in Lead collection.`);
    err.code = 'ERR_DUPLICATE_PHONE_CONFLICT';
    err.duplicates = duplicates;
    throw err;
  }

  console.log('✅ [Precheck] Zero duplicate phone collisions found in active leads.');
  return true;
}

async function syncAllIndexes(options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  console.log('='.repeat(75));
  console.log('🛠️  SAFE MONGOOSE INDEX SYNCHRONIZER');
  console.log(`🔒 Mode: ${isApply ? 'APPLY (Active Index Modifications)' : 'DRY RUN (Preview Only)'}`);
  console.log('='.repeat(75));

  // Ensure all monitored models are loaded
  MONITORED_MODELS.forEach((modelName) => {
    try {
      require(`../models/${modelName}`);
    } catch (err) {
      console.warn(`[SyncIndexes] Notice: Could not load model ${modelName}:`, err.message);
    }
  });

  const results = {};

  // 1. Mandatory Pre-check on Lead collection
  const Lead = mongoose.models.Lead;
  if (Lead) {
    console.log('\n🔍 Running duplicate pre-check on Lead collection...');
    await precheckLeadPhoneDuplicates(Lead);
  }

  // 2. Scan and sync monitored models
  for (const modelName of MONITORED_MODELS) {
    const Model = mongoose.models[modelName];
    if (!Model) continue;

    const collection = Model.collection;
    let existingIndexes = [];
    try {
      existingIndexes = await collection.listIndexes().toArray();
    } catch (err) {
      // Collection might not exist yet
      existingIndexes = [];
    }

    const existingNames = new Set(existingIndexes.map((idx) => idx.name));
    const schemaIndexes = Model.schema.indexes();

    const missingIndexes = [];
    for (const [fields, idxOpts] of schemaIndexes) {
      const generatedName = Object.entries(fields).map(([k, v]) => `${k}_${v}`).join('_');
      const targetName = idxOpts?.name || generatedName;
      if (!existingNames.has(targetName)) {
        missingIndexes.push({ name: targetName, fields, options: idxOpts || {} });
      }
    }

    console.log(`\n📦 Model: ${modelName.padEnd(20)} [Existing: ${existingIndexes.length}, Defined: ${schemaIndexes.length}, Missing: ${missingIndexes.length}]`);

    if (missingIndexes.length > 0) {
      missingIndexes.forEach((idx, i) => {
        console.log(`   ${i + 1}. ${isApply ? 'Creating' : 'Missing'}: ${idx.name} -> ${JSON.stringify(idx.fields)}`);
      });
    }

    if (isApply) {
      try {
        const syncResult = await Model.syncIndexes();
        results[modelName] = {
          status: 'applied',
          existingCount: existingIndexes.length,
          missingCount: missingIndexes.length,
          syncResult,
        };
        console.log(`   ✓ Sync applied successfully for ${modelName}`);
      } catch (syncErr) {
        console.error(`   ✗ Sync failed for ${modelName}:`, syncErr.message);
        results[modelName] = { status: 'error', error: syncErr.message };
        throw syncErr;
      }
    } else {
      results[modelName] = {
        status: 'dry-run',
        existingCount: existingIndexes.length,
        missingCount: missingIndexes.length,
        missingIndexes,
      };
    }
  }

  console.log('\n' + '='.repeat(75));
  console.log(`SUMMARY: Processed ${Object.keys(results).length} models in ${isApply ? 'APPLY' : 'DRY RUN'} mode.`);
  console.log('='.repeat(75) + '\n');

  return results;
}

if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  mongoose.connect(mongoUri)
    .then(async () => {
      await syncAllIndexes({ apply: process.argv.includes('--apply') });
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal Sync Error:', err.message);
      process.exit(1);
    });
}

module.exports = {
  syncAllIndexes,
  precheckLeadPhoneDuplicates,
  MONITORED_MODELS,
};
