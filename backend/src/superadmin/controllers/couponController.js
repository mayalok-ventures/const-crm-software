const mongoose = require('mongoose');
const Coupon = require('../../models/Coupon');
const CouponRedemption = require('../../models/CouponRedemption');
const Plan = require('../../models/Plan');
const { normalizeCouponCode, getCouponAnalytics } = require('../../services/couponService');

/**
 * List all coupons with aggregated performance analytics.
 * @route GET /api/super-admin/coupons
 * @access SuperAdmin Only
 */
exports.listCoupons = async (req, res) => {
  try {
    const { status, category, search } = req.query;

    const query = {};
    if (status) {
      query.status = status.toUpperCase();
    }
    if (category) {
      query.applicableCategories = category.toUpperCase();
    }
    if (search) {
      query.code = new RegExp(search.trim(), 'i');
    }

    const coupons = await Coupon.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Aggregation of redemptions for each coupon
    const couponIds = coupons.map(c => c._id);
    const redemptionStats = await CouponRedemption.aggregate([
      { $match: { couponId: { $in: couponIds }, status: 'REDEEMED' } },
      {
        $group: {
          _id: '$couponId',
          totalRedemptions: { $sum: 1 },
          grossRevenue: { $sum: '$originalAmount' },
          totalDiscount: { $sum: '$discountAmount' },
          netRevenue: { $sum: '$finalAmount' },
        },
      },
    ]);

    const statsMap = new Map();
    redemptionStats.forEach(stat => {
      statsMap.set(stat._id.toString(), stat);
    });

    const enrichedCoupons = coupons.map(coupon => {
      const stats = statsMap.get(coupon._id.toString()) || {
        totalRedemptions: 0,
        grossRevenue: 0,
        totalDiscount: 0,
        netRevenue: 0,
      };

      const effectiveUsage = Math.max(coupon.usageCount || 0, coupon.currentUsageCount || 0, stats.totalRedemptions);

      return {
        ...coupon,
        usageCount: effectiveUsage,
        stats: {
          totalRedemptions: stats.totalRedemptions,
          grossRevenue: stats.grossRevenue,
          totalDiscount: stats.totalDiscount,
          netRevenue: stats.netRevenue,
        },
      };
    });

    res.json({
      success: true,
      coupons: enrichedCoupons,
      total: enrichedCoupons.length,
    });
  } catch (error) {
    console.error('[SuperAdmin Coupon] listCoupons error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch coupons' });
  }
};

/**
 * Get single coupon details with analytics.
 * @route GET /api/super-admin/coupons/:id
 * @access SuperAdmin Only
 */
exports.getCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid coupon ID' });
    }

    const coupon = await Coupon.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const analytics = await getCouponAnalytics(coupon._id);

    res.json({
      success: true,
      coupon: {
        ...coupon,
        analytics,
      },
    });
  } catch (error) {
    console.error('[SuperAdmin Coupon] getCoupon error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch coupon' });
  }
};

