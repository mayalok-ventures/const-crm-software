const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Coupon Atomic Redemption & Counter Drift Fix (B3)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Coupon = require('../src/models/Coupon');
  const User = require('../src/models/User');
  const { recordRedemption } = require('../src/services/couponService');
  const { reconcileCouponUsageCounters } = require('../src/scripts/reconcileCouponUsageCounters');

  const user1 = await User.create({
    name: 'User 1',
    email: 'user1@crm.local',
    password: 'Password123!',
    phone: '9870000001',
  });
  const user2 = await User.create({
    name: 'User 2',
    email: 'user2@crm.local',
    password: 'Password123!',
    phone: '9870000002',
  });
  const user3 = await User.create({
    name: 'User 3',
    email: 'user3@crm.local',
    password: 'Password123!',
    phone: '9870000003',
  });

  // 1. Create a coupon with maxOverallUses: 2
  const coupon = await Coupon.create({
    code: 'SAVE50',
    discountType: 'PERCENTAGE',
    discountValue: 50,
    maxOverallUses: 2,
    maxUsesPerUser: 1,
    status: 'ACTIVE',
    isActive: true,
    validUntil: new Date(Date.now() + 86400000),
  });

  // First redemption
  const payId1 = new mongoose.Types.ObjectId().toString();
  const red1 = await recordRedemption({
    couponId: coupon._id,
    userId: user1._id,
    planName: 'pro',
    originalAmount: 1000,
    discountAmount: 500,
    finalAmount: 500,
    paymentId: payId1,
  });
  assert.ok(red1);
  let cDoc = await Coupon.findById(coupon._id);
  assert.strictEqual(cDoc.usageCount, 1);
  assert.strictEqual(cDoc.currentUsageCount, 1);
  console.log('✅ Step 1: First redemption incremented both counters to 1.');

  // Idempotency: re-calling recordRedemption with same paymentId returns existing record without increment
  const red1Dup = await recordRedemption({
    couponId: coupon._id,
    userId: user1._id,
    planName: 'pro',
    originalAmount: 1000,
    discountAmount: 500,
    finalAmount: 500,
    paymentId: payId1,
  });
  assert.strictEqual(red1Dup._id.toString(), red1._id.toString());
  cDoc = await Coupon.findById(coupon._id);
  assert.strictEqual(cDoc.usageCount, 1, 'Idempotent redemption must not double-increment counters');
  console.log('✅ Step 2: Idempotent re-call safely skipped double increment.');

  // Second redemption
  const payId2 = new mongoose.Types.ObjectId().toString();
  const red2 = await recordRedemption({
    couponId: coupon._id,
    userId: user2._id,
    planName: 'pro',
    originalAmount: 1000,
    discountAmount: 500,
    finalAmount: 500,
    paymentId: payId2,
  });
  assert.ok(red2);
  cDoc = await Coupon.findById(coupon._id);
  assert.strictEqual(cDoc.usageCount, 2);
  assert.strictEqual(cDoc.currentUsageCount, 2);
  console.log('✅ Step 3: Second redemption reached limit (2/2).');

  // Third redemption must be rejected (409)
  let rejected = false;
  try {
    await recordRedemption({
      couponId: coupon._id,
      userId: user3._id,
      planName: 'pro',
      originalAmount: 1000,
      discountAmount: 500,
      finalAmount: 500,
      paymentId: new mongoose.Types.ObjectId().toString(),
    });
  } catch (err) {
    rejected = true;
    assert.strictEqual(err.statusCode, 409);
    assert.strictEqual(err.code, 'COUPON_USAGE_LIMIT_REACHED');
  }
  assert.ok(rejected, 'Third redemption must throw 409');
  console.log('✅ Step 4: Third redemption correctly rejected at usage limit.');

  // Step 5: Test counter drift protection
  // Create a coupon where usageCount is at limit (2), but currentUsageCount lagged at 1
  const driftedCoupon = await Coupon.create({
    code: 'DRIFT2',
    discountType: 'FLAT',
    discountValue: 100,
    maxOverallUses: 2,
    usageCount: 2,
    currentUsageCount: 1, // artificially drifted
    status: 'ACTIVE',
    isActive: true,
    validUntil: new Date(Date.now() + 86400000),
  });

  let driftRejected = false;
  try {
    await recordRedemption({
      couponId: driftedCoupon._id,
      userId: user1._id,
      planName: 'starter',
      originalAmount: 1000,
      discountAmount: 100,
      finalAmount: 900,
      paymentId: new mongoose.Types.ObjectId().toString(),
    });
  } catch (err) {
    driftRejected = true;
    assert.strictEqual(err.code, 'COUPON_USAGE_LIMIT_REACHED');
  }
  assert.ok(driftRejected, 'Drifted counter must not allow extra redemption');
  console.log('✅ Step 5: Drifted counter prevented from bypassing limit.');

  // Step 6: Test reconciliation script
  const dryResult = await reconcileCouponUsageCounters({ apply: false });
  assert.ok(dryResult.drifted >= 1, 'Dry-run must detect at least 1 drifted coupon');

  const applyResult = await reconcileCouponUsageCounters({ apply: true });
  assert.ok(applyResult.applied, 'Apply mode must execute update');

  const reconciledDoc = await Coupon.findById(driftedCoupon._id);
  assert.strictEqual(reconciledDoc.usageCount, 2);
  assert.strictEqual(reconciledDoc.currentUsageCount, 2);
  console.log('✅ Step 6: Reconciliation script successfully reconciled drifted counters.');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL B3 COUPON ATOMIC REDEMPTION TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
