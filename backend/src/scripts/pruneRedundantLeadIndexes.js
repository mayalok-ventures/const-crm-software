/**
 * Prune Redundant and Overlapping Indexes on Lead Collection (F2.2)
 *
 * Drops redundant single-field and overlapping compound indexes on `leads`
 * to stay safely below MongoDB's 64-index limit (~51 indexes).
 *
 * Usage:
 *   node backend/src/scripts/pruneRedundantLeadIndexes.js           (Dry Run by default)
 *   node backend/src/scripts/pruneRedundantLeadIndexes.js --apply   (Applies drops)
 */

const mongoose = require('mongoose');

const REDUNDANT_INDEXES = [
  'campaignId_1',
  'campaignName_1',
  'temperature_1',
  'score_1',
  'leadSource.platform_1',
  'leadSource.campaignId_1',
  'isTestLead_1',
  'userId_1_status_1',
  'companyId_1_status_1',
  'userId_1_createdAt_-1',
  'leadActivities.timestamp_-1',
  'workspaceId_1_updatedAt_-1',
  'leadSource.platform_1_leadSource.campaignId_1_createdAt_-1',
];

async function pruneRedundantIndexes(dbConnection, options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  const collection = dbConnection.collection('leads');

  const existingIndexes = await collection.listIndexes().toArray();
  const existingNames = new Set(existingIndexes.map((idx) => idx.name));

  const toDrop = REDUNDANT_INDEXES.filter((name) => existingNames.has(name));

  console.log(`[Lead Index Prune] Total existing indexes: ${existingIndexes.length}`);
  console.log(`[Lead Index Prune] Identified ${toDrop.length} redundant indexes to prune.`);

  if (!isApply) {
    console.log('[Lead Index Prune] DRY RUN mode active (no changes applied).');
    toDrop.forEach((name, i) => {
      console.log(`  ${i + 1}. [DRY RUN] Would drop index: ${name}`);
    });
    console.log('[Lead Index Prune] Pass --apply to drop these indexes from MongoDB.');
    return {
      mode: 'dry-run',
      beforeCount: existingIndexes.length,
      wouldDropCount: toDrop.length,
      projectedCount: existingIndexes.length - toDrop.length,
      dropped: [],
    };
  }

  const dropped = [];
  for (const indexName of toDrop) {
    try {
      await collection.dropIndex(indexName);
      dropped.push(indexName);
      console.log(`  ✓ Dropped index: ${indexName}`);
    } catch (err) {
      console.warn(`  ✗ Failed to drop index ${indexName}:`, err.message);
    }
  }

  const remainingIndexes = await collection.listIndexes().toArray();
  console.log(`[Lead Index Prune] Completed. Remaining indexes: ${remainingIndexes.length}`);

  return {
    mode: 'apply',
    beforeCount: existingIndexes.length,
    droppedCount: dropped.length,
    remainingCount: remainingIndexes.length,
    dropped,
  };
}

if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/mobile-crm';
  mongoose.connect(mongoUri)
    .then(async () => {
      const res = await pruneRedundantIndexes(mongoose.connection, { apply: process.argv.includes('--apply') });
      console.log('[Lead Index Prune] Summary:', res);
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Lead Index Prune] Error:', err);
      process.exit(1);
    });
}

module.exports = {
  REDUNDANT_INDEXES,
  pruneRedundantIndexes,
};