/**
 * Create a new coupon.
 * @route POST /api/super-admin/coupons
 * @access SuperAdmin Only
 */
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType = 'PERCENTAGE',
      discountValue,
      currency = 'INR',
      appliesToAllPlans = true,
      applicableCategories = [],
      applicablePlans = [],
      minOrderValue = 0,
      maxDiscountAmount = null,
      validFrom,
      validUntil,
      maxOverallUses = null,
      maxUsesPerUser = 1,
      status = 'ACTIVE',
    } = req.body;

    const normalizedCode = normalizeCouponCode(code);
    if (!normalizedCode) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const existing = await Coupon.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(400).json({ success: false, message: `Coupon with code "${normalizedCode}" already exists` });
    }

    const numDiscount = Number(discountValue);
    if (isNaN(numDiscount) || numDiscount <= 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be greater than 0' });
    }

    if (discountType === 'PERCENTAGE' && numDiscount > 100) {
      return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%' });
    }

    if (!validUntil) {
      return res.status(400).json({ success: false, message: 'Expiration date (validUntil) is required' });
    }

    const startDate = validFrom ? new Date(validFrom) : new Date();
    const expiryDate = new Date(validUntil);

    if (expiryDate <= startDate) {
      return res.status(400).json({ success: false, message: 'Expiration date must be later than start date' });
    }

    const newCoupon = await Coupon.create({
      code: normalizedCode,
      description: description ? String(description).trim() : '',
      discountType: discountType === 'FLAT' ? 'FLAT' : 'PERCENTAGE',
      discountValue: numDiscount,
      currency: currency || 'INR',
      appliesToAllPlans: Boolean(appliesToAllPlans),
      applicableCategories: Array.isArray(applicableCategories) ? applicableCategories : [],
      applicablePlans: Array.isArray(applicablePlans) ? applicablePlans : ['ALL'],
      minOrderValue: Number(minOrderValue) >= 0 ? Number(minOrderValue) : 0,
      maxDiscountAmount: maxDiscountAmount && Number(maxDiscountAmount) > 0 ? Number(maxDiscountAmount) : null,
      validFrom: startDate,
      validUntil: expiryDate,
      maxOverallUses: maxOverallUses !== null && maxOverallUses !== undefined && !isNaN(Number(maxOverallUses)) ? Number(maxOverallUses) : null,
      maxUsesPerUser: Number(maxUsesPerUser) > 0 ? Number(maxUsesPerUser) : 1,
      status: ['DRAFT', 'ACTIVE', 'INACTIVE'].includes(status) ? status : 'ACTIVE',
      isActive: status === 'ACTIVE',
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    res.status(201).json({
      success: true,
      message: `Coupon "${normalizedCode}" created successfully!`,
      coupon: newCoupon,
    });
  } catch (error) {
    console.error('[SuperAdmin Coupon] createCoupon error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create coupon' });
  }
};

/**
 * Update an existing coupon.
 * @route PUT /api/super-admin/coupons/:id, PATCH /api/super-admin/coupons/:id
 * @access SuperAdmin Only
 */
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid coupon ID' });
    }

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const {
      code,
      description,
      discountType,
      discountValue,
      currency,
      appliesToAllPlans,
      applicableCategories,
      applicablePlans,
      minOrderValue,
      maxDiscountAmount,
      validFrom,
      validUntil,
      maxOverallUses,
      maxUsesPerUser,
      status,
    } = req.body;

    if (code) {
      const normalizedCode = normalizeCouponCode(code);
      if (normalizedCode !== coupon.code) {
        const existing = await Coupon.findOne({ code: normalizedCode, _id: { $ne: coupon._id } });
        if (existing) {
          return res.status(400).json({ success: false, message: `Coupon with code "${normalizedCode}" already exists` });
        }
        coupon.code = normalizedCode;
      }
    }

    if (description !== undefined) coupon.description = String(description).trim();
    if (discountType) coupon.discountType = discountType === 'FLAT' ? 'FLAT' : 'PERCENTAGE';
    if (discountValue !== undefined) {
      const numDiscount = Number(discountValue);
      if (isNaN(numDiscount) || numDiscount <= 0) {
        return res.status(400).json({ success: false, message: 'Discount value must be greater than 0' });
      }
      if (coupon.discountType === 'PERCENTAGE' && numDiscount > 100) {
        return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%' });
      }
      coupon.discountValue = numDiscount;
    }

    if (currency) coupon.currency = currency;
    if (appliesToAllPlans !== undefined) coupon.appliesToAllPlans = Boolean(appliesToAllPlans);
    if (applicableCategories !== undefined) coupon.applicableCategories = applicableCategories;
    if (applicablePlans !== undefined) coupon.applicablePlans = applicablePlans;
    if (minOrderValue !== undefined) coupon.minOrderValue = Number(minOrderValue);
    if (maxDiscountAmount !== undefined) {
      coupon.maxDiscountAmount = maxDiscountAmount && Number(maxDiscountAmount) > 0 ? Number(maxDiscountAmount) : null;
    }

    if (validFrom) coupon.validFrom = new Date(validFrom);
    if (validUntil) coupon.validUntil = new Date(validUntil);
    if (coupon.validUntil <= coupon.validFrom) {
      return res.status(400).json({ success: false, message: 'Expiration date must be later than start date' });
    }

    if (maxOverallUses !== undefined) {
      coupon.maxOverallUses = maxOverallUses !== null && !isNaN(Number(maxOverallUses)) ? Number(maxOverallUses) : null;
    }
    if (maxUsesPerUser !== undefined) {
      coupon.maxUsesPerUser = Number(maxUsesPerUser) > 0 ? Number(maxUsesPerUser) : 1;
    }

    if (status) {
      coupon.status = status;
      coupon.isActive = status === 'ACTIVE';
    }

    coupon.updatedBy = req.user?._id || null;
    await coupon.save();

    res.json({
      success: true,
      message: `Coupon "${coupon.code}" updated successfully!`,
      coupon,
    });
  } catch (error) {
    console.error('[SuperAdmin Coupon] updateCoupon error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update coupon' });
  }
};

