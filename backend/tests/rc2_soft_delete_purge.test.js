/**
 * Regression Test: Soft-Delete Retention Purge & Transactional Cascade Cleanup (Stage B4)
 *
 * Asserts:
 * 1. Leads soft-deleted > 90 days ago are identified for purge
 * 2. Recent soft-deleted (<90 days) and active leads are strictly preserved
 * 3. Dry-run mode produces preview without deleting any documents
 * 4. Apply mode executes inside a transaction, purging leads and cascade entities (payments, deals, recordings)
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { purgeSoftDeletedLeads } = require('../src/scripts/purgeSoftDeletedLeads');

async function runPurgeTests() {
  console.log('='.repeat(75));
  console.log('🧪 VERIFYING SOFT-DELETE RETENTION PURGE & TRANSACTIONAL CASCADE (B4)');
  console.log('='.repeat(75));

  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  const Lead = require('../src/models/Lead');
  const Payment = require('../src/models/Payment');
  const FeeInstallment = require('../src/models/FeeInstallment');
  const AdmissionDeal = require('../src/models/AdmissionDeal');
  const Recording = require('../src/models/Recording');

  const companyId = new mongoose.Types.ObjectId();
  const workspaceId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  // 1. Seed Lead A: Expired Soft-Deleted Lead (>90 days)
  const leadA = await Lead.collection.insertOne({
    name: 'Old Soft-Deleted Lead A',
    phone: '9811111111',
    email: 'old_lead@test.com',
    companyId,
    workspaceId,
    userId,
    status: 'lost',
    deletedAt: ninetyFiveDaysAgo,
  });
  const leadAId = leadA.insertedId;

  // Linked cascade entities for Lead A
  await Payment.collection.insertOne({
    leadId: leadAId,
    amount: 10000,
    status: 'completed',
    companyId,
    userId,
  });
  await FeeInstallment.collection.insertOne({
    leadId: leadAId,
    installmentNumber: 1,
    amount: 5000,
    status: 'paid',
    companyId,
    workspaceId,
  });
  await AdmissionDeal.collection.insertOne({
    leadId: leadAId,
    stage: 'lead_applied',
    dealValue: 50000,
    companyId,
    workspaceId,
  });
  await Recording.collection.insertOne({
    leadId: leadAId,
    audioUrl: 'https://storage.example.com/audio1.mp3',
    companyId,
    workspaceId,
  });

  // 2. Seed Lead B: Recently Soft-Deleted Lead (10 days ago, must NOT be purged)
  const leadB = await Lead.collection.insertOne({
    name: 'Recent Soft-Deleted Lead B',
    phone: '9822222222',
    email: 'recent_deleted@test.com',
    companyId,
    workspaceId,
    userId,
    status: 'lost',
    deletedAt: tenDaysAgo,
  });
  const leadBId = leadB.insertedId;

  await Payment.collection.insertOne({
    leadId: leadBId,
    amount: 2000,
    status: 'completed',
    companyId,
    userId,
  });

  // 3. Seed Lead C: Active Lead (never deleted)
  const leadC = await Lead.collection.insertOne({
    name: 'Active Lead C',
    phone: '9833333333',
    email: 'active@test.com',
    companyId,
    workspaceId,
    userId,
    status: 'new_lead',
    deletedAt: null,
  });
  const leadCId = leadC.insertedId;

  // ── TEST 1: DRY RUN MODE PREVIEW ────────────────────────────────────────
  console.log('\n--- Test 1: Dry-Run Mode Preview ---');
  const dryRunRes = await purgeSoftDeletedLeads({ apply: false, retentionDays: 90 });
  assert.strictEqual(dryRunRes.mode, 'dry-run');
  assert.strictEqual(dryRunRes.totalCandidates, 1, 'Only Lead A (>90 days) should be candidate');
  assert.strictEqual(dryRunRes.totalCascade, 4, 'Must identify 4 cascade records for Lead A');
  assert.strictEqual(String(dryRunRes.leadIds[0]), String(leadAId));

  // Verify zero records were actually deleted in dry run
  const leadACheckDry = await Lead.collection.findOne({ _id: leadAId });
  assert.ok(leadACheckDry, 'Lead A must not be deleted in dry run');
  const paymentACheckDry = await Payment.countDocuments({ leadId: leadAId });
  assert.strictEqual(paymentACheckDry, 1, 'Payment A must not be deleted in dry run');
  console.log('  ✓ Dry run verified: Previewed 1 lead and 4 cascade entities with zero modifications.');

  // ── TEST 2: APPLY MODE TRANSACTIONAL HARD PURGE ─────────────────────────
  console.log('\n--- Test 2: Apply Mode Transactional Hard Purge ---');
  const applyRes = await purgeSoftDeletedLeads({ apply: true, retentionDays: 90 });
  assert.strictEqual(applyRes.mode, 'apply');
  assert.strictEqual(applyRes.purgedLeadsCount, 1);
  assert.strictEqual(applyRes.purgedCascadeCount, 4);

  // Verify Lead A and its cascades are gone
  const leadACheckApply = await Lead.collection.findOne({ _id: leadAId });
  assert.strictEqual(leadACheckApply, null, 'Lead A must be permanently deleted');
  const paymentACheckApply = await Payment.countDocuments({ leadId: leadAId });
  assert.strictEqual(paymentACheckApply, 0, 'Payment A must be purged');
  const dealACheckApply = await AdmissionDeal.countDocuments({ leadId: leadAId });
  assert.strictEqual(dealACheckApply, 0, 'Deal A must be purged');
  const installmentACheckApply = await FeeInstallment.countDocuments({ leadId: leadAId });
  assert.strictEqual(installmentACheckApply, 0, 'Installment A must be purged');
  const recACheckApply = await Recording.countDocuments({ leadId: leadAId });
  assert.strictEqual(recACheckApply, 0, 'Recording A must be purged');
  console.log('  ✓ Lead A and all 4 linked cascade records permanently purged.');

  // ── TEST 3: RETENTION BOUNDARIES PRESERVATION ───────────────────────────
  console.log('\n--- Test 3: Recent Soft-Deleted & Active Leads Preserved ---');
  const leadBCheck = await Lead.collection.findOne({ _id: leadBId });
  assert.ok(leadBCheck, 'Lead B (deleted 10 days ago) must be preserved');
  const paymentBCheck = await Payment.countDocuments({ leadId: leadBId });
  assert.strictEqual(paymentBCheck, 1, 'Payment B must be preserved');

  const leadCCheck = await Lead.findById(leadCId);
  assert.ok(leadCCheck, 'Lead C (active) must be preserved');
  console.log('  ✓ Retention boundaries enforced: recent soft-deleted (<90d) and active leads untouched.');

  // ── TEST 4: IDEMPOTENCY ─────────────────────────────────────────────────
  console.log('\n--- Test 4: Idempotent Repeat Purge ---');
  const repeatRes = await purgeSoftDeletedLeads({ apply: true, retentionDays: 90 });
  assert.strictEqual(repeatRes.totalCandidates, 0, 'Repeat run must find 0 candidates');
  console.log('  ✓ Idempotency verified: zero pending candidates on subsequent run.');

  await mongoose.disconnect();
  await replSet.stop();
  console.log('\n' + '='.repeat(75));
  console.log('🎉 ALL SOFT-DELETE RETENTION PURGE TESTS PASSED!');
  console.log('='.repeat(75));
  process.exit(0);
}

runPurgeTests().catch((err) => {
  console.error('❌ Soft Delete Purge Test Error:', err);
  process.exit(1);
});
