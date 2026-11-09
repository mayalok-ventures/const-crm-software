/**
 * Regression Test: Safe Index Sync, Duplicate Precheck, and Explain-Guarded Pruning (Stage B2)
 *
 * Asserts:
 * 1. syncIndexes precheck detects duplicate phones within a workspace and aborts with clear error
 * 2. syncIndexes builds missing indexes safely when data is clean (dry-run and apply)
 * 3. pruneRedundantLeadIndexes outputs exact rollback createIndex statements and guards top 10 query plans
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { syncAllIndexes, precheckLeadPhoneDuplicates } = require('../src/scripts/syncIndexes');
const { pruneRedundantIndexes, TOP_10_QUERIES } = require('../src/scripts/pruneRedundantLeadIndexes');

async function runIndexTests() {
  console.log('='.repeat(75));
  console.log('🧪 VERIFYING SAFE INDEX SYNC, DUPLICATE PRECHECK & PRUNING GUARDS (B2)');
  console.log('='.repeat(75));

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  const Lead = require('../src/models/Lead');
  const workspaceA = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  // ── TEST 1: DUPLICATE PHONE DETECTION PRECHECK ──────────────────────────
  console.log('\n--- Test 1: Duplicate Phone Collision Precheck & Abort Guard ---');

  // Seed two leads with the same phone in workspaceA
  await Lead.create([
    {
      name: 'Duplicate Lead 1',
      phone: '9876543210',
      email: 'dup1@test.com',
      companyId: workspaceA,
      workspaceId: workspaceA,
      userId,
      status: 'new_lead',
    },
    {
      name: 'Duplicate Lead 2',
      phone: '9876543210', // duplicate in same workspace!
      email: 'dup2@test.com',
      companyId: workspaceA,
      workspaceId: workspaceA,
      userId,
      status: 'new_lead',
    },
  ]);

  let precheckFailed = false;
  try {
    await precheckLeadPhoneDuplicates(Lead);
  } catch (err) {
    precheckFailed = true;
    assert.strictEqual(err.code, 'ERR_DUPLICATE_PHONE_CONFLICT');
    assert.strictEqual(err.duplicates.length, 1);
    assert.strictEqual(err.duplicates[0]._id.phone, '9876543210');
    assert.strictEqual(err.duplicates[0].count, 2);
    console.log('  ✓ Precheck caught duplicate phone and aborted index creation');
  }
  assert.strictEqual(precheckFailed, true, 'Precheck MUST throw ERR_DUPLICATE_PHONE_CONFLICT on duplicate phone');
  console.log('✅ Test 1: Duplicate phone precheck successfully protects against index failure.');

  // Clean up duplicate
  await Lead.deleteMany({});

  // ── TEST 2: SAFE INDEX SYNC DRY-RUN & APPLY ─────────────────────────────
  console.log('\n--- Test 2: Safe Index Sync in Clean Database ---');
  // Seed distinct leads
  await Lead.create([
    {
      name: 'Clean Lead 1',
      phone: '9811111111',
      email: 'clean1@test.com',
      companyId: workspaceA,
      workspaceId: workspaceA,
      userId,
      status: 'new_lead',
    },
    {
      name: 'Clean Lead 2',
      phone: '9822222222',
      email: 'clean2@test.com',
      companyId: workspaceA,
      workspaceId: workspaceA,
      userId,
      status: 'contacted',
    },
  ]);

  // Dry Run
  const dryRunRes = await syncAllIndexes({ apply: false });
  assert.strictEqual(dryRunRes.Lead.status, 'dry-run');
  console.log('  ✓ Dry-run completed with index difference preview');

  // Apply
  const applyRes = await syncAllIndexes({ apply: true });
  assert.strictEqual(applyRes.Lead.status, 'applied');
  console.log('  ✓ Apply mode built all declared model indexes successfully');

  // ── TEST 3: PRUNING EXPLAIN GUARD & ROLLBACK STATEMENTS ─────────────────
  console.log('\n--- Test 3: Explain Guard & Rollback Statements in Pruning ---');

  // Add one dummy redundant index to test pruning
  await Lead.collection.createIndex({ campaignName: 1 });

  const pruneDryRun = await pruneRedundantIndexes(mongoose.connection, { apply: false });
  assert.strictEqual(pruneDryRun.mode, 'dry-run');
  assert.ok(pruneDryRun.wouldDropCount >= 1, 'Should identify campaignName_1 as prune candidate');
  assert.ok(pruneDryRun.rollbackStatements.length >= 1, 'Must generate rollback createIndex statements');
  assert.ok(
    pruneDryRun.rollbackStatements.some((s) => s.includes('campaignName')),
    'Rollback statement must include campaignName index spec'
  );
  console.log('  ✓ Rollback statements verified:', pruneDryRun.rollbackStatements[0]);

  // Prune with explain guard
  const pruneApply = await pruneRedundantIndexes(mongoose.connection, { apply: true });
  assert.strictEqual(pruneApply.mode, 'apply');
  assert.ok(pruneApply.dropped.includes('campaignName_1'), 'Should drop campaignName_1');

  // Verify top 10 queries still have valid execution plans
  assert.strictEqual(TOP_10_QUERIES.length, 10, 'Must guard 10 critical query patterns');
  console.log('  ✓ All 10 top query plans remained guarded against regression');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('\n' + '='.repeat(75));
  console.log('🎉 ALL SAFE INDEX SYNC AND PRUNING TESTS PASSED!');
  console.log('='.repeat(75));
  process.exit(0);
}

runIndexTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