/**
 * 1-Click Activate Coupon.
 * @route POST /api/super-admin/coupons/:id/activate
 * @access SuperAdmin Only
 */
exports.activateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndUpdate(
      id,
      { $set: { status: 'ACTIVE', isActive: true, updatedBy: req.user?._id } },
      { new: true }
    );
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    res.json({ success: true, message: `Coupon "${coupon.code}" is now ACTIVE!`, coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 1-Click Deactivate Coupon.
 * @route POST /api/super-admin/coupons/:id/deactivate
 * @access SuperAdmin Only
 */
exports.deactivateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndUpdate(
      id,
      { $set: { status: 'INACTIVE', isActive: false, updatedBy: req.user?._id } },
      { new: true }
    );
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    res.json({ success: true, message: `Coupon "${coupon.code}" has been DEACTIVATED!`, coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Soft-Archive Coupon.
 * @route DELETE /api/super-admin/coupons/:id, POST /api/super-admin/coupons/:id/archive
 * @access SuperAdmin Only
 */
exports.archiveCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndUpdate(
      id,
      { $set: { status: 'ARCHIVED', isActive: false, updatedBy: req.user?._id } },
      { new: true }
    );
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    res.json({ success: true, message: `Coupon "${coupon.code}" has been ARCHIVED!`, coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get paginated customer redemptions for a coupon ("View Customers").
 * @route GET /api/super-admin/coupons/:id/redemptions
 * @access SuperAdmin Only
 */
exports.getRedemptions = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid coupon ID' });
    }

    const coupon = await Coupon.findById(id).lean();
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const [redemptions, totalCount, analytics] = await Promise.all([
      CouponRedemption.find({ couponId: id })
        .populate('userId', 'name email phone companyInfo workStatus')
        .populate('planId', 'name category tier')
        .sort({ redeemedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CouponRedemption.countDocuments({ couponId: id }),
      getCouponAnalytics(id),
    ]);

    const formattedRedemptions = redemptions.map(r => ({
      _id: r._id,
      customerName: r.userId?.name || 'Customer',
      customerEmail: r.userId?.email || 'N/A',
      customerPhone: r.userId?.phone || 'N/A',
      companyName: r.userId?.companyInfo?.name || '',
      planName: r.planName || r.planId?.name || 'SaaS Plan',
      billingInterval: r.billingInterval || 'monthly',
      planVersion: r.planVersion || 1,
      originalAmount: r.originalAmount || 0,
      discountAmount: r.discountAmount || 0,
      finalAmount: r.finalAmount || 0,
      redeemedAt: r.redeemedAt,
      status: r.status,
      razorpayOrderId: r.razorpayOrderId,
      razorpayPaymentId: r.razorpayPaymentId,
    }));

    res.json({
      success: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      redemptions: formattedRedemptions,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit) || 1,
      analytics,
    });
  } catch (error) {
    console.error('[SuperAdmin Coupon] getRedemptions error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch redemptions' });
  }
};
