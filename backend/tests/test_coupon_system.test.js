const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/User');
const Plan = require('../src/models/Plan');
const Coupon = require('../src/models/Coupon');
const CouponRedemption = require('../src/models/CouponRedemption');
const { seedPlans } = require('../src/utils/seedPlans');

const {
  normalizeCouponCode,
  findCouponByCode,
  validateCoupon,
  recordRedemption,
  reverseRedemption,
  getCouponAnalytics,
} = require('../src/services/couponService');

const couponController = require('../src/superadmin/controllers/couponController');

let mongoServer;

async function runCouponTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING: PRODUCTION COUPON & REDEMPTION SYSTEM TEST SUITE');
  console.log('================================================================\n');

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // ── 1. SEED PLANS & INITIALIZE ACTORS ────────────────────────────────────
    console.log('--- 1. Database Setup & Plan Catalog Seeding ---');
    await seedPlans();

    const soloPlan = await Plan.findOne({ code: 'IND_STARTER_MONTHLY_V1' }).lean();
    const smartSoloPlan = await Plan.findOne({ code: 'IND_PRO_MONTHLY_V1' }).lean();
    const orgPlan = await Plan.findOne({ code: 'ORG_PRO_MONTHLY_V1' }).lean();

    assert(soloPlan !== null && orgPlan !== null, 'Seeded plans loaded from MongoDB');

    const superAdminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@coresetu.com',
      password: 'password123',
      role: 'superadmin',
      isAdmin: true,
    });

    const regularAgent = await User.create({
      name: 'Agent User',
      email: 'agent@coresetu.com',
      password: 'password123',
      role: 'agent',
    });

    const customerA = await User.create({
      name: 'Customer Alice',
      email: 'alice@agency.com',
      password: 'password123',
      workStatus: 'independent_agent',
    });

    const customerB = await User.create({
      name: 'Customer Bob',
      email: 'bob@agency.com',
      password: 'password123',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });

    // ── 2. CODE NORMALIZATION & CREATION ────────────────────────────────────
    console.log('\n--- 2. Coupon Code Normalization & Creation ---');
    assert(normalizeCouponCode('festive30') === 'FESTIVE30', 'normalizeCouponCode converts lowercase to uppercase');
    assert(normalizeCouponCode('  Save_20  ') === 'SAVE_20', 'normalizeCouponCode trims surrounding whitespace');

    const coupon1 = await Coupon.create({
      code: 'festive30',
      description: 'Festive 30% discount',
      discountType: 'PERCENTAGE',
      discountValue: 30,
      validFrom: new Date(Date.now() - 10000),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      appliesToAllPlans: true,
      maxOverallUses: 100,
      maxUsesPerUser: 1,
      status: 'ACTIVE',
      createdBy: superAdminUser._id,
    });

    assert(coupon1.code === 'FESTIVE30', 'Coupon schema pre-validate hook auto-uppercased code to FESTIVE30');
    assert(coupon1.status === 'ACTIVE' && coupon1.isActive === true, 'Coupon initialized as ACTIVE');

    // Duplicate code rejection
    let duplicateRejected = false;
    try {
      await Coupon.create({
        code: 'FESTIVE30',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    } catch (err) {
      duplicateRejected = true;
    }
    assert(duplicateRejected === true, 'Duplicate coupon code insertion safely rejected by database unique index');

    // ── 3. DISCOUNT CALCULATION & MAX CAP ───────────────────────────────────
    console.log('\n--- 3. Discount Calculations & Max Cap ---');
    // Test 30% on ₹399 plan
    const val30 = await validateCoupon({
      couponCode: 'FESTIVE30',
      userId: customerA._id,
      planId: soloPlan._id,
      billingInterval: 'monthly',
    });

    assert(val30.valid === true, 'FESTIVE30 validated successfully on Basic Solo');
    assert(val30.originalAmount === 399, 'Original amount resolved as ₹399');
    assert(val30.discountAmount === 119.7, `Discount calculated accurately as ₹119.70 (got: ${val30.discountAmount})`);
    assert(val30.finalAmount === 279.3, `Final amount calculated accurately as ₹279.30 (got: ${val30.finalAmount})`);
    assert(val30.finalAmountPaise === 27930, 'Paise precision preserved at 27,930 paise');

    // Test Percentage Coupon with Max Discount Cap (e.g. 50% max ₹500)
    const cappedCoupon = await Coupon.create({
      code: 'HALFOFF',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      maxDiscountAmount: 500, // Max discount ₹500
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      appliesToAllPlans: true,
      status: 'ACTIVE',
    });

    const valCapped = await validateCoupon({
      couponCode: 'HALFOFF',
      userId: customerB._id,
      planId: orgPlan._id, // ₹2,499 -> 50% = ₹1,249.50, but capped at ₹500
      billingInterval: 'monthly',
    });

    assert(valCapped.valid === true, 'HALFOFF validated successfully');
    assert(valCapped.originalAmount === 2499, 'Original amount is ₹2,499');
    assert(valCapped.discountAmount === 500, `Discount capped strictly at maxDiscountAmount ₹500 (got: ${valCapped.discountAmount})`);
    assert(valCapped.finalAmount === 1999, 'Final payable amount is ₹1,999');

    // Test Flat Discount
    const flatCoupon = await Coupon.create({
      code: 'FLAT200',
      discountType: 'FLAT',
      discountValue: 200,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      appliesToAllPlans: true,
      status: 'ACTIVE',
    });

    const valFlat = await validateCoupon({
      couponCode: 'FLAT200',
      userId: customerA._id,
      planId: soloPlan._id, // ₹399 - ₹200 = ₹199
      billingInterval: 'monthly',
    });

    assert(valFlat.valid === true, 'FLAT200 validated successfully');
    assert(valFlat.discountAmount === 200, 'Flat discount is ₹200');
    assert(valFlat.finalAmount === 199, 'Final amount is ₹199');

    // Test Flat Discount exceeding plan amount (should not result in negative price)
    const bigFlat = await Coupon.create({
      code: 'BIGFLAT1000',
      discountType: 'FLAT',
      discountValue: 1000,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      appliesToAllPlans: true,
      status: 'ACTIVE',
    });

    const valBigFlat = await validateCoupon({
      couponCode: 'BIGFLAT1000',
      userId: customerA._id,
      planId: soloPlan._id, // ₹399 plan with ₹1000 off
      billingInterval: 'monthly',
    });

    assert(valBigFlat.discountAmount === 399, 'Discount capped at original amount (₹399)');
    assert(valBigFlat.finalAmount === 0, 'Final amount strictly non-negative (₹0)');

    // ── 4. MINIMUM ORDER VALUE ENFORCEMENT ──────────────────────────────────
    console.log('\n--- 4. Minimum Order Value Enforcement ---');
    const minOrderCoupon = await Coupon.create({
      code: 'MIN1000',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      minOrderValue: 1000, // Requires min ₹1,000 order
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      appliesToAllPlans: true,
      status: 'ACTIVE',
    });

    const valUnderMin = await validateCoupon({
      couponCode: 'MIN1000',
      userId: customerA._id,
      planId: soloPlan._id, // ₹399 < ₹1,000
      billingInterval: 'monthly',
    });
    assert(valUnderMin.valid === false, 'Coupon rejected when plan price < minOrderValue');
    assert(valUnderMin.code === 'MIN_ORDER_VALUE_NOT_MET', 'Error code is MIN_ORDER_VALUE_NOT_MET');

    const valOverMin = await validateCoupon({
      couponCode: 'MIN1000',
      userId: customerB._id,
      planId: orgPlan._id, // ₹2,499 >= ₹1,000
      billingInterval: 'monthly',
    });
    assert(valOverMin.valid === true, 'Coupon allowed when plan price >= minOrderValue');

    // ── 5. PLAN & CATEGORY TARGET APPLICABILITY ─────────────────────────────
    console.log('\n--- 5. Plan & Category Target Applicability ---');
    // Category Target: Solo / Individual Plans Only
    const soloOnlyCoupon = await Coupon.create({
      code: 'SOLOONLY',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      appliesToAllPlans: false,
      applicableCategories: ['INDIVIDUAL'],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    });

    const valSoloOnSolo = await validateCoupon({
      couponCode: 'SOLOONLY',
      userId: customerA._id,
      planId: soloPlan._id,
      billingInterval: 'monthly',
    });
    assert(valSoloOnSolo.valid === true, 'SOLOONLY coupon allowed on Solo plan');

    const valSoloOnOrg = await validateCoupon({
      couponCode: 'SOLOONLY',
      userId: customerB._id,
      planId: orgPlan._id,
      billingInterval: 'monthly',
    });
    assert(valSoloOnOrg.valid === false, 'SOLOONLY coupon rejected on Organization plan');
    assert(valSoloOnOrg.code === 'COUPON_NOT_APPLICABLE', 'Error code is COUPON_NOT_APPLICABLE');

    // Specific Plan Target
    const smartSoloOnly = await Coupon.create({
      code: 'SMARTSOLO20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      appliesToAllPlans: false,
      applicablePlans: [smartSoloPlan._id],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    });

    const valOnSmartSolo = await validateCoupon({
      couponCode: 'SMARTSOLO20',
      userId: customerA._id,
      planId: smartSoloPlan._id,
      billingInterval: 'monthly',
    });
    assert(valOnSmartSolo.valid === true, 'SMARTSOLO20 allowed on Smart Solo');

    const valOnBasicSolo = await validateCoupon({
      couponCode: 'SMARTSOLO20',
      userId: customerA._id,
      planId: soloPlan._id,
      billingInterval: 'monthly',
    });
    assert(valOnBasicSolo.valid === false, 'SMARTSOLO20 rejected on Basic Solo');

    // ── 6. VALIDITY WINDOW & EXPIRATION ────────────────────────────────────
    console.log('\n--- 6. Validity Window & Expiration ---');
    const expiredCoupon = await Coupon.create({
      code: 'EXPIREDCODE',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      validFrom: new Date(Date.now() - 60000),
      validUntil: new Date(Date.now() - 1000), // Expired 1 second ago
      appliesToAllPlans: true,
      status: 'ACTIVE',
    });

    const valExpired = await validateCoupon({
      couponCode: 'EXPIREDCODE',
      userId: customerA._id,
      planId: soloPlan._id,
    });
    assert(valExpired.valid === false, 'Expired coupon rejected');
    assert(valExpired.code === 'COUPON_EXPIRED', 'Error code is COUPON_EXPIRED');

    const futureCoupon = await Coupon.create({
      code: 'FUTURECODE',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      validFrom: new Date(Date.now() + 86400000), // Starts tomorrow
      validUntil: new Date(Date.now() + 172800000),
      appliesToAllPlans: true,
      status: 'ACTIVE',
    });

    const valFuture = await validateCoupon({
      couponCode: 'FUTURECODE',
      userId: customerA._id,
      planId: soloPlan._id,
    });
    assert(valFuture.valid === false, 'Future coupon rejected');
    assert(valFuture.code === 'COUPON_NOT_STARTED', 'Error code is COUPON_NOT_STARTED');

    // Inactive Status Check
    const inactiveCoupon = await Coupon.create({
      code: 'PAUSEDCODE',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      validUntil: new Date(Date.now() + 86400000),
      appliesToAllPlans: true,
      status: 'INACTIVE',
    });

    const valInactive = await validateCoupon({
      couponCode: 'PAUSEDCODE',
      userId: customerA._id,
      planId: soloPlan._id,
    });
    assert(valInactive.valid === false, 'Inactive coupon rejected');
    assert(valInactive.code === 'COUPON_INACTIVE', 'Error code is COUPON_INACTIVE');

    // ── 7. ATOMIC REDEMPTION & USAGE LIMITS ──────────────────────────────────
    console.log('\n--- 7. Atomic Redemption & Usage Limits ---');
    const limitedCoupon = await Coupon.create({
      code: 'FIRST2USERS',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      appliesToAllPlans: true,
      maxOverallUses: 2, // Only 2 users allowed
      maxUsesPerUser: 1,
      status: 'ACTIVE',
    });

    // 1st User Redemption
    const red1 = await recordRedemption({
      couponId: limitedCoupon._id,
      couponCode: limitedCoupon.code,
      userId: customerA._id,
      razorpayOrderId: 'order_test_red_001',
      razorpayPaymentId: 'pay_test_red_001',
      planId: soloPlan._id,
      planName: 'Basic Solo',
      billingInterval: 'monthly',
      originalAmount: 399,
      discountAmount: 199.5,
      finalAmount: 199.5,
    });

    assert(red1.status === 'REDEEMED', '1st redemption recorded as REDEEMED');
    const couponAfter1 = await Coupon.findById(limitedCoupon._id);
    assert(couponAfter1.usageCount === 1, 'Coupon usageCount incremented to 1');

    // Idempotent duplicate check with same order ID
    const duplicateRed = await recordRedemption({
      couponId: limitedCoupon._id,
      couponCode: limitedCoupon.code,
      userId: customerA._id,
      razorpayOrderId: 'order_test_red_001', // SAME ORDER
      razorpayPaymentId: 'pay_test_red_001',
      planId: soloPlan._id,
      planName: 'Basic Solo',
      billingInterval: 'monthly',
      originalAmount: 399,
      discountAmount: 199.5,
      finalAmount: 199.5,
    });

    assert(duplicateRed._id.toString() === red1._id.toString(), 'Idempotent duplicate webhook returned existing redemption');
    const couponAfterDup = await Coupon.findById(limitedCoupon._id);
    assert(couponAfterDup.usageCount === 1, 'Idempotent duplicate did NOT double-increment usageCount');

    // 2nd User Redemption (Customer B)
    const red2 = await recordRedemption({
      couponId: limitedCoupon._id,
      couponCode: limitedCoupon.code,
      userId: customerB._id,
      razorpayOrderId: 'order_test_red_002',
      razorpayPaymentId: 'pay_test_red_002',
      planId: orgPlan._id,
      planName: 'Business Agency',
      billingInterval: 'monthly',
      originalAmount: 2499,
      discountAmount: 1249.5,
      finalAmount: 1249.5,
    });

    assert(red2.status === 'REDEEMED', '2nd redemption recorded as REDEEMED');
    const couponAfter2 = await Coupon.findById(limitedCoupon._id);
    assert(couponAfter2.usageCount === 2, 'Coupon usageCount reached maximum cap (2)');

    // 3rd User Attempt (Must Fail)
    const customerC = await User.create({
      name: 'Customer Charlie',
      email: 'charlie@realty.com',
      password: 'password123',
    });

    const val3rd = await validateCoupon({
      couponCode: 'FIRST2USERS',
      userId: customerC._id,
      planId: soloPlan._id,
    });
    assert(val3rd.valid === false, '3rd user validation rejected when usageCount == maxOverallUses');
    assert(val3rd.code === 'COUPON_USAGE_LIMIT_REACHED', 'Error code is COUPON_USAGE_LIMIT_REACHED');

    let concurrentBypassRejected = false;
    try {
      await recordRedemption({
        couponId: limitedCoupon._id,
        couponCode: limitedCoupon.code,
        userId: customerC._id,
        razorpayOrderId: 'order_test_red_003',
        razorpayPaymentId: 'pay_test_red_003',
        planId: soloPlan._id,
        originalAmount: 399,
        discountAmount: 199.5,
        finalAmount: 199.5,
      });
    } catch (err) {
      concurrentBypassRejected = true;
      assert(err.code === 'COUPON_USAGE_LIMIT_REACHED', 'Atomic conditional update threw COUPON_USAGE_LIMIT_REACHED');
    }
    assert(concurrentBypassRejected === true, 'Atomic conditional check safely blocked 3rd redemption at database level');

    // Per-User Limit Check: Customer A attempts 2nd use on a non-exhausted coupon
    const singleUseCoupon = await Coupon.create({
      code: 'SINGLEUSE',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      appliesToAllPlans: true,
      maxOverallUses: 100,
      maxUsesPerUser: 1,
      status: 'ACTIVE',
    });

    await recordRedemption({
      couponId: singleUseCoupon._id,
      couponCode: singleUseCoupon.code,
      userId: customerA._id,
      razorpayOrderId: 'order_test_single_001',
      planId: soloPlan._id,
      originalAmount: 399,
      discountAmount: 39.9,
      finalAmount: 359.1,
    });

    const valSecondUse = await validateCoupon({
      couponCode: 'SINGLEUSE',
      userId: customerA._id, // Same user
      planId: soloPlan._id,
    });
    assert(valSecondUse.valid === false, 'Same user attempting 2nd redemption rejected');
    assert(valSecondUse.code === 'COUPON_USER_LIMIT_REACHED', 'Error code is COUPON_USER_LIMIT_REACHED');

    // ── 8. SUPERADMIN CONTROLLER & ANALYTICS ────────────────────────────────
    console.log('\n--- 8. SuperAdmin Controller & Analytics ---');
    // Test Analytics Aggregation
    const analytics = await getCouponAnalytics(limitedCoupon._id);
    assert(analytics.totalRedemptions === 2, `Total redemptions aggregated as 2 (got: ${analytics.totalRedemptions})`);
    assert(analytics.grossRevenue === (399 + 2499), `Gross revenue aggregated as ₹2,898 (got: ${analytics.grossRevenue})`);
    assert(analytics.totalDiscount === (199.5 + 1249.5), `Total discount aggregated as ₹1,449 (got: ${analytics.totalDiscount})`);
    assert(analytics.netRevenue === (199.5 + 1249.5), `Net revenue aggregated as ₹1,449 (got: ${analytics.netRevenue})`);

    // Test List Coupons API
    let listResData;
    await couponController.listCoupons(
      { user: superAdminUser, query: {} },
      { json: (d) => { listResData = d; } }
    );
    assert(listResData.success === true, 'SuperAdmin listCoupons returned success');
    assert(Array.isArray(listResData.coupons) && listResData.coupons.length >= 4, 'SuperAdmin listCoupons returned populated coupons with metrics');

    // Test Get Redemptions ("View Customers") API
    let redemptionsResData;
    await couponController.getRedemptions(
      { user: superAdminUser, params: { id: limitedCoupon._id }, query: { page: 1, limit: 10 } },
      { json: (d) => { redemptionsResData = d; } }
    );
    assert(redemptionsResData.success === true, 'SuperAdmin getRedemptions returned success');
    assert(redemptionsResData.redemptions.length === 2, 'Redemptions list contains 2 customer purchase entries');
    assert(redemptionsResData.redemptions[0].customerName.includes('Customer'), 'Customer name populated in redemption record');

    // Test 1-Click Activate / Deactivate / Archive
    let deactivateResData;
    await couponController.deactivateCoupon(
      { user: superAdminUser, params: { id: limitedCoupon._id } },
      { json: (d) => { deactivateResData = d; } }
    );
    assert(deactivateResData.coupon.status === 'INACTIVE', 'Coupon status transitioned to INACTIVE');

    let activateResData;
    await couponController.activateCoupon(
      { user: superAdminUser, params: { id: limitedCoupon._id } },
      { json: (d) => { activateResData = d; } }
    );
    assert(activateResData.coupon.status === 'ACTIVE', 'Coupon status transitioned to ACTIVE');

    let archiveResData;
    await couponController.archiveCoupon(
      { user: superAdminUser, params: { id: limitedCoupon._id } },
      { json: (d) => { archiveResData = d; } }
    );
    assert(archiveResData.coupon.status === 'ARCHIVED', 'Coupon status transitioned to ARCHIVED without deleting historical redemptions');

    const historicalRedemptionsCount = await CouponRedemption.countDocuments({ couponId: limitedCoupon._id });
    assert(historicalRedemptionsCount === 2, 'Historical CouponRedemption records preserved completely after archival');

    console.log('\n================================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================\n');

    await mongoose.disconnect();
    await mongoServer.stop();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('💥 Unexpected Test Error:', err);
    if (mongoServer) {
      await mongoose.disconnect();
      await mongoServer.stop();
    }
    process.exit(1);
  }
}

runCouponTests();
