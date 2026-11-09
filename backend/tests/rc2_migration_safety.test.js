/**
 * Regression Test: Database Migration Safety, Idempotency, and Dry-Run Verification (Stage B3)
 *
 * Verifies that all repository migration and reconciliation scripts:
 * 1. Default to DRY RUN mode without mutating database records
 * 2. Successfully mutate and reconcile records when `--apply` is specified
 * 3. Are strictly IDEMPOTENT (second apply run results in zero modifications)
 * 4. Gracefully handle null, missing, and malformed fields
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { runBackfill: runWsBackfill } = require('../src/scripts/backfillLegacyLeadWorkspaceId');
const { runReconciliation: runPaymentReconcile } = require('../src/scripts/reconcilePaymentFieldPairs');
const { runTokenVersionBackfill } = require('../src/scripts/backfillTokenVersion');
const { repairLeadStageStatus } = require('../src/scripts/repairLeadStageStatus');
const { reconcileCouponUsageCounters } = require('../src/scripts/reconcileCouponUsageCounters');

async function runMigrationSafetyTests() {
  console.log('='.repeat(75));
  console.log('🧪 VERIFYING DATABASE MIGRATION SAFETY & IDEMPOTENCY (B3)');
  console.log('='.repeat(75));

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  const User = require('../src/models/User');
  const Lead = require('../src/models/Lead');
  const Workspace = require('../src/models/Workspace');
  const WorkspaceMembership = require('../src/models/WorkspaceMembership');
  const Payment = require('../src/models/Payment');
  const Coupon = require('../src/models/Coupon');
  const CouponRedemption = require('../src/models/CouponRedemption');

  const companyId = new mongoose.Types.ObjectId();
  const workspaceId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  // Create Workspace & Owner
  await Workspace.create({
    _id: workspaceId,
    name: 'Migration Test Workspace',
    ownerId: companyId,
  });

  // ── TEST 1: User tokenVersion Backfill ──────────────────────────────────
  console.log('\n--- 1. Testing User tokenVersion Backfill ---');
  await User.collection.insertOne({
    _id: userId,
    email: 'tokenuser@test.com',
    name: 'Token User',
    companyId,
    // tokenVersion explicitly omitted!
  });

  // Dry run
  const tokenDry = await runTokenVersionBackfill({ apply: false });
  assert.strictEqual(tokenDry.total, 1, 'Should find 1 user missing tokenVersion');
  const userCheckDry = await User.findById(userId).lean();
  assert.strictEqual(userCheckDry.tokenVersion, undefined, 'Dry run must not modify document');
  console.log('  ✓ Dry run verified: zero writes executed');

  // Apply
  const tokenApply = await runTokenVersionBackfill({ apply: true });
  assert.strictEqual(tokenApply.updated, 1);
  const userCheckApply = await User.findById(userId).lean();
  assert.strictEqual(userCheckApply.tokenVersion, 0, 'Apply must set tokenVersion: 0');
  console.log('  ✓ Apply verified: tokenVersion initialized to 0');

  // Idempotency: second apply must report 0
  const tokenRepeat = await runTokenVersionBackfill({ apply: true });
  assert.strictEqual(tokenRepeat.total, 0, 'Second run must be idempotent (0 pending)');
  console.log('  ✓ Idempotency verified: zero pending updates on repeat');

  // ── TEST 2: Lead Workspace ID Backfill ─────────────────────────────────
  console.log('\n--- 2. Testing Lead Workspace ID Backfill ---');
  const leadInsertRes = await Lead.collection.insertOne({
    name: 'Legacy Unscoped Lead',
    phone: '9855555555',
    email: 'unscoped@test.com',
    companyId,
    userId,
    status: 'new_lead',
    workspaceId: null, // explicitly unassigned via raw MongoDB insert
  });
  const unscopedLeadId = leadInsertRes.insertedId;

  // Dry run
  const wsDry = await runWsBackfill({ apply: false });
  assert.strictEqual(wsDry.total, 1);
  assert.strictEqual(wsDry.resolved, 1);
  const leadCheckDry = await Lead.findById(unscopedLeadId).lean();
  assert.strictEqual(leadCheckDry.workspaceId, null, 'Dry run must not mutate workspaceId');
  console.log('  ✓ Dry run verified: previewed 1 resolvable lead without mutating');

  // Apply
  const wsApply = await runWsBackfill({ apply: true });
  assert.strictEqual(wsApply.resolved, 1);
  const leadCheckApply = await Lead.findById(unscopedLeadId).lean();
  assert.strictEqual(String(leadCheckApply.workspaceId), String(workspaceId));
  console.log('  ✓ Apply verified: workspaceId correctly derived from owner');

  // Idempotency
  const wsRepeat = await runWsBackfill({ apply: true });
  assert.strictEqual(wsRepeat.total, 0, 'Second run must find 0 unscoped leads');
  console.log('  ✓ Idempotency verified: zero pending unscoped leads on repeat');

  // ── TEST 3: Payment Field Pairs Reconciliation ─────────────────────────
  console.log('\n--- 3. Testing Payment Dual Field Pairs Reconciliation ---');
  const payInsertRes = await Payment.collection.insertOne({
    lead_id: unscopedLeadId, // snake_case set
    // leadId not set!
    transaction_id: 'tx_12345',
    amount: 5000,
    status: 'completed',
    companyId,
    userId,
  });
  const paymentId = payInsertRes.insertedId;

  // Dry run
  const payDry = await runPaymentReconcile({ apply: false });
  assert.ok(payDry.drifted >= 1, 'Must detect drifted payment field pairs');
  const payCheckDry = await Payment.findById(paymentId).lean();
  assert.strictEqual(payCheckDry.leadId, undefined, 'Dry run must not synchronize fields');
  console.log('  ✓ Dry run verified: detected drift without mutating');

  // Apply
  const payApply = await runPaymentReconcile({ apply: true });
  assert.ok(payApply.drifted >= 1);
  const payCheckApply = await Payment.findById(paymentId).lean();
  assert.strictEqual(String(payCheckApply.leadId), String(unscopedLeadId));
  assert.strictEqual(payCheckApply.transactionId, 'tx_12345');
  console.log('  ✓ Apply verified: synchronized snake_case and camelCase field pairs');

  // Idempotency
  const payRepeat = await runPaymentReconcile({ apply: true });
  assert.strictEqual(payRepeat.drifted, 0, 'Second run must detect 0 drifted field pairs');
  console.log('  ✓ Idempotency verified: zero drifted pairs on repeat');

  // ── TEST 4: Lead Stage & Status Normalization ───────────────────────────
  console.log('\n--- 4. Testing Lead Stage & Status Normalization ---');
  await Lead.deleteMany({});
  const unalignedLead = await Lead.collection.insertOne({
    name: 'Unaligned Lead',
    phone: '9866666666',
    email: 'unaligned@test.com',
    companyId,
    workspaceId,
    userId,
    status: 'converted',
    pipeline_stage: 'enrolled', // legacy field name
    // pipelineStage omitted!
  });

  // Dry run
  const stageDry = await repairLeadStageStatus({ apply: false });
  assert.strictEqual(stageDry.total, 1);
  const stageCheckDry = await Lead.collection.findOne({ _id: unalignedLead.insertedId });
  assert.strictEqual(stageCheckDry.pipelineStage, undefined, 'Dry run must not set pipelineStage');
  console.log('  ✓ Dry run verified: detected unaligned stage without mutating');

  // Apply
  const stageApply = await repairLeadStageStatus({ apply: true });
  assert.strictEqual(stageApply.repaired, 1);
  const stageCheckApply = await Lead.collection.findOne({ _id: unalignedLead.insertedId });
  assert.strictEqual(stageCheckApply.pipelineStage, 'enrolled');
  assert.strictEqual(stageCheckApply.pipeline_stage, undefined, 'Legacy field must be unset');
  console.log('  ✓ Apply verified: canonical pipelineStage set and legacy field unset');

  // Idempotency
  const stageRepeat = await repairLeadStageStatus({ apply: true });
  assert.strictEqual(stageRepeat.total, 0, 'Second run must find 0 unaligned leads');
  console.log('  ✓ Idempotency verified: zero pending updates on repeat');

  // ── TEST 5: Coupon Usage Counters Reconciliation ────────────────────────
  console.log('\n--- 5. Testing Coupon Usage Counters Reconciliation ---');
  const coupon = await Coupon.create({
    code: 'RECONTEST50',
    discountType: 'percentage',
    discountValue: 50,
    maxUsage: 100,
    validUntil: new Date(Date.now() + 86400000),
    usageCount: 0, // drifted!
    currentUsageCount: 0,
    companyId,
  });

  // Create 2 redemptions
  await CouponRedemption.create([
    { couponId: coupon._id, couponCode: 'RECONTEST50', originalAmount: 1000, discountAmount: 500, finalAmount: 500, userId, status: 'REDEEMED', companyId },
    { couponId: coupon._id, couponCode: 'RECONTEST50', originalAmount: 1000, discountAmount: 500, finalAmount: 500, userId: new mongoose.Types.ObjectId(), status: 'REDEEMED', companyId },
  ]);

  // Dry run
  const couponDry = await reconcileCouponUsageCounters({ apply: false });
  assert.strictEqual(couponDry.drifted, 1);
  const couponCheckDry = await Coupon.findById(coupon._id).lean();
  assert.strictEqual(couponCheckDry.usageCount, 0, 'Dry run must not modify coupon counts');
  console.log('  ✓ Dry run verified: detected coupon count drift without mutating');

  // Apply
  const couponApply = await reconcileCouponUsageCounters({ apply: true });
  assert.strictEqual(couponApply.drifted, 1);
  const couponCheckApply = await Coupon.findById(coupon._id).lean();
  assert.strictEqual(couponCheckApply.usageCount, 2);
  assert.strictEqual(couponCheckApply.currentUsageCount, 2);
  console.log('  ✓ Apply verified: usageCount and currentUsageCount reconciled to 2');

  // Idempotency
  const couponRepeat = await reconcileCouponUsageCounters({ apply: true });
  assert.strictEqual(couponRepeat.drifted, 0, 'Second run must find 0 drifted coupons');
  console.log('  ✓ Idempotency verified: zero drifted coupons on repeat');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('\n' + '='.repeat(75));
  console.log('🎉 ALL DATABASE MIGRATION SAFETY AND IDEMPOTENCY TESTS PASSED!');
  console.log('='.repeat(75));
  process.exit(0);
}

runMigrationSafetyTests().catch((err) => {
  console.error('❌ Migration Safety Test Error:', err);
  process.exit(1);
});
