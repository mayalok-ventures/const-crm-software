/**
 * Prune Redundant and Overlapping Indexes on Lead Collection (F2.2 & Stage B2)
 *
 * Drops redundant single-field and overlapping compound indexes on `leads`
 * while strictly guarding top 10 query plans against regressions (IXSCAN -> COLLSCAN)
 * and outputting exact rollback createIndex statements.
 *
 * Usage:
 *   node backend/src/scripts/pruneRedundantLeadIndexes.js           (Dry Run by default)
 *   node backend/src/scripts/pruneRedundantLeadIndexes.js --apply   (Applies drops with explain guard)
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

const TOP_10_QUERIES = [
  { name: 'Workspace Leads by CreatedAt', filter: () => ({ workspaceId: new mongoose.Types.ObjectId(), deletedAt: null }), sort: { createdAt: -1 } },
  { name: 'Workspace Leads by Status', filter: () => ({ workspaceId: new mongoose.Types.ObjectId(), status: 'new_lead', deletedAt: null }) },
  { name: 'Workspace Phone Search', filter: () => ({ workspaceId: new mongoose.Types.ObjectId(), phone: '9876543210', deletedAt: null }) },
  { name: 'Counselor Assigned Leads', filter: () => ({ workspaceId: new mongoose.Types.ObjectId(), assignedTo: new mongoose.Types.ObjectId(), deletedAt: null }) },
  { name: 'Pipeline Stage Filtering', filter: () => ({ workspaceId: new mongoose.Types.ObjectId(), pipelineStage: 'contacted', deletedAt: null }) },
  { name: 'Follow-up Due Query', filter: () => ({ workspaceId: new mongoose.Types.ObjectId(), followUpDate: { $lte: new Date() }, deletedAt: null }) },
  { name: 'Source Analytics Query', filter: () => ({ workspaceId: new mongoose.Types.ObjectId(), source: 'meta', deletedAt: null }) },
  { name: 'Email Direct Lookup', filter: () => ({ workspaceId: new mongoose.Types.ObjectId(), email: 'lookup@example.com', deletedAt: null }) },
  { name: 'Global Assigned Leads', filter: () => ({ assignedTo: new mongoose.Types.ObjectId(), deletedAt: null }) },
  { name: 'Unassigned Leads Pool', filter: () => ({ workspaceId: new mongoose.Types.ObjectId(), assignedTo: null, deletedAt: null }) },
];

function isIndexScan(stage) {
  if (!stage) return false;
  if (stage.stage === 'IXSCAN') return true;
  if (stage.inputStage) return isIndexScan(stage.inputStage);
  if (stage.inputStages) return stage.inputStages.some(isIndexScan);
  return false;
}

async function verifyQueryPlans(collection) {
  const plans = {};
  for (const q of TOP_10_QUERIES) {
    let cursor = collection.find(q.filter());
    if (q.sort) cursor = cursor.sort(q.sort);
    const exp = await cursor.explain('executionStats');
    const winningStage = exp.queryPlanner?.winningPlan;
    const hasIxScan = isIndexScan(winningStage);
    plans[q.name] = { hasIxScan, stage: winningStage?.stage };
  }
  return plans;
}

async function pruneRedundantIndexes(dbConnection, options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  const collection = dbConnection.collection('leads');

  const existingIndexes = await collection.listIndexes().toArray();
  const existingMap = new Map(existingIndexes.map((idx) => [idx.name, idx]));

  const toDropNames = REDUNDANT_INDEXES.filter((name) => existingMap.has(name));
  const toDropDocs = toDropNames.map((name) => existingMap.get(name));

  console.log(`[Lead Index Prune] Total existing indexes: ${existingIndexes.length}`);
  console.log(`[Lead Index Prune] Identified ${toDropNames.length} redundant indexes to prune.`);

  // 1. Generate Rollback Statements for all prune candidates
  const rollbackStatements = toDropDocs.map((idx) => {
    const opts = {};
    if (idx.unique) opts.unique = true;
    if (idx.sparse) opts.sparse = true;
    if (idx.partialFilterExpression) opts.partialFilterExpression = idx.partialFilterExpression;
    opts.name = idx.name;
    return `await db.collection('leads').createIndex(${JSON.stringify(idx.key)}, ${JSON.stringify(opts)});`;
  });

  console.log('\n📜 ========================================================');
  console.log('   EXACT ROLLBACK STATEMENTS (Copy in case of regression)');
  console.log('========================================================');
  rollbackStatements.forEach((stmt) => console.log(stmt));
  console.log('========================================================\n');

  // 2. Pre-prune Query Plan Explain Verification
  console.log('🔍 Benchmarking top 10 query plans before pruning...');
  const beforePlans = await verifyQueryPlans(collection);
  Object.entries(beforePlans).forEach(([name, p]) => {
    console.log(`  - ${name.padEnd(32)}: ${p.hasIxScan ? '✅ IXSCAN' : '⚠️ ' + p.stage}`);
  });

  if (!isApply) {
    console.log('\n[Lead Index Prune] DRY RUN mode active (no changes applied).');
    toDropNames.forEach((name, i) => {
      console.log(`  ${i + 1}. [DRY RUN] Would drop index: ${name}`);
    });
    console.log('[Lead Index Prune] Pass --apply to drop these indexes with explain plan guards.');
    return {
      mode: 'dry-run',
      beforeCount: existingIndexes.length,
      wouldDropCount: toDropNames.length,
      projectedCount: existingIndexes.length - toDropNames.length,
      dropped: [],
      rollbackStatements,
    };
  }

  // 3. Drop redundant indexes
  const dropped = [];
  for (const indexName of toDropNames) {
    try {
      await collection.dropIndex(indexName);
      dropped.push(indexName);
      console.log(`  ✓ Dropped index: ${indexName}`);
    } catch (err) {
      console.warn(`  ✗ Failed to drop index ${indexName}:`, err.message);
    }
  }

  // 4. Post-prune Query Plan Explain Verification & Guard
  console.log('\n🔍 Re-verifying top 10 query plans after index pruning...');
  const afterPlans = await verifyQueryPlans(collection);
  let regressionDetected = false;

  for (const q of TOP_10_QUERIES) {
    const before = beforePlans[q.name];
    const after = afterPlans[q.name];
    if (before.hasIxScan && !after.hasIxScan) {
      console.error(`🚨 [QUERY REGRESSION] Top query "${q.name}" regressed from IXSCAN to ${after.stage}!`);
      regressionDetected = true;
    } else {
      console.log(`  - ${q.name.padEnd(32)}: ${after.hasIxScan ? '✅ IXSCAN' : 'ℹ️ ' + after.stage}`);
    }
  }

  if (regressionDetected) {
    console.error('\n💥 [FATAL REGRESSION] Index pruning degraded top query execution plans. Executing rollback...');
    for (const idx of toDropDocs) {
      try {
        const opts = { name: idx.name };
        if (idx.unique) opts.unique = true;
        if (idx.sparse) opts.sparse = true;
        if (idx.partialFilterExpression) opts.partialFilterExpression = idx.partialFilterExpression;
        await collection.createIndex(idx.key, opts);
        console.log(`  ↩️ Recreated index: ${idx.name}`);
      } catch (rbErr) {
        console.error(`  ✗ Failed to rollback index ${idx.name}:`, rbErr.message);
      }
    }
    throw new Error('PRUNING_ABORTED_QUERY_REGRESSION: One or more top queries lost index coverage.');
  }

  const remainingIndexes = await collection.listIndexes().toArray();
  console.log(`\n[Lead Index Prune] Completed cleanly. Remaining indexes: ${remainingIndexes.length}`);

  return {
    mode: 'apply',
    beforeCount: existingIndexes.length,
    droppedCount: dropped.length,
    remainingCount: remainingIndexes.length,
    dropped,
    rollbackStatements,
  };
}

if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  mongoose.connect(mongoUri)
    .then(async () => {
      const res = await pruneRedundantIndexes(mongoose.connection, { apply: process.argv.includes('--apply') });
      console.log('[Lead Index Prune] Summary:', res);
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Lead Index Prune] Error:', err.message);
      process.exit(1);
    });
}

module.exports = {
  REDUNDANT_INDEXES,
  TOP_10_QUERIES,
  pruneRedundantIndexes,
};
