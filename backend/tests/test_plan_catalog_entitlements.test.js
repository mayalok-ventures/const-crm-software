const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/User');
const Plan = require('../src/models/Plan');
const Subscription = require('../src/models/Subscription');
const Lead = require('../src/models/Lead');
const Group = require('../src/models/Group');
const Campaign = require('../src/models/Campaign');

const { seedPlans } = require('../src/utils/seedPlans');
const {
  createPlanSnapshot,
  getEffectiveEntitlements,
  hasFeature,
  assertFeature,
  getLimit,
  isUnlimited,
  getUsage,
  canUse,
  assertLimit,
} = require('../src/services/entitlementService');

const planCatalogController = require('../src/superadmin/controllers/planCatalogController');

let mongoServer;

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING: DYNAMIC PLAN CATALOG & ENTITLEMENT ENFORCEMENT SUITE');
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
    // ── 1. SEED & INITIAL CATALOG VERIFICATION ──────────────────────────────
    console.log('--- 1. Seed & Initial Catalog Verification ---');
    await seedPlans();

    const allPlans = await Plan.find().lean();
    assert(allPlans.length >= 6, `Seeded at least 6 standard versioned plans (Found: ${allPlans.length})`);

    const businessPlan = await Plan.findOne({ code: 'ORG_PRO_MONTHLY_V1' }).lean();
    assert(businessPlan !== null, 'Business Agency plan seeded successfully');
    assert(businessPlan.pricing?.monthly?.amount === 2499, 'Business Agency monthly price is ₹2,499');
    assert(businessPlan.pricing?.yearly?.amount === 24999, 'Business Agency yearly price is ₹24,999');
    assert(businessPlan.limits?.seats === 10, 'Business Agency includes 10 seats');
    assert(businessPlan.limits?.leads === 50000, 'Business Agency allows 50,000 leads');
    assert(businessPlan.features?.leadExport === true, 'Business Agency has leadExport = true');
    assert(businessPlan.features?.smartExitRules === true, 'Business Agency has smartExitRules = true');
    assert(Array.isArray(businessPlan.whatsIncluded) && businessPlan.whatsIncluded.length > 0, "Business Agency has 'What's Included' bullets");

    const enterprisePlan = await Plan.findOne({ code: 'ORG_SCALE_MONTHLY_V1' }).lean();
    assert(enterprisePlan !== null, 'Enterprise Command plan seeded successfully');
    assert(enterprisePlan.limits?.leads === -1, 'Enterprise Command has unlimited leads (-1)');
    assert(enterprisePlan.limits?.seats === 25, 'Enterprise Command includes 25 seats');

    // ── 2. SUPERADMIN PLAN CATALOG CONTROLLER TESTS ─────────────────────────
    console.log('\n--- 2. SuperAdmin Plan Catalog Controller Operations ---');
    const mockSuperAdmin = await User.create({
      name: 'Super Admin Officer',
      email: 'admin@coresetu.com',
      password: 'password123',
      role: 'superadmin',
      isAdmin: true,
    });

    // Test List Plans
    let listResData;
    await planCatalogController.listPlans(
      { user: mockSuperAdmin },
      { json: (data) => { listResData = data; } }
    );
    assert(listResData?.success === true, 'SuperAdmin listPlans returns success');
    assert(listResData?.plans?.length >= 6, 'SuperAdmin listPlans returns full catalog with subscriber counts');

    // Test Create Plan
    let createResData;
    await planCatalogController.createPlan(
      {
        user: mockSuperAdmin,
        body: {
          name: 'Custom Boutique Plan',
          slug: 'custom-boutique',
          category: 'ORGANIZATION',
          badge: 'SPECIAL',
          description: 'Special bespoke plan for boutique firms',
          pricing: {
            monthly: { enabled: true, amount: 1899 },
            yearly: { enabled: true, amount: 18990 },
          },
          limits: {
            seats: 5,
            leads: 20000,
            contactGroups: 30,
            monthlyWhatsAppMessages: 12000,
            monthlyBroadcasts: 30,
          },
          features: {
            leadManagement: true,
            leadExport: true,
            whatsapp: true,
            whatsappBroadcast: true,
            hierarchy: false,
            smartExitRules: true,
          },
          whatsIncluded: ['5 Agent Seats', '20k Leads', 'Smart Exit Rules'],
          status: 'ACTIVE',
          visibility: 'PUBLIC',
        },
      },
      {
        status: () => ({ json: (d) => { createResData = d; } }),
        json: (d) => { createResData = d; },
      }
    );
    assert(createResData?.success === true, 'SuperAdmin createPlan created new custom plan');
    assert(createResData?.plan?.version === 1, 'New plan initialized with version 1');

    const createdPlanId = createResData.plan._id;

    // Test Update Plan (Price/Limits Change -> Version Increment)
    let updateResData;
    await planCatalogController.updatePlan(
      {
        user: mockSuperAdmin,
        params: { id: createdPlanId },
        body: {
          pricing: {
            monthly: { enabled: true, amount: 2199 },
            yearly: { enabled: true, amount: 21990 },
          },
          limits: {
            seats: 6,
          },
        },
      },
      {
        status: () => ({ json: (d) => { updateResData = d; } }),
        json: (d) => { updateResData = d; },
      }
    );
    assert(updateResData?.success === true, 'SuperAdmin updatePlan updated successfully');
    assert(updateResData?.plan?.version === 2, 'Version incremented to v2 on published configuration update');
    assert(updateResData?.plan?.pricing?.monthly?.amount === 2199, 'Updated monthly price saved in DB');

    // Test Duplicate Plan
    let duplicateResData;
    await planCatalogController.duplicatePlan(
      {
        user: mockSuperAdmin,
        params: { id: createdPlanId },
      },
      {
        status: () => ({ json: (d) => { duplicateResData = d; } }),
        json: (d) => { duplicateResData = d; },
      }
    );
    assert(duplicateResData?.success === true, 'SuperAdmin duplicatePlan created clone draft');
    assert(duplicateResData?.plan?.status === 'DRAFT', 'Cloned plan default status is DRAFT');
    assert(duplicateResData?.plan?.slug !== createResData.plan.slug, 'Cloned plan has unique slug');

    // Test Archive Plan
    let archiveResData;
    await planCatalogController.archivePlan(
      {
        user: mockSuperAdmin,
        params: { id: createdPlanId },
      },
      {
        status: () => ({ json: (d) => { archiveResData = d; } }),
        json: (d) => { archiveResData = d; },
      }
    );
    assert(archiveResData?.success === true, 'SuperAdmin archivePlan soft-archived plan');
    assert(archiveResData?.plan?.status === 'ARCHIVED', 'Archived plan status is ARCHIVED');
    assert(archiveResData?.plan?.visibility === 'HIDDEN', 'Archived plan visibility is HIDDEN');

    // Test Publish/Unarchive Plan
    let publishResData;
    await planCatalogController.publishPlan(
      {
        user: mockSuperAdmin,
        params: { id: createdPlanId },
      },
      {
        status: () => ({ json: (d) => { publishResData = d; } }),
        json: (d) => { publishResData = d; },
      }
    );
    assert(publishResData?.success === true, 'SuperAdmin publishPlan reactivated plan');
    assert(publishResData?.plan?.status === 'ACTIVE', 'Plan status restored to ACTIVE');

    // Test Permanent Delete Plan (Draft/Cloned Plan)
    let deleteResData;
    await planCatalogController.deletePlan(
      {
        user: mockSuperAdmin,
        params: { id: duplicateResData.plan._id },
        query: {},
      },
      {
        status: () => ({ json: (d) => { deleteResData = d; } }),
        json: (d) => { deleteResData = d; },
      }
    );
    assert(deleteResData?.success === true, 'SuperAdmin deletePlan permanently deleted plan from DB');
    const deletedCheck = await Plan.findById(duplicateResData.plan._id);
    assert(deletedCheck === null, 'Deleted plan no longer exists in database');

    // Re-archive custom plan for public test
    await planCatalogController.archivePlan(
      { user: mockSuperAdmin, params: { id: createdPlanId } },
      { status: () => ({ json: () => {} }), json: () => {} }
    );

    // Test Public Plans Endpoint
    let publicResData;
    await planCatalogController.getPublicPlans(
      {},
      { json: (d) => { publicResData = d; } }
    );
    assert(publicResData?.success === true, 'Public /api/plans endpoint returns success');
    assert(Array.isArray(publicResData?.plans?.individual) && publicResData.plans.individual.length > 0, 'Public plans contains individual plans');
    assert(Array.isArray(publicResData?.plans?.organization) && publicResData.plans.organization.length > 0, 'Public plans contains organization plans');
    assert(!publicResData?.plans?.all?.some(p => p.id === 'custom-boutique'), 'Archived custom plan is excluded from public pricing page');

    // ── 3. SUBSCRIPTION SNAPSHOT & VERSION ISOLATION ────────────────────────
    console.log('\n--- 3. Subscription Snapshot & Version Isolation ---');
    const tenantOwner = await User.create({
      name: 'Apex Realty Agency',
      email: 'apex@realty.com',
      password: 'password123',
      workStatus: 'company_owner',
      companyRole: 'owner',
      plan: 'business',
    });

    const activeBusinessPlan = await Plan.findOne({ code: 'ORG_PRO_MONTHLY_V1' });
    const snapshotV1 = createPlanSnapshot(activeBusinessPlan, 'monthly');

    const subscription = await Subscription.create({
      userId: tenantOwner._id,
      companyId: tenantOwner._id,
      accountType: 'ORGANIZATION',
      planId: activeBusinessPlan._id,
      planVersion: 1,
      billingInterval: 'monthly',
      status: 'ACTIVE',
      amount: 2499,
      amountInPaise: 249900,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 1000),
      entitlementSnapshot: snapshotV1,
    });

    const resolvedEntitlements = await getEffectiveEntitlements(tenantOwner._id);
    assert(resolvedEntitlements.isSnapshot === true, 'Resolved entitlements from Subscription immutable snapshot');
    assert(resolvedEntitlements.limits.seats === 10, 'Snapshot provides 10 seats');
    assert(resolvedEntitlements.limits.leads === 50000, 'Snapshot provides 50,000 leads');
    assert(resolvedEntitlements.features.leadExport === true, 'Snapshot provides leadExport');

    // Now SuperAdmin updates the global Plan in DB (e.g. raises price and changes seats)
    activeBusinessPlan.limits.seats = 12;
    activeBusinessPlan.version = 2;
    await activeBusinessPlan.save();

    // Verify existing subscriber STILL keeps their original snapshot!
    const postChangeEntitlements = await getEffectiveEntitlements(tenantOwner._id);
    assert(postChangeEntitlements.limits.seats === 10, 'Existing subscriber snapshot preserved at 10 seats despite global plan edit');

    // ── 4. RESOURCE LIMIT ENFORCEMENT & CONCURRENCY ─────────────────────────
    console.log('\n--- 4. Resource Limit Enforcement ---');
    // Test Leads Limit
    const leadAllowed = await canUse(tenantOwner._id, 'leads', 1);
    assert(leadAllowed === true, 'Leads creation is allowed when usage (0) < limit (50,000)');

    // Create 10 dummy leads
    for (let i = 1; i <= 10; i++) {
      await Lead.create({
        userId: tenantOwner._id,
        companyId: tenantOwner._id,
        name: `Lead ${i}`,
        phone: `91987654321${i}`,
        status: 'new',
      });
    }

    const currentLeadUsage = await getUsage(tenantOwner._id, 'leads');
    assert(currentLeadUsage === 10, `Current lead usage accurately computed as ${currentLeadUsage}`);

    // Test a strict capped plan (e.g. Solo with 2 leads limit)
    const soloUser = await User.create({
      name: 'Solo Broker John',
      email: 'john@solo.com',
      password: 'password123',
      workStatus: 'independent_agent',
      plan: 'basic_solo',
    });

    const soloPlan = await Plan.findOne({ code: 'IND_STARTER_MONTHLY_V1' });
    const soloSub = await Subscription.create({
      userId: soloUser._id,
      accountType: 'INDIVIDUAL',
      planId: soloPlan._id,
      planVersion: 1,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 1000),
      entitlementSnapshot: {
        limits: { leads: 2, seats: 1, contactGroups: 2 },
        features: { leadManagement: true, leadExport: false, whatsappBroadcast: false },
        whatsIncluded: ['Max 2 leads test'],
      },
    });

    await Lead.create({ userId: soloUser._id, name: 'Solo Lead 1', phone: '918888888801' });
    await Lead.create({ userId: soloUser._id, name: 'Solo Lead 2', phone: '918888888802' });

    let leadLimitExceeded = false;
    try {
      await assertLimit(soloUser._id, 'leads', 1);
    } catch (err) {
      leadLimitExceeded = true;
      assert(err.statusCode === 403, 'Limit exceeded throws HTTP 403');
      assert(err.code === 'PLAN_LIMIT_EXCEEDED', 'Limit exceeded returns code PLAN_LIMIT_EXCEEDED');
      assert(err.resource === 'leads', 'Limit error specifies resource = leads');
    }
    assert(leadLimitExceeded, 'assertLimit blocked creating 3rd lead on a 2-lead plan');

    // Test Seats Limit on Organization
    const agent1 = await User.create({
      name: 'Agent One',
      email: 'agent1@apex.com',
      password: 'password123',
      role: 'agent',
      companyId: tenantOwner._id,
      isActive: true,
    });
    const agent2 = await User.create({
      name: 'Agent Two',
      email: 'agent2@apex.com',
      password: 'password123',
      role: 'agent',
      companyId: tenantOwner._id,
      isActive: true,
    });

    const seatUsage = await getUsage(tenantOwner._id, 'seats');
    assert(seatUsage === 3, `Seat usage correctly calculated as 3 (1 Owner + 2 Agents, got: ${seatUsage})`);

    // ── 5. FEATURE PERMISSIONS & CHECKBOX ENFORCEMENT ────────────────────────
    console.log('\n--- 5. Feature Permissions & Checkbox Enforcement ---');
    // Solo user has leadExport = false
    let exportDenied = false;
    try {
      await assertFeature(soloUser._id, 'leadExport');
    } catch (err) {
      exportDenied = true;
      assert(err.statusCode === 403, 'Feature denied throws HTTP 403');
      assert(err.code === 'FEATURE_NOT_AVAILABLE', 'Feature denied returns code FEATURE_NOT_AVAILABLE');
      assert(err.feature === 'leadExport', 'Feature error specifies feature = leadExport');
    }
    assert(exportDenied, 'assertFeature blocked leadExport for Solo User');

    // Tenant owner has leadExport = true
    let exportAllowed = false;
    try {
      exportAllowed = await assertFeature(tenantOwner._id, 'leadExport');
    } catch (err) {}
    assert(exportAllowed === true, 'assertFeature allowed leadExport for Business Agency tenant');

    // WhatsApp Broadcast Feature Check
    let broadcastDenied = false;
    try {
      await assertFeature(soloUser._id, 'whatsappBroadcast');
    } catch (err) {
      broadcastDenied = true;
    }
    assert(broadcastDenied, 'assertFeature blocked whatsappBroadcast for user without permission');

    // Unlimited check on Enterprise
    const enterpriseOrg = await User.create({
      name: 'Titan Global Corp',
      email: 'titan@corp.com',
      password: 'password123',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });

    await Subscription.create({
      userId: enterpriseOrg._id,
      companyId: enterpriseOrg._id,
      accountType: 'ORGANIZATION',
      planId: enterprisePlan._id,
      planVersion: 1,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      entitlementSnapshot: createPlanSnapshot(enterprisePlan, 'yearly'),
    });

    const isLeadsUnlimited = await isUnlimited(enterpriseOrg._id, 'leads');
    assert(isLeadsUnlimited === true, 'Enterprise plan isUnlimited(leads) returns true (-1)');
    const canAdd100kLeads = await canUse(enterpriseOrg._id, 'leads', 100000);
    assert(canAdd100kLeads === true, 'Enterprise plan allows adding 100,000 leads without limit');

    console.log('\n================================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================\n');

    await mongoose.disconnect();
    await mongoServer.stop();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('💥 Unexpected Test Suite Error:', err);
    if (mongoServer) {
      await mongoose.disconnect();
      await mongoServer.stop();
    }
    process.exit(1);
  }
}

runTests();
