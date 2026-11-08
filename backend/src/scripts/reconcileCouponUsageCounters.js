const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');

/**
 * Reconcile Coupon Usage Counters
 * Dry-run by default. Pass --apply to persist changes.
 */
async function reconcileCouponUsageCounters(options = {}) {
  const isApply = options.apply || process.argv.includes('--apply');
  console.log(`[Coupon Reconcile] Starting in ${isApply ? 'APPLY' : 'DRY-RUN'} mode...`);

  const coupons = await Coupon.find({});
  let driftedCount = 0;

  for (const coupon of coupons) {
    const arrayCount = Array.isArray(coupon.usedBy) ? coupon.usedBy.length : 0;
    const redemptionDocCount = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      status: 'REDEEMED',
    });

    const canonicalCount = Math.max(
      coupon.usageCount || 0,
      coupon.currentUsageCount || 0,
      arrayCount,
      redemptionDocCount
    );

    const hasDrift =
      coupon.usageCount !== canonicalCount ||
      coupon.currentUsageCount !== canonicalCount;

    if (hasDrift) {
      driftedCount++;
      console.log(
        `[Drift Detected] Coupon ${coupon.code} (${coupon._id}): usageCount=${coupon.usageCount}, currentUsageCount=${coupon.currentUsageCount}, arrayCount=${arrayCount}, redemptionDocCount=${redemptionDocCount} -> Target: ${canonicalCount}`
      );

      if (isApply) {
        await Coupon.updateOne(
          { _id: coupon._id },
          {
            $set: {
              usageCount: canonicalCount,
              currentUsageCount: canonicalCount,
            },
          }
        );
        console.log(`[Applied] Fixed Coupon ${coupon.code}`);
      }
    }
  }

  console.log(
    `[Coupon Reconcile] Completed. Evaluated: ${coupons.length} coupons. Drifted: ${driftedCount}. Applied: ${isApply ? 'YES' : 'NO (Dry Run)'}.`
  );

  return { total: coupons.length, drifted: driftedCount, applied: isApply };
}

if (require.main === module) {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mobile-crm';
  mongoose
    .connect(mongoUri)
    .then(async () => {
      await reconcileCouponUsageCounters();
      await mongoose.disconnect();
    })
    .catch((err) => {
      console.error('[Coupon Reconcile Error]:', err);
      process.exit(1);
    });
}

module.exports = { reconcileCouponUsageCounters };
