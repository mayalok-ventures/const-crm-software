const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const Plan = require('../models/Plan');
const { getPlanPrice, getPlanDetails } = require('../utils/planLimits');

/**
 * Normalizes coupon code to consistent uppercase trimmed format.
 */
function normalizeCouponCode(code) {
  if (!code || typeof code !== 'string') return '';
  return code.toUpperCase().trim();
}

/**
 * Lookup coupon by normalized code.
 */
async function findCouponByCode(code) {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;
  return await Coupon.findOne({ code: normalized });
}

/**
 * Validates a coupon against a selected Plan, User, and Billing Interval.
 * Resolves authoritative pricing from MongoDB Plan document.
 */
async function validateCoupon({ couponCode, userId = null, planId = null, billingInterval = 'monthly', amount = null }) {
  const normalizedCode = normalizeCouponCode(couponCode);
  if (!normalizedCode) {
    return { valid: false, code: 'INVALID_COUPON', message: 'Coupon code is required' };
  }

  const coupon = await findCouponByCode(normalizedCode);
  if (!coupon) {
    return { valid: false, code: 'COUPON_NOT_FOUND', message: `Coupon "${normalizedCode}" does not exist` };
  }

  if (coupon.status === 'INACTIVE' || coupon.status === 'DRAFT' || coupon.isActive === false) {
    return { valid: false, code: 'COUPON_INACTIVE', message: 'This coupon is currently inactive' };
  }

  if (coupon.status === 'ARCHIVED') {
    return { valid: false, code: 'COUPON_ARCHIVED', message: 'This coupon has been archived' };
  }

  const now = new Date();
  if (coupon.validFrom && now < new Date(coupon.validFrom)) {
    return { valid: false, code: 'COUPON_NOT_STARTED', message: 'This coupon is not active yet' };
  }

  if (coupon.validUntil && now > new Date(coupon.validUntil)) {
    return { valid: false, code: 'COUPON_EXPIRED', message: 'This coupon has expired' };
  }

  // 1. Resolve Target Plan & Authoritative Original Price
  let originalPrice = 0;
  let resolvedPlan = null;
  const cycle = billingInterval === 'yearly' ? 'yearly' : 'monthly';

  if (planId) {
    if (mongoose.Types.ObjectId.isValid(planId)) {
      resolvedPlan = await Plan.findById(planId).lean();
    }
    if (!resolvedPlan) {
      resolvedPlan = await Plan.findOne({
        $or: [
          { slug: String(planId).toLowerCase().replace(/_/g, '-') },
          { code: String(planId).toUpperCase() },
          { name: new RegExp(`^${planId}$`, 'i') },
        ],
      }).lean();
    }

    if (resolvedPlan) {
      originalPrice = cycle === 'yearly'
        ? (resolvedPlan.pricing?.yearly?.amount || (resolvedPlan.yearlyPrice || (resolvedPlan.monthlyPrice * 10)))
        : (resolvedPlan.pricing?.monthly?.amount || resolvedPlan.monthlyPrice || Math.round((resolvedPlan.priceInPaise || 0) / 100));
    } else {
      const fallbackPlan = getPlanDetails(planId);
      if (fallbackPlan && fallbackPlan.id !== 'free') {
        originalPrice = getPlanPrice(planId, cycle);
        resolvedPlan = {
          _id: null,
          slug: fallbackPlan.id,
          name: fallbackPlan.name,
          category: fallbackPlan.type === 'org' ? 'ORGANIZATION' : 'INDIVIDUAL',
        };
      }
    }
  }

  if (!originalPrice && amount !== null && amount !== undefined) {
    originalPrice = Number(amount);
  }

  if (isNaN(originalPrice) || originalPrice <= 0) {
    return { valid: false, code: 'INVALID_AMOUNT', message: 'Unable to resolve authoritative plan amount for discount calculation' };
  }

  // 2. Validate Target Applicability
  if (!coupon.appliesToAllPlans) {
    let planMatched = false;

    // Check specific plans match
    if (Array.isArray(coupon.applicablePlans) && coupon.applicablePlans.length > 0 && !coupon.applicablePlans.includes('ALL')) {
      const planIdentifiers = [
        resolvedPlan?._id?.toString(),
        resolvedPlan?.slug,
        resolvedPlan?.code,
        resolvedPlan?.name,
      ].filter(Boolean);

      planMatched = coupon.applicablePlans.some(p => {
        const pStr = p?.toString ? p.toString() : String(p);
        return planIdentifiers.includes(pStr);
      });
    }

    // Check category match if not matched by specific plan
    if (!planMatched && Array.isArray(coupon.applicableCategories) && coupon.applicableCategories.length > 0) {
      const planCategory = resolvedPlan?.category || (resolvedPlan?.accountType) || (resolvedPlan?.type === 'org' ? 'ORGANIZATION' : 'INDIVIDUAL');
      if (coupon.applicableCategories.includes(planCategory)) {
        planMatched = true;
      }
    }

    if (!planMatched) {
      return {
        valid: false,
        code: 'COUPON_NOT_APPLICABLE',
        message: `Coupon "${coupon.code}" is not applicable to the selected plan (${resolvedPlan?.name || 'this plan'})`,
      };
    }
  }

  // 3. Validate Minimum Order Value
  if (coupon.minOrderValue && originalPrice < coupon.minOrderValue) {
    return {
      valid: false,
      code: 'MIN_ORDER_VALUE_NOT_MET',
      message: `Minimum order amount of ₹${coupon.minOrderValue.toLocaleString('en-IN')} required to apply this coupon`,
    };
  }

  // 4. Validate Overall Usage Limit
  const currentUsage = Math.max(coupon.usageCount || 0, coupon.currentUsageCount || 0);
  if (coupon.maxOverallUses && coupon.maxOverallUses !== -1 && currentUsage >= coupon.maxOverallUses) {
    return {
      valid: false,
      code: 'COUPON_USAGE_LIMIT_REACHED',
      message: 'This coupon has reached its maximum allowed redemptions',
    };
  }

  // 5. Validate Per-User Redemption Limit
  if (userId) {
    const userRedemptionCount = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      userId,
      status: 'REDEEMED',
    });

    const maxPerUser = coupon.maxUsesPerUser || 1;
    if (userRedemptionCount >= maxPerUser) {
      return {
        valid: false,
        code: 'COUPON_USER_LIMIT_REACHED',
        message: `You have already used this coupon the maximum allowed times (${maxPerUser})`,
      };
    }
  }

  // 6. Precise Discount Calculation (using integer paise arithmetic)
  const originalPricePaise = Math.round(originalPrice * 100);
  let discountPaise = 0;

  if (coupon.discountType === 'PERCENTAGE') {
    discountPaise = Math.round((originalPricePaise * coupon.discountValue) / 100);
    // Apply Maximum Discount Cap if present
    if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
      const maxCapPaise = Math.round(coupon.maxDiscountAmount * 100);
      discountPaise = Math.min(discountPaise, maxCapPaise);
    }
  } else {
    // FLAT DISCOUNT
    discountPaise = Math.round(coupon.discountValue * 100);
  }

  // Ensure discount never exceeds original amount
  discountPaise = Math.min(discountPaise, originalPricePaise);
  const finalPricePaise = Math.max(0, originalPricePaise - discountPaise);

  const originalAmount = originalPrice;
  const discountAmount = discountPaise / 100;
  const finalAmount = finalPricePaise / 100;

  return {
    valid: true,
    coupon: {
      _id: coupon._id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
      minOrderValue: coupon.minOrderValue,
      currency: coupon.currency || 'INR',
    },
    plan: resolvedPlan,
    originalAmount,
    discountAmount,
    finalAmount,
    originalAmountPaise: originalPricePaise,
    discountAmountPaise: discountPaise,
    finalAmountPaise: finalPricePaise,
    discountPercent: coupon.discountType === 'PERCENTAGE' ? coupon.discountValue : Math.round((discountAmount / originalPrice) * 100),
    message: `${coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`} discount applied successfully!`,
  };
}

/**
 * Idempotently and atomically records a verified coupon redemption.
 * Guarantees that concurrent requests cannot exceed maxOverallUses.
 */
async function recordRedemption({
  couponId,
  userId,
  tenantId = null,
  subscriptionId = null,
  paymentId = null,
  razorpayOrderId = null,
  razorpayPaymentId = null,
  planId = null,
  planVersion = 1,
  planName = '',
  billingInterval = 'monthly',
  originalAmount,
  discountAmount,
  finalAmount,
  couponCode,
}) {
  if (!couponId || !userId) {
    throw new Error('couponId and userId are required to record redemption');
  }

  // 1. Idempotency Check
  let existingRedemption = null;
  if (razorpayOrderId) {
    existingRedemption = await CouponRedemption.findOne({ razorpayOrderId, couponId });
  } else if (paymentId) {
    existingRedemption = await CouponRedemption.findOne({ paymentId, couponId });
  }

  if (existingRedemption) {
    if (existingRedemption.status === 'REDEEMED') {
      return existingRedemption;
    }
  }

  // 2. Load Coupon to check limits
  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    throw new Error(`Coupon ${couponId} not found for redemption`);
  }

  // 3. Atomic Conditional Increment on Coupon
  let updatedCoupon = null;
  if (coupon.maxOverallUses && coupon.maxOverallUses !== -1) {
    updatedCoupon = await Coupon.findOneAndUpdate(
      {
        _id: couponId,
        $or: [
          { usageCount: { $lt: coupon.maxOverallUses } },
          { currentUsageCount: { $lt: coupon.maxOverallUses } },
        ],
      },
      {
        $inc: { usageCount: 1, currentUsageCount: 1 },
        $push: {
          usedBy: {
            userId,
            usedAt: new Date(),
            planName: planName || '',
            discountApplied: discountAmount,
          },
        },
      },
      { new: true }
    );

    if (!updatedCoupon) {
      const err = new Error('Coupon usage limit reached during concurrent redemption');
      err.statusCode = 409;
      err.code = 'COUPON_USAGE_LIMIT_REACHED';
      throw err;
    }
  } else {
    // Unlimited usage
    updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        $inc: { usageCount: 1, currentUsageCount: 1 },
        $push: {
          usedBy: {
            userId,
            usedAt: new Date(),
            planName: planName || '',
            discountApplied: discountAmount,
          },
        },
      },
      { new: true }
    );
  }

  // 4. Create or Update CouponRedemption Record
  const redemptionData = {
    couponId,
    couponCode: couponCode || coupon.code,
    userId,
    tenantId: tenantId || userId,
    subscriptionId,
    paymentId,
    razorpayOrderId,
    razorpayPaymentId,
    planId,
    planVersion: planVersion || 1,
    planName,
    billingInterval,
    originalAmount,
    discountAmount,
    finalAmount,
    status: 'REDEEMED',
    redeemedAt: new Date(),
  };

  let redemption;
  if (existingRedemption) {
    Object.assign(existingRedemption, redemptionData);
    redemption = await existingRedemption.save();
  } else {
    try {
      redemption = await CouponRedemption.create(redemptionData);
    } catch (createErr) {
      if (createErr.code === 11000) {
        // Unique constraint caught concurrent duplicate
        redemption = await CouponRedemption.findOne({
          $or: [
            { razorpayOrderId, couponId },
            { paymentId, couponId },
          ],
        });
      } else {
        throw createErr;
      }
    }
  }

  return redemption;
}

/**
 * Reverses a coupon redemption upon refund or transaction cancellation.
 */
async function reverseRedemption({ paymentId = null, razorpayOrderId = null, reason = 'REFUND' }) {
  const query = {};
  if (paymentId) query.paymentId = paymentId;
  if (razorpayOrderId) query.razorpayOrderId = razorpayOrderId;

  if (Object.keys(query).length === 0) return null;

  const redemption = await CouponRedemption.findOne(query);
  if (!redemption || redemption.status === 'REVERSED') return redemption;

  redemption.status = 'REVERSED';
  redemption.metadata = { ...(redemption.metadata || {}), reversedAt: new Date(), reason };
  await redemption.save();

  // Atomically decrement usageCount
  await Coupon.findByIdAndUpdate(redemption.couponId, {
    $inc: { usageCount: -1, currentUsageCount: -1 },
  });

  return redemption;
}

/**
 * Aggregates live redemption metrics for a coupon.
 */
async function getCouponAnalytics(couponId) {
  const redemptions = await CouponRedemption.find({
    couponId,
    status: 'REDEEMED',
  }).lean();

  const totalRedemptions = redemptions.length;
  const grossRevenue = redemptions.reduce((acc, r) => acc + (r.originalAmount || 0), 0);
  const totalDiscount = redemptions.reduce((acc, r) => acc + (r.discountAmount || 0), 0);
  const netRevenue = redemptions.reduce((acc, r) => acc + (r.finalAmount || 0), 0);

  return {
    totalRedemptions,
    grossRevenue,
    totalDiscount,
    netRevenue,
  };
}

module.exports = {
  normalizeCouponCode,
  findCouponByCode,
  validateCoupon,
  recordRedemption,
  reverseRedemption,
  getCouponAnalytics,
};
