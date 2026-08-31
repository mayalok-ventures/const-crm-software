const { validateCoupon } = require('../services/couponService');

/**
 * Validates a coupon for customer preview on checkout / pricing page.
 * @route POST /api/coupons/validate
 * @access Public / Authenticated
 */
exports.validateCouponForCheckout = async (req, res) => {
  try {
    const { code, couponCode, planId, cycle, billingInterval, amount } = req.body;
    const targetCode = couponCode || code;

    if (!targetCode) {
      return res.status(400).json({
        success: false,
        valid: false,
        code: 'INVALID_COUPON',
        message: 'Coupon code is required',
      });
    }

    const userId = req.user?._id || null;
    const interval = billingInterval || cycle || 'monthly';

    const result = await validateCoupon({
      couponCode: targetCode,
      userId,
      planId,
      billingInterval: interval,
      amount,
    });

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        code: result.code || 'COUPON_INVALID',
        message: result.message || 'Invalid or expired coupon',
      });
    }

    res.json({
      success: true,
      valid: true,
      couponCode: result.coupon.code,
      discountType: result.coupon.discountType,
      discountValue: result.coupon.discountValue,
      maxDiscountAmount: result.coupon.maxDiscountAmount,
      minOrderValue: result.coupon.minOrderValue,
      originalAmount: result.originalAmount,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
      discountPercent: result.discountPercent,
      message: result.message,
    });
  } catch (error) {
    console.error('[Coupon Validation] Error:', error);
    res.status(500).json({
      success: false,
      valid: false,
      code: 'SERVER_ERROR',
      message: 'Failed to validate coupon code',
    });
  }
};
