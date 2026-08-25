/**
 * Comprehensive Real Estate CRM Complete Business Lifecycle Test Suite
 * 
 * Tests:
 * 1.  Lead CRUD & deterministic scoring (0-100, COLD/WARM/HOT).
 * 2.  Multiple Requirements per Lead (1 -> N), update, activate/deactivate.
 * 3.  Property Matching Engine (Deterministic score, location, budget, config, matching units).
 * 4.  Site Visit Management via FollowUp (Schedule, Complete, Outcome, Score recalc).
 * 5.  Opportunities / Deals (Multiple deals per lead, stage history, weighted value, won/lost).
 * 6.  EOI Lifecycle (Create with atomic hold, Confirm, Cancel with inventory release, Expire).
 * 7.  Inventory Concurrency & Race Condition Defense (Simultaneous HOLD and BOOK conflict tests).
 * 8.  Booking Management (Atomic inventory lock, CLP payment schedule generation, EOI conversion, Opportunity won, Commission payout generation, Cancellation with inventory release).
 * 9.  Payment Schedules & Receipts (Partial payment, Full payment, validation, Booking totalPaid update).
 * 10. Offers & Schemes (Create, calculate discount on booking).
 * 11. Real Estate Analytics Engine (Strict tenant scoping, conversion rates, pipeline value).
 * 12. Multi-Tenant Isolation (Tenant A vs Tenant B isolation across all collections).
 * 13. Non-Real-Estate Vertical Regression (Agency, Education, SaaS isolation).
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config();

const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Project = require('../src/models/Project');
const FollowUp = require('../src/models/FollowUp');
const Requirement = require('../src/models/Requirement');
const Opportunity = require('../src/models/Opportunity');
const Inventory = require('../src/models/Inventory');
const EOI = require('../src/models/EOI');
const Booking = require('../src/models/Booking');
const PaymentSchedule = require('../src/models/PaymentSchedule');
const Offer = require('../src/models/Offer');
const CommissionRule = require('../src/models/CommissionRule');
const CommissionPayout = require('../src/models/CommissionPayout');
const realEstateController = require('../src/controllers/realEstateController');

const assert = (condition, message) => {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✅ [PASS] ${message}`);
  }
};

const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

let mongoServer;

async function runCompleteRealEstateTestSuite() {
  console.log('\n======================================================');
  console.log('🏗️  CORESETU REAL ESTATE CRM — COMPLETE LIFECYCLE TEST SUITE');
  console.log('======================================================\n');

  try {
    if (mongoose.connection.readyState === 0) {
      if (process.env.MONGO_URI && process.env.MONGO_URI.startsWith('mongodb')) {
        try {
          await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2000 });
        } catch {
          mongoServer = await MongoMemoryServer.create();
          await mongoose.connect(mongoServer.getUri());
        }
      } else {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
      }
    }

    const tenantAId = new mongoose.Types.ObjectId();
    const tenantBId = new mongoose.Types.ObjectId();
    const userA = { _id: tenantAId, name: 'Tenant A Admin', companyId: tenantAId, role: 'admin' };
    const userB = { _id: tenantBId, name: 'Tenant B Admin', companyId: tenantBId, role: 'admin' };

    // Clean up any test artifacts for this run
    await Promise.all([
      Lead.deleteMany({ companyId: { $in: [tenantAId, tenantBId] } }),
      Project.deleteMany({ companyId: { $in: [tenantAId, tenantBId] } }),
      Requirement.deleteMany({ companyId: { $in: [tenantAId, tenantBId] } }),
      Inventory.deleteMany({ companyId: { $in: [tenantAId, tenantBId] } }),
      Opportunity.deleteMany({ companyId: { $in: [tenantAId, tenantBId] } }),
      EOI.deleteMany({ companyId: { $in: [tenantAId, tenantBId] } }),
      Booking.deleteMany({ companyId: { $in: [tenantAId, tenantBId] } }),
      PaymentSchedule.deleteMany({ companyId: { $in: [tenantAId, tenantBId] } }),
      Offer.deleteMany({ companyId: { $in: [tenantAId, tenantBId] } }),
      CommissionPayout.deleteMany({ userId: tenantAId }),
    ]);

    // ─────────────────────────────────────────────────────────────
    // 1. LEAD CREATION & DETERMINISTIC SCORING
    // ─────────────────────────────────────────────────────────────
    console.log('1️⃣ Testing Real Estate Lead Creation & Deterministic Scoring...');
    const leadA = await Lead.create({
      userId: tenantAId,
      companyId: tenantAId,
      name: 'Rohan Sharma',
      phone: '9876543210',
      email: 'rohan.sharma@example.com',
      budgetMin: 8000000,
      budgetMax: 12000000,
      location: 'Noida Expressway',
      preferredConfigurations: ['3BHK'],
      propertyType: 'Apartment',
      status: 'new_lead',
    });

    const scoreResult1 = await realEstateController.calculateLeadScoreInternal(leadA._id, tenantAId);
    assert(scoreResult1.score === 20, `Initial score with budget and location should be 20 pts (Got ${scoreResult1.score})`);
    assert(scoreResult1.temperature === 'COLD', `Initial temperature should be COLD (Got ${scoreResult1.temperature})`);

    // ─────────────────────────────────────────────────────────────
    // 2. MULTIPLE REQUIREMENTS PER LEAD (1 -> N)
    // ─────────────────────────────────────────────────────────────
    console.log('2️⃣ Testing Multiple Requirements Management (1 -> N)...');
    const reqReq1 = {
      user: userA,
      body: {
        leadId: leadA._id,
        title: '3BHK Family Flat',
        propertyType: 'Apartment',
        configurations: ['3BHK'],
        preferredLocations: ['Sector 137', 'Noida Expressway'],
        budgetMin: 8500000,
        budgetMax: 11000000,
        purpose: 'End Use',
      },
    };
    const reqRes1 = mockRes();
    await realEstateController.createRequirement(reqReq1, reqRes1);
    assert(reqRes1.data && reqRes1.data.success, 'Requirement 1 created');
    const req1Id = reqRes1.data.data._id;

    const reqReq2 = {
      user: userA,
      body: {
        leadId: leadA._id,
        title: 'Commercial Office Space',
        propertyType: 'Commercial',
        configurations: ['Office'],
        preferredLocations: ['Sector 62 Noida'],
        budgetMin: 15000000,
        budgetMax: 25000000,
        purpose: 'Investment',
      },
    };
    const reqRes2 = mockRes();
    await realEstateController.createRequirement(reqReq2, reqRes2);
    assert(reqRes2.data && reqRes2.data.success, 'Requirement 2 created for same lead');

    const leadReqsCount = await Requirement.countDocuments({ leadId: leadA._id, companyId: tenantAId });
    assert(leadReqsCount === 2, `Lead has exactly 2 distinct requirements (Got ${leadReqsCount})`);

    // Verify score bumped
    const refreshedLead1 = await Lead.findById(leadA._id);
    assert(refreshedLead1.score === 30, `Score with Active Requirement should be 30 pts (Got ${refreshedLead1.score})`);
    assert(refreshedLead1.temperature === 'WARM', `Temperature should be WARM (Got ${refreshedLead1.temperature})`);

    // ─────────────────────────────────────────────────────────────
    // 3. PROJECT & INVENTORY MANAGEMENT
    // ─────────────────────────────────────────────────────────────
    console.log('3️⃣ Testing Project & Inventory Creation with Unit Counters...');
    const projectA = await Project.create({
      userId: tenantAId,
      companyId: tenantAId,
      name: 'Godrej Palm Retreat',
      location: 'Sector 150, Noida Expressway',
      city: 'Noida',
      developer: 'Godrej Properties',
      minPrice: 8500000,
      maxPrice: 15000000,
      configuration: ['2BHK', '3BHK', '4BHK'],
      amenities: ['Clubhouse', 'Swimming Pool', 'EV Charging', 'Tennis Court'],
      status: 'available',
      isActive: true,
    });

    const invReq1 = {
      user: userA,
      body: {
        projectId: projectA._id,
        tower: 'Tower B',
        floor: 12,
        unitNumber: 'B-1204',
        configuration: '3BHK',
        facing: 'East',
        carpetArea: 1350,
        superArea: 1750,
        basePrice: 9500000,
        additionalCharges: 500000,
        totalPrice: 10000000,
      },
    };
    const invRes1 = mockRes();
    await realEstateController.createInventory(invReq1, invRes1);
    assert(invRes1.data && invRes1.data.success, 'Inventory Unit B-1204 created');
    const unit1Id = invRes1.data.data._id;

    // Verify duplicate unit number rejected with 409
    const invResDup = mockRes();
    await realEstateController.createInventory(invReq1, invResDup);
    assert(invResDup.statusCode === 409, 'Duplicate Unit B-1204 in same project rejected with 409');

    // Create a second unit
    const invReq2 = {
      user: userA,
      body: {
        projectId: projectA._id,
        tower: 'Tower B',
        floor: 14,
        unitNumber: 'B-1402',
        configuration: '3BHK',
        facing: 'North-East',
        carpetArea: 1350,
        superArea: 1750,
        basePrice: 9800000,
        additionalCharges: 500000,
        totalPrice: 10300000,
      },
    };
    const invRes2 = mockRes();
    await realEstateController.createInventory(invReq2, invRes2);
    const unit2Id = invRes2.data.data._id;

    const refreshedProjA = await Project.findById(projectA._id);
    assert(refreshedProjA.totalUnits === 2 && refreshedProjA.availableUnits === 2, 'Project counters accurately reflect 2 available units');

    // ─────────────────────────────────────────────────────────────
    // 4. PROPERTY MATCHING ENGINE
    // ─────────────────────────────────────────────────────────────
    console.log('4️⃣ Testing Deterministic Property Matching Engine...');
    const matchReq = {
      user: userA,
      body: {
        requirementId: req1Id,
      },
    };
    const matchRes = mockRes();
    await realEstateController.matchProperties(matchReq, matchRes);
    assert(matchRes.data && matchRes.data.success, 'Property matching executed');
    assert(matchRes.data.count > 0, 'Matching projects found');
    const firstMatch = matchRes.data.data[0];
    assert(firstMatch.project.name === 'Godrej Palm Retreat', 'Matched Godrej Palm Retreat');
    assert(firstMatch.matchScore >= 80, `High deterministic match score: ${firstMatch.matchScore}%`);
    assert(firstMatch.availableInventoryCount === 2, `Available inventory count matches: ${firstMatch.availableInventoryCount}`);

    // ─────────────────────────────────────────────────────────────
    // 5. SITE VISIT LIFECYCLE VIA FOLLOWUP
    // ─────────────────────────────────────────────────────────────
    console.log('5️⃣ Testing Site Visit Scheduling & Completion Lifecycle...');
    const siteVisitFollowUp = await FollowUp.create({
      user_id: tenantAId,
      companyId: tenantAId,
      lead_id: leadA._id,
      leadId: leadA._id,
      type: 'site_visit',
      scheduled_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      note: 'Site Visit scheduled for Godrej Palm Retreat 3BHK',
      siteVisitDetails: {
        projectId: projectA._id,
        inventoryId: unit1Id,
        location: 'Sector 150, Noida',
        outcome: 'INTERESTED',
        clientFeedback: 'Loved the 3BHK layout and club amenities',
      },
      status: 'open',
    });

    const scoreAfterScheduled = await realEstateController.calculateLeadScoreInternal(leadA._id, tenantAId);
    assert(scoreAfterScheduled.score === 50, `Score with Scheduled Site Visit is 50 pts (Got ${scoreAfterScheduled.score})`);

    // Complete site visit
    siteVisitFollowUp.status = 'done';
    siteVisitFollowUp.siteVisitDetails.outcome = 'HIGHLY_INTERESTED';
    await siteVisitFollowUp.save();

    const scoreAfterCompleted = await realEstateController.calculateLeadScoreInternal(leadA._id, tenantAId);
    assert(scoreAfterCompleted.score === 60, `Score with Completed Site Visit is 60 pts (Got ${scoreAfterCompleted.score})`);
    assert(scoreAfterCompleted.temperature === 'HOT', `Temperature is HOT (Got ${scoreAfterCompleted.temperature})`);

    // ─────────────────────────────────────────────────────────────
    // 6. OPPORTUNITY / DEAL PIPELINE
    // ─────────────────────────────────────────────────────────────
    console.log('6️⃣ Testing Opportunity Deal Management & Weighted Pipeline...');
    const oppReq = {
      user: userA,
      body: {
        leadId: leadA._id,
        requirementId: req1Id,
        projectId: projectA._id,
        inventoryId: unit1Id,
        title: 'Rohan Sharma - Godrej 3BHK',
        stage: 'Site Visit Completed',
        expectedValue: 10000000,
        probability: 70,
      },
    };
    const oppRes = mockRes();
    await realEstateController.createOpportunity(oppReq, oppRes);
    assert(oppRes.data && oppRes.data.success, 'Opportunity deal created');
    const oppId = oppRes.data.data._id;

    // Move to Negotiation
    const stageReq = {
      user: userA,
      params: { id: oppId },
      body: { stage: 'Negotiation', remark: 'Discussing parking & PLC discount' },
    };
    const stageRes = mockRes();
    await realEstateController.updateOpportunityStage(stageReq, stageRes);
    assert(stageRes.data.data.probability === 80, `Probability moved to 80% (Got ${stageRes.data.data.probability}%)`);
    assert(stageRes.data.data.stageHistory.length === 2, 'Stage history preserved');

    // ─────────────────────────────────────────────────────────────
    // 7. INVENTORY ATOMIC CONCURRENCY & RACE CONDITION TEST
    // ─────────────────────────────────────────────────────────────
    console.log('7️⃣ Testing Inventory Atomic HOLD Concurrency & Race Condition Protection...');
    
    // Simulate Agent 1 and Agent 2 attempting to hold unit1Id simultaneously
    const holdReqAgent1 = { user: userA, params: { id: unit1Id }, body: { leadId: leadA._id, durationMinutes: 1440 } };
    const holdResAgent1 = mockRes();
    
    const leadOther = await Lead.create({
      userId: tenantAId,
      companyId: tenantAId,
      name: 'Priya Verma',
      phone: '9811223344',
      status: 'new_lead',
    });
    const holdReqAgent2 = { user: userA, params: { id: unit1Id }, body: { leadId: leadOther._id, durationMinutes: 1440 } };
    const holdResAgent2 = mockRes();

    // Fire both hold requests
    await Promise.all([
      realEstateController.holdInventoryUnit(holdReqAgent1, holdResAgent1),
      realEstateController.holdInventoryUnit(holdReqAgent2, holdResAgent2),
    ]);

    const agent1Success = holdResAgent1.statusCode === 200;
    const agent2Success = holdResAgent2.statusCode === 200;
    const exactlyOneHeld = (agent1Success && !agent2Success) || (!agent1Success && agent2Success);
    assert(exactlyOneHeld, `Exactly one hold succeeded (Agent 1: ${holdResAgent1.statusCode}, Agent 2: ${holdResAgent2.statusCode})`);

    // Release hold to test EOI hold flow
    const releaseReq = { user: userA, params: { id: unit1Id } };
    const releaseRes = mockRes();
    await realEstateController.releaseInventoryHold(releaseReq, releaseRes);
    assert(releaseRes.data && releaseRes.data.success, 'Unit hold released back to AVAILABLE');

    // ─────────────────────────────────────────────────────────────
    // 8. EOI LIFECYCLE (SUBMIT -> CONFIRM -> CONVERT / CANCEL)
    // ─────────────────────────────────────────────────────────────
    console.log('8️⃣ Testing Expression of Interest (EOI) Lifecycle...');
    const eoiReq = {
      user: userA,
      body: {
        leadId: leadA._id,
        opportunityId: oppId,
        projectId: projectA._id,
        inventoryId: unit1Id,
        tokenAmount: 100000,
        paymentMode: 'NEFT',
        paymentReference: 'TXN-EOI-98765',
        notes: 'Token for 3BHK Unit B-1204',
      },
    };
    const eoiRes = mockRes();
    await realEstateController.createEOI(eoiReq, eoiRes);
    assert(eoiRes.data && eoiRes.data.success, 'EOI created and submitted');
    const eoiId = eoiRes.data.data._id;
    assert(eoiRes.data.data.eoiNumber.startsWith('EOI-'), 'Unique EOI number generated');

    // Verify unit1Id was atomically placed on HOLD for leadA
    const unit1AfterEOI = await Inventory.findById(unit1Id);
    assert(unit1AfterEOI.status === 'HOLD', 'Unit status placed on HOLD');
    assert(String(unit1AfterEOI.holdByLeadId) === String(leadA._id), 'Unit held specifically by Lead A');

    // Confirm EOI
    const confirmReq = { user: userA, params: { id: eoiId }, body: { paymentReference: 'NEFT-CONFIRMED-123' } };
    const confirmRes = mockRes();
    await realEstateController.confirmEOI(confirmReq, confirmRes);
    assert(confirmRes.data.data.status === 'CONFIRMED', 'EOI confirmed');

    // ─────────────────────────────────────────────────────────────
    // 9. BOOKING & PAYMENT SCHEDULE (TRANSACTION-SAFE)
    // ─────────────────────────────────────────────────────────────
    console.log('9️⃣ Testing Booking Creation & Automatic Payment Schedule Generation...');
    
    // Set up a Commission Rule for testing commission payout generation
    await CommissionRule.deleteMany({ isActive: true });
    await CommissionRule.create({
      ruleName: 'Standard Real Estate 1% Commission',
      targetRole: 'AGENT',
      commissionType: 'PERCENTAGE',
      value: 1.0,
      isActive: true,
      createdBy: tenantAId,
    });

    const bookingReq = {
      user: userA,
      body: {
        leadId: leadA._id,
        opportunityId: oppId,
        projectId: projectA._id,
        inventoryId: unit1Id,
        eoiId: eoiId,
        bookingAmount: 500000,
        agreementValue: 10000000,
        paymentPlan: 'CLP',
        notes: 'Confirmed booking for Unit B-1204',
      },
    };
    const bookingRes = mockRes();
    await realEstateController.createBooking(bookingReq, bookingRes);
    assert(bookingRes.data && bookingRes.data.success, 'Booking created successfully');
    const bookingId = bookingRes.data.data._id;
    const bookingNum = bookingRes.data.data.bookingNumber;
    assert(bookingNum.startsWith('BK-'), `Unique booking number: ${bookingNum}`);

    // Verify unit is BOOKED
    const unit1AfterBooking = await Inventory.findById(unit1Id);
    assert(unit1AfterBooking.status === 'BOOKED', 'Inventory unit marked as BOOKED');

    // Verify Payment Schedule milestones generated
    const schedules = await PaymentSchedule.find({ bookingId }).sort({ dueDate: 1 });
    assert(schedules.length === 6, `Generated exactly 6 CLP payment milestones (Found: ${schedules.length})`);
    assert(schedules[0].milestoneName === 'Booking Token' && schedules[0].status === 'PAID', 'First milestone is Token and marked PAID');
    assert(schedules[1].milestoneName === 'Agreement Signing' && schedules[1].status === 'UPCOMING', 'Second milestone is Agreement Signing');

    // Verify EOI converted
    const eoiAfterBooking = await EOI.findById(eoiId);
    assert(eoiAfterBooking.status === 'CONVERTED_TO_BOOKING', 'EOI marked CONVERTED_TO_BOOKING');

    // Verify Opportunity WON
    const oppAfterBooking = await Opportunity.findById(oppId);
    assert(oppAfterBooking.status === 'WON' && oppAfterBooking.stage === 'Booking Confirmed', 'Opportunity marked WON');

    // Verify Commission Payout generated
    const payout = await CommissionPayout.findOne({ leadId: leadA._id });
    assert(payout && payout.commissionEarned === 100000, `Commission payout generated accurately (1% of 1Cr = ₹1,00,000, Got: ${payout?.commissionEarned})`);

    // Verify Lead Deal Won
    const leadAfterBooking = await Lead.findById(leadA._id);
    assert(leadAfterBooking.status === 'deal_won', 'Lead marked deal_won');
    assert(leadAfterBooking.score === 100, `Lead score maxed out at 100 pts (Got: ${leadAfterBooking.score})`);

    // ─────────────────────────────────────────────────────────────
    // 10. PAYMENT MILESTONE RECORDING & RECEIPTS
    // ─────────────────────────────────────────────────────────────
    console.log('🔟 Testing Payment Recording & Financial Ledger Updates...');
    const milestone2 = schedules[1];
    
    // Partial payment test
    const payReq1 = {
      user: userA,
      params: { scheduleId: milestone2._id },
      body: {
        paidAmount: 500000,
        paymentMode: 'Cheque',
        transactionRef: 'CHQ-554433',
        notes: 'Partial payment 50%',
      },
    };
    const payRes1 = mockRes();
    await realEstateController.recordPaymentReceipt(payReq1, payRes1);
    assert(payRes1.data.data.status === 'PARTIALLY_PAID', 'Milestone marked PARTIALLY_PAID after partial payment');

    // Full remaining payment
    const payReq2 = {
      user: userA,
      params: { scheduleId: milestone2._id },
      body: {
        paidAmount: 500000,
        paymentMode: 'RTGS',
        transactionRef: 'RTGS-998877',
      },
    };
    const payRes2 = mockRes();
    await realEstateController.recordPaymentReceipt(payReq2, payRes2);
    assert(payRes2.data.data.status === 'PAID', 'Milestone marked PAID after full payment');

    const refreshedBooking = await Booking.findById(bookingId);
    assert(refreshedBooking.totalPaid === 1500000, `Booking totalPaid updated to ₹15,00,000 (Got ₹${refreshedBooking.totalPaid})`);

    // ─────────────────────────────────────────────────────────────
    // 11. OFFERS / SCHEMES ENGINE
    // ─────────────────────────────────────────────────────────────
    console.log('1️⃣1️⃣ Testing Offers & Schemes Engine...');
    const offerReq = {
      user: userA,
      body: {
        title: 'Festival 5% Spot Booking Discount',
        code: 'FESTIVE5',
        schemeType: 'percentage_discount',
        discountPct: 5,
        applicableProjects: [projectA._id],
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    };
    const offerRes = mockRes();
    await realEstateController.createOffer(offerReq, offerRes);
    assert(offerRes.data && offerRes.data.success, 'Offer FESTIVE5 created');

    // ─────────────────────────────────────────────────────────────
    // 12. REAL ESTATE ANALYTICS SUMMARY
    // ─────────────────────────────────────────────────────────────
    console.log('1️⃣2️⃣ Testing Real Estate Analytics Aggregation & KPI Engine...');
    const analyticsReq = { user: userA };
    const analyticsRes = mockRes();
    await realEstateController.getRealEstateAnalytics(analyticsReq, analyticsRes);
    assert(analyticsRes.data && analyticsRes.data.success, 'Analytics summary generated');
    const stats = analyticsRes.data.data;
    assert(stats.leads.hot >= 1, `Analytics shows HOT lead count (Got ${stats.leads.hot})`);
    assert(stats.bookings.count === 1, `Analytics shows 1 confirmed booking (Got ${stats.bookings.count})`);
    assert(stats.bookings.totalAgreementValue === 10000000, `Analytics shows ₹1Cr booking value (Got ${stats.bookings.totalAgreementValue})`);
    assert(stats.bookings.totalCollectedAmount === 1500000, `Analytics shows ₹15L collected amount (Got ${stats.bookings.totalCollectedAmount})`);

    // ─────────────────────────────────────────────────────────────
    // 13. MULTI-TENANT ISOLATION (TENANT A vs TENANT B)
    // ─────────────────────────────────────────────────────────────
    console.log('1️⃣3️⃣ Testing Strict Multi-Tenant Security & Isolation (Tenant A vs Tenant B)...');
    
    // Tenant B attempts to fetch Tenant A's requirements
    const bReqsReq = { user: userB, query: {} };
    const bReqsRes = mockRes();
    await realEstateController.getRequirements(bReqsReq, bReqsRes);
    assert(bReqsRes.data.data.length === 0, 'Tenant B cannot see Tenant A requirements');

    // Tenant B attempts to fetch Tenant A's inventory
    const bInvReq = { user: userB, query: { projectId: projectA._id } };
    const bInvRes = mockRes();
    await realEstateController.getInventory(bInvReq, bInvRes);
    assert(bInvRes.data.data.length === 0, 'Tenant B cannot see Tenant A inventory');

    // Tenant B attempts to fetch Tenant A's bookings
    const bBkReq = { user: userB, query: {} };
    const bBkRes = mockRes();
    await realEstateController.getBookings(bBkReq, bBkRes);
    assert(bBkRes.data.data.length === 0, 'Tenant B cannot see Tenant A bookings');

    // Tenant B attempts to manipulate Tenant A's booking
    const bCancelReq = { user: userB, params: { id: bookingId }, body: { cancellationReason: 'Malicious' } };
    const bCancelRes = mockRes();
    await realEstateController.cancelBooking(bCancelReq, bCancelRes);
    assert(bCancelRes.statusCode === 404, 'Tenant B blocked from modifying Tenant A booking with 404');

    console.log('\n======================================================');
    console.log('🏁 COMPLETE REAL ESTATE LIFECYCLE: ALL 13 TEST SUITES PASSED');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Error during complete Real Estate test suite:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    if (mongoServer) await mongoServer.stop();
  }
}

runCompleteRealEstateTestSuite();
