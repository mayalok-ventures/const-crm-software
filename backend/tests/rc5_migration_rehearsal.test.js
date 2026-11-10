/**
 * RC-5 Release Gate Test: Item 6 - Comprehensive Migration Rehearsal
 *
 * Verifies:
 * 1. Duplicate phone guard in syncIndexes.js refuses safely and logs duplicates.
 * 2. Every migration script executes:
 *    - Dry Run (zero mutations preview)
 *    - Apply (safe mutation)
 *    - Re-run (strict idempotency: zero pending updates)
 * 3. Exact before/after document counts recorded across all collections.
 * 4. Backup & Restore verification drill with SHA-256 checksum parity.
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BSON } = require('mongodb');

process.env.NODE_ENV = 'test';
process.env.WA_ENCRYPTION_KEY = 'f'.repeat(64);
process.env.WA_ACTIVE_KEY_ID = 'k1';

const { syncAllIndexes } = require('../src/scripts/syncIndexes');
const { runTokenVersionBackfill } = require('../src/scripts/backfillTokenVersion');
const { runBackfill: runWsBackfill } = require('../src/scripts/backfillLegacyLeadWorkspaceId');
const { runBackfill: runRecPayWsBackfill } = require('../src/scripts/backfillWorkspaceIdForRecordingsAndPayments');
const { runReconciliation: runPaymentReconcile } = require('../src/scripts/reconcilePaymentFieldPairs');
const { pruneRedundantIndexes } = require('../src/scripts/pruneRedundantLeadIndexes');
const { runWaAuthMigration } = require('../src/scripts/migrateWaAuthEncryption');

function computeChecksum(docs) {
  const sorted = [...docs].sort((a, b) => String(a._id).localeCompare(String(b._id)));
  const serialized = JSON.stringify(sorted, (key, value) => {
    if (value instanceof Date) return value.toISOString();
    return value;
  });
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

async function runRehearsal() {
  console.log('='.repeat(75));
  console.log('🧪 RC-5 ITEM 6: FULL DATABASE MIGRATION REHEARSAL & IDEMPOTENCY DRILL');
  console.log('='.repeat(75));

  const mongodSrc = await MongoMemoryServer.create();
  const srcUri = mongodSrc.getUri();
  await mongoose.connect(srcUri);

  const User = require('../src/models/User');
  const Lead = require('../src/models/Lead');
  const Workspace = require('../src/models/Workspace');
  const Payment = require('../src/models/Payment');
  const Recording = require('../src/models/Recording');
  const WhatsAppAuth = require('../src/models/WhatsAppAuth');

  const ownerId = new mongoose.Types.ObjectId();
  const wsId = new mongoose.Types.ObjectId();

  // -------------------------------------------------------------
  // Seed Base Fixtures
  // -------------------------------------------------------------
  console.log('\n--- 1. Seeding Base Rehearsal Fixtures ---');
  await Workspace.create({
    _id: wsId,
    name: 'Rehearsal Workspace',
    ownerId,
  });

  const legacyUserId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id: legacyUserId,
    name: 'Legacy Counselor',
    email: 'counselor.legacy@crm.local',
    phone: '9876543211',
    companyId: ownerId,
    // tokenVersion omitted
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const legacyLeadId = new mongoose.Types.ObjectId();
  await Lead.collection.insertOne({
    _id: legacyLeadId,
    name: 'Legacy Unscoped Lead',
    phone: '9888877771',
    userId: legacyUserId,
    companyId: ownerId,
    status: 'new',
    // workspaceId omitted
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const scopedLeadId = new mongoose.Types.ObjectId();
  await Lead.create({
    _id: scopedLeadId,
    name: 'Scoped Lead',
    phone: '9888877772',
    workspaceId: wsId,
    userId: legacyUserId,
    companyId: ownerId,
    status: 'new',
  });

  const recId = new mongoose.Types.ObjectId();
  await Recording.collection.insertOne({
    _id: recId,
    leadId: scopedLeadId,
    recordingUrl: 'https://example.com/audio1.mp3',
    // workspaceId omitted
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const pay1Id = new mongoose.Types.ObjectId();
  await Payment.collection.insertOne({
    _id: pay1Id,
    leadId: scopedLeadId,
    lead_id: scopedLeadId,
    amount: 10000,
    status: 'completed',
    // workspaceId omitted
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const pay2Id = new mongoose.Types.ObjectId();
  await Payment.collection.insertOne({
    _id: pay2Id,
    lead_id: scopedLeadId,
    amount: 15000,
    verified_by_agent: true,
    // verifiedByAgent omitted (drifted)
    transaction_id: 'TXN-DRIFT-001',
    // transactionId omitted (drifted)
    workspaceId: wsId,
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const waAuthId = new mongoose.Types.ObjectId();
  await WhatsAppAuth.collection.insertOne({
    _id: waAuthId,
    sessionId: 'rehearsal_sess',
    key: 'creds',
    data: JSON.stringify({ me: { id: '919876543211@s.whatsapp.net' } }),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const countsBefore = {
    users: await User.countDocuments(),
    workspaces: await Workspace.countDocuments(),
    leads: await Lead.countDocuments(),
    recordings: await Recording.countDocuments(),
    payments: await Payment.countDocuments(),
    whatsappauths: await WhatsAppAuth.countDocuments(),
  };
  console.log('📊 Counts Before Migration:');
  console.table(countsBefore);

  // -------------------------------------------------------------
  // Backup Drill: Capture Snapshot
  // -------------------------------------------------------------
  console.log('\n--- 2. Backup Snapshot Phase ---');
  const backupDir = path.resolve(__dirname, '../../scratch/rc5_migration_backup');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const collections = ['users', 'workspaces', 'leads', 'recordings', 'payments', 'whatsappauths'];
  const snapshotChecksums = {};
  for (const col of collections) {
    const docs = await mongoose.connection.collection(col).find({}).toArray();
    snapshotChecksums[col] = computeChecksum(docs);
    const buf = BSON.serialize({ docs });
    fs.writeFileSync(path.join(backupDir, `${col}.bson`), buf);
  }
  console.log('✅ BSON snapshot and SHA-256 baseline checksums computed.');

  // -------------------------------------------------------------
  // Duplicate Phone Precheck Guard in syncIndexes.js
  // -------------------------------------------------------------
  console.log('\n--- 3. Duplicate Phone Precheck Guard in syncIndexes.js ---');
  // Seed duplicate phone lead in the same workspace
  const dupLeadId = new mongoose.Types.ObjectId();
  await Lead.collection.insertOne({
    _id: dupLeadId,
    name: 'Duplicate Phone Lead',
    phone: '9888877772', // Collision with scopedLeadId!
    workspaceId: wsId,
    userId: legacyUserId,
    companyId: ownerId,
    status: 'new',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  let duplicateRefused = false;
  let duplicateError = null;
  try {
    await syncAllIndexes({ apply: true });
  } catch (err) {
    duplicateRefused = true;
    duplicateError = err;
  }
  assert.strictEqual(duplicateRefused, true, 'syncIndexes must refuse to build indexes when duplicate phone exists');
  assert.strictEqual(duplicateError.code, 'ERR_DUPLICATE_PHONE_CONFLICT');
  assert.ok(duplicateError.duplicates.length >= 1, 'Error must report colliding duplicate details');
  console.log('✅ duplicate phone collision detected and safely refused before index generation.');

  // Clean up duplicate lead to proceed with migration rehearsal
  await Lead.collection.deleteOne({ _id: dupLeadId });

  // -------------------------------------------------------------
  // Script 1: syncIndexes.js
  // -------------------------------------------------------------
  console.log('\n--- 4. Script 1: syncIndexes.js ---');
  // Dry-run
  const syncDry = await syncAllIndexes({ apply: false });
  assert.ok(syncDry.Lead, 'Must inspect Lead indexes');
  console.log('  ✓ syncIndexes dry-run succeeded');

  // Apply
  const syncApply = await syncAllIndexes({ apply: true });
  assert.ok(syncApply.Lead, 'Must apply Lead indexes');
  console.log('  ✓ syncIndexes apply succeeded');

  // Idempotency
  const syncRepeat = await syncAllIndexes({ apply: true });
  assert.ok(syncRepeat.Lead, 'Second run must succeed cleanly without errors');
  console.log('  ✓ syncIndexes idempotency confirmed');

  // -------------------------------------------------------------
  // Script 2: backfillTokenVersion.js
  // -------------------------------------------------------------
  console.log('\n--- 5. Script 2: backfillTokenVersion.js ---');
  const tokenDry = await runTokenVersionBackfill({ apply: false });
  assert.strictEqual(tokenDry.total, 1, 'Must find 1 user missing tokenVersion');
  let userDoc = await User.findById(legacyUserId).lean();
  assert.strictEqual(userDoc.tokenVersion, undefined, 'Dry-run must not mutate user');

  const tokenApply = await runTokenVersionBackfill({ apply: true });
  assert.strictEqual(tokenApply.updated, 1);
  userDoc = await User.findById(legacyUserId).lean();
  assert.strictEqual(userDoc.tokenVersion, 0, 'Apply must initialize tokenVersion: 0');

  const tokenRepeat = await runTokenVersionBackfill({ apply: true });
  assert.strictEqual(tokenRepeat.total, 0, 'Idempotent re-run must find 0 users missing tokenVersion');
  console.log('  ✓ backfillTokenVersion verified (dry-run, apply, idempotency)');

  // -------------------------------------------------------------
  // Script 3: backfillLegacyLeadWorkspaceId.js
  // -------------------------------------------------------------
  console.log('\n--- 6. Script 3: backfillLegacyLeadWorkspaceId.js ---');
  const wsDry = await runWsBackfill({ apply: false });
  assert.strictEqual(wsDry.total, 1);
  assert.strictEqual(wsDry.resolved, 1);
  let leadDoc = await Lead.findById(legacyLeadId).lean();
  assert.strictEqual(leadDoc.workspaceId, undefined, 'Dry-run must not mutate lead');

  const wsApply = await runWsBackfill({ apply: true });
  assert.strictEqual(wsApply.resolved, 1);
  leadDoc = await Lead.findById(legacyLeadId).lean();
  assert.strictEqual(leadDoc.workspaceId.toString(), wsId.toString(), 'Apply must resolve to workspace');

  const wsRepeat = await runWsBackfill({ apply: true });
  assert.strictEqual(wsRepeat.total, 0, 'Idempotent re-run must find 0 unscoped leads');
  console.log('  ✓ backfillLegacyLeadWorkspaceId verified (dry-run, apply, idempotency)');

  // -------------------------------------------------------------
  // Script 4: backfillWorkspaceIdForRecordingsAndPayments.js
  // -------------------------------------------------------------
  console.log('\n--- 7. Script 4: backfillWorkspaceIdForRecordingsAndPayments.js ---');
  const recPayDry = await runRecPayWsBackfill({ apply: false });
  assert.strictEqual(recPayDry.recordings.total, 1);
  assert.strictEqual(recPayDry.payments.total, 1);
  let recDoc = await Recording.findById(recId).lean();
  assert.strictEqual(recDoc.workspaceId, undefined);

  const recPayApply = await runRecPayWsBackfill({ apply: true });
  assert.strictEqual(recPayApply.recordings.resolved, 1);
  assert.strictEqual(recPayApply.payments.resolved, 1);
  recDoc = await Recording.findById(recId).lean();
  assert.strictEqual(recDoc.workspaceId.toString(), wsId.toString());

  const recPayRepeat = await runRecPayWsBackfill({ apply: true });
  assert.strictEqual(recPayRepeat.recordings.total, 0);
  assert.strictEqual(recPayRepeat.payments.total, 0);
  console.log('  ✓ backfillWorkspaceIdForRecordingsAndPayments verified (dry-run, apply, idempotency)');

  // -------------------------------------------------------------
  // Script 5: reconcilePaymentFieldPairs.js
  // -------------------------------------------------------------
  console.log('\n--- 8. Script 5: reconcilePaymentFieldPairs.js ---');
  const payReconcileDry = await runPaymentReconcile({ apply: false });
  assert.strictEqual(payReconcileDry.drifted, 1);
  let pay2Doc = await Payment.findById(pay2Id).lean();
  assert.strictEqual(pay2Doc.verifiedByAgent, undefined);

  const payReconcileApply = await runPaymentReconcile({ apply: true });
  assert.strictEqual(payReconcileApply.drifted, 1);
  pay2Doc = await Payment.findById(pay2Id).lean();
  assert.strictEqual(pay2Doc.verifiedByAgent, true);
  assert.strictEqual(pay2Doc.transactionId, 'TXN-DRIFT-001');

  const payReconcileRepeat = await runPaymentReconcile({ apply: true });
  assert.strictEqual(payReconcileRepeat.drifted, 0, 'Idempotent re-run must find 0 drifted payments');
  console.log('  ✓ reconcilePaymentFieldPairs verified (dry-run, apply, idempotency)');

  // -------------------------------------------------------------
  // Script 6: pruneRedundantLeadIndexes.js
  // -------------------------------------------------------------
  console.log('\n--- 9. Script 6: pruneRedundantLeadIndexes.js ---');
  // Seed a redundant legacy index to test pruning
  await Lead.collection.createIndex({ campaignId: 1 }, { name: 'campaignId_1' });
  await Lead.collection.createIndex({ score: 1 }, { name: 'score_1' });

  const pruneDry = await pruneRedundantIndexes(mongoose.connection, { apply: false });
  console.log(`  [Prune Dry Run] Found ${pruneDry.wouldDropCount} redundant indexes`);
  assert.strictEqual(pruneDry.wouldDropCount, 2, 'Dry-run must detect 2 redundant indexes');

  const pruneApply = await pruneRedundantIndexes(mongoose.connection, { apply: true });
  console.log(`  [Prune Apply] Successfully dropped ${pruneApply.droppedCount} redundant indexes`);
  assert.strictEqual(pruneApply.droppedCount, 2, 'Apply must drop 2 redundant indexes');

  const pruneRepeat = await pruneRedundantIndexes(mongoose.connection, { apply: true });
  assert.strictEqual(pruneRepeat.droppedCount, 0, 'Idempotent re-run must find 0 redundant indexes');
  console.log('  ✓ pruneRedundantLeadIndexes verified (dry-run, apply, idempotency)');

  // -------------------------------------------------------------
  // Script 7: migrateWaAuthEncryption.js
  // -------------------------------------------------------------
  console.log('\n--- 10. Script 7: migrateWaAuthEncryption.js ---');
  const waDry = await runWaAuthMigration({ apply: false });
  assert.strictEqual(waDry.migrated, 1);
  let rawWaDoc = await WhatsAppAuth.findById(waAuthId).lean();
  assert.ok(!rawWaDoc.data.startsWith('enc:'), 'Dry run must not encrypt record');

  const waApply = await runWaAuthMigration({ apply: true });
  assert.strictEqual(waApply.migrated, 1);
  rawWaDoc = await WhatsAppAuth.findById(waAuthId).lean();
  assert.ok(rawWaDoc.data.startsWith('enc:'), 'Apply must encrypt record with enc: prefix');

  const waRepeat = await runWaAuthMigration({ apply: true });
  assert.strictEqual(waRepeat.alreadyUpToDate, 1);
  assert.strictEqual(waRepeat.migrated, 0, 'Idempotent re-run must migrate 0 records');
  console.log('  ✓ migrateWaAuthEncryption verified (dry-run, apply, idempotency)');

  // -------------------------------------------------------------
  // Record Post-Migration Counts
  // -------------------------------------------------------------
  console.log('\n--- 11. Post-Migration Counts & Verification ---');
  const countsAfter = {
    users: await User.countDocuments(),
    workspaces: await Workspace.countDocuments(),
    leads: await Lead.countDocuments(),
    recordings: await Recording.countDocuments(),
    payments: await Payment.countDocuments(),
    whatsappauths: await WhatsAppAuth.countDocuments(),
  };
  console.log('📊 Counts After Migration:');
  console.table(countsAfter);
  assert.deepStrictEqual(countsAfter, countsBefore, 'Document counts must remain identical after additive migrations');

  // -------------------------------------------------------------
  // Restoration Phase Drill: Restore Baseline Snapshot
  // -------------------------------------------------------------
  console.log('\n--- 12. Backup Restoration Drill ---');
  const mongodTgt = await MongoMemoryServer.create();
  const tgtConn = await mongoose.createConnection(mongodTgt.getUri()).asPromise();

  for (const col of collections) {
    const fileBuf = fs.readFileSync(path.join(backupDir, `${col}.bson`));
    const deserialized = BSON.deserialize(fileBuf);
    const docs = deserialized.docs || [];
    if (docs.length > 0) {
      await tgtConn.collection(col).insertMany(docs);
    }
    const restoredDocs = await tgtConn.collection(col).find({}).toArray();
    const restoredChecksum = computeChecksum(restoredDocs);
    assert.strictEqual(restoredChecksum, snapshotChecksums[col], `Restored checksum must match snapshot for ${col}`);
    console.log(`  ✓ Restored ${col}: ${restoredDocs.length} docs (SHA-256 Parity: 100% MATCH)`);
  }

  await tgtConn.close();
  await mongodTgt.stop();
  await mongoose.disconnect();
  await mongodSrc.stop();

  // Cleanup drill files
  fs.rmSync(backupDir, { recursive: true, force: true });

  console.log('\n🎉 ALL ITEM 6 MIGRATION REHEARSAL ASSERTIONS PASSED!\n');
  return true;
}

if (require.main === module) {
  runRehearsal()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration rehearsal failed:', err);
      process.exit(1);
    });
}

module.exports = { runRehearsal };
