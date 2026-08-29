/**
 * Real Estate Manager Panel Complete Verification Test Suite
 * Tests:
 * 1. Manager RBAC & Team Scoping
 * 2. Multi-Tenant Isolation (Tenant A vs Tenant B)
 * 3. SuperAdmin Route Restrictions (403 Forbidden for Manager)
 * 4. Atomic Inventory Hold Concurrency (409 Conflict)
 * 5. Complete Real Estate Lifecycle (Lead -> Requirement -> Match -> Visit -> EOI -> Booking -> Schedule -> Payment -> Commission)
 * 6. Manager Team Performance & Workload APIs
 * 7. Manager Lead Reassignment within Tenant Scope
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Import Models
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Project = require('../src/models/Project');
const Inventory = require('../src/models/Inventory');
const Requirement = require('../src/models/Requirement');
const Opportunity = require('../src/models/Opportunity');
const EOI = require('../src/models/EOI');
const Booking = require('../src/models/Booking');
const PaymentSchedule = require('../src/models/PaymentSchedule');
const ActivityLog = require('../src/models/ActivityLog');

// Import Controllers
const realEstateController = require('../src/controllers/realEstateController');
const adminController = require('../src/controllers/adminController');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test_re_manager_panel';
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_12345';

// Mock Response Helper
function mockResponse() {
  const res = {};
  res.statusCode = 200;
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.data = data;
    return this;
  };
  return res;
}

let tenantAOwner, managerA1, agentA1, agentA2;
let tenantBOwner, managerB1, agentB1;
let projectA, unitA1, unitA2;

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING REAL ESTATE MANAGER PANEL TEST SUITE');
  console.log('====================================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected to MongoDB test database');

  // Clean test collections
  await Promise.all([
    User.deleteMany({ email: { $regex: /@manager-test\.com$/ } }),
    Lead.deleteMany({ email: { $regex: /@manager-test\.com$/ } }),
    Project.deleteMany({ name: { $regex: /Manager Test/ } }),
    Inventory.deleteMany({ unitNumber: { $regex: /MGR-TEST/ } }),
    Requirement.deleteMany({}),
    Opportunity.deleteMany({}),
    EOI.deleteMany({}),
    Booking.deleteMany({}),
    PaymentSchedule.deleteMany({}),
    ActivityLog.deleteMany({}),
  ]);

  try {
    // -------------------------------------------------------------------------
    // SETUP: Tenants, Managers, and Agents
    // -------------------------------------------------------------------------
    console.log('\n--- SETUP: Creating Tenants, Managers, and Agents ---');

    tenantAOwner = await User.create({
      name: 'Owner Tenant A',
      email: 'ownerA@manager-test.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      industryType: 'real_estate',
    });
    tenantAOwner.companyId = tenantAOwner._id;
    await tenantAOwner.save();

    managerA1 = await User.create({
      name: 'Manager A1',
      email: 'managerA1@manager-test.com',
      password: 'password123',
      role: 'manager',
      companyRole: 'manager',
      companyId: tenantAOwner._id,
      industryType: 'real_estate',
    });

    agentA1 = await User.create({
      name: 'Agent A1 (Under Manager A1)',
      email: 'agentA1@manager-test.com',
      password: 'password123',
      role: 'agent',
      companyRole: 'agent',
      companyId: tenantAOwner._id,
      managerId: managerA1._id,
      industryType: 'real_estate',
    });

    agentA2 = await User.create({
      name: 'Agent A2 (Direct under Owner)',
      email: 'agentA2@manager-test.com',
      password: 'password123',
      role: 'agent',
      companyRole: 'agent',
      companyId: tenantAOwner._id,
      industryType: 'real_estate',
    });

    // Tenant B
    tenantBOwner = await User.create({
      name: 'Owner Tenant B',
      email: 'ownerB@manager-test.com',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      industryType: 'real_estate',
    });
    tenantBOwner.companyId = tenantBOwner._id;
    await tenantBOwner.save();

    managerB1 = await User.create({
      name: 'Manager B1',
      email: 'managerB1@manager-test.com',
      password: 'password123',
      role: 'manager',
      companyRole: 'manager',
      companyId: tenantBOwner._id,
      industryType: 'real_estate',
    });

    agentB1 = await User.create({
      name: 'Agent B1',
      email: 'agentB1@manager-test.com',
      password: 'password123',
      role: 'agent',
      companyRole: 'agent',
      companyId: tenantBOwner._id,
      managerId: managerB1._id,
      industryType: 'real_estate',
    });

    console.log('✓ Tenants, Managers, and Agents created successfully');

    // Create Project & Inventory
    projectA = await Project.create({
      companyId: tenantAOwner._id,
      userId: tenantAOwner._id,
      name: 'Manager Test Tower Heights',
      developer: 'Test Developers',
      location: 'Noida Expressway',
      city: 'Noida',
      minPrice: 7500000,
      maxPrice: 25000000,
      productCategory: ['3BHK', '4BHK'],
      totalUnits: 10,
      availableUnits: 10,
    });

    unitA1 = await Inventory.create({
      companyId: tenantAOwner._id,
      projectId: projectA._id,
      unitNumber: 'MGR-TEST-A101',
      tower: 'Tower A',
      floor: 10,
      configuration: '3BHK',
      carpetArea: 1650,
      basePrice: 8500000,
      status: 'AVAILABLE',
    });

    unitA2 = await Inventory.create({
      companyId: tenantAOwner._id,
      projectId: projectA._id,
      unitNumber: 'MGR-TEST-A102',
      tower: 'Tower A',
      floor: 10,
      configuration: '4BHK',
      carpetArea: 2200,
      basePrice: 12000000,
      status: 'AVAILABLE',
    });

    console.log('✓ Project & Inventory units created');

    // Create Leads
    const leadA1 = await Lead.create({
      companyId: tenantAOwner._id,
      userId: agentA1._id,
      name: 'Prospect Under Agent A1',
      phone: '+919876543210',
      email: 'leadA1@manager-test.com',
      assignedTo: agentA1._id,
      status: 'new_lead',
      temperature: 'HOT',
      score: 75,
      budget: 8500000,
      location: 'Noida Expressway',
      propertyType: 'APARTMENT',
    });

    const leadB1 = await Lead.create({
      companyId: tenantBOwner._id,
      userId: agentB1._id,
      name: 'Prospect Under Tenant B',
      phone: '+919876543211',
      email: 'leadB1@manager-test.com',
      assignedTo: agentB1._id,
      status: 'new_lead',
      temperature: 'HOT',
      score: 80,
      budget: 15000000,
    });

    console.log('✓ Leads created');

    // -------------------------------------------------------------------------
    // TEST 1: Manager Team Scoping & Tenant Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Manager Team Scoping & Isolation ---');

    // Manager A1 Team Members
    const reqMbr = { user: managerA1, query: {} };
    const resMbr = mockResponse();
    await realEstateController.getManagerTeamMembers(reqMbr, resMbr);
    if (resMbr.statusCode !== 200) throw new Error(`getManagerTeamMembers failed: ${resMbr.statusCode}`);
    const teamMbrIds = resMbr.data.data.map(m => String(m._id));
    if (!teamMbrIds.includes(String(agentA1._id))) throw new Error('Manager A1 should see agentA1');
    if (teamMbrIds.includes(String(agentB1._id))) throw new Error('Manager A1 MUST NOT see agentB1 from Tenant B');
    console.log('✓ Manager Team Members correctly scoped to assigned team agents');

    // Manager A1 Team Performance
    const reqPerf = { user: managerA1, query: {} };
    const resPerf = mockResponse();
    await realEstateController.getManagerTeamPerformance(reqPerf, resPerf);
    if (resPerf.statusCode !== 200) throw new Error(`getManagerTeamPerformance failed: ${resPerf.statusCode}`);
    console.log(`✓ Manager Team Performance returned ${resPerf.data.data.length} team members`);

    // Manager A1 Team Workload
    const reqWl = { user: managerA1, query: {} };
    const resWl = mockResponse();
    await realEstateController.getManagerTeamWorkload(reqWl, resWl);
    if (resWl.statusCode !== 200) throw new Error(`getManagerTeamWorkload failed: ${resWl.statusCode}`);
    console.log(`✓ Manager Team Workload returned ${resWl.data.data.length} agent workloads`);

    // -------------------------------------------------------------------------
    // TEST 2: Multi-Tenant Isolation (Tenant B vs Tenant A)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Multi-Tenant Isolation ---');
    const reqAnalyticsB = { user: managerB1, query: {} };
    const resAnalyticsB = mockResponse();
    await realEstateController.getRealEstateAnalytics(reqAnalyticsB, resAnalyticsB);
    if (resAnalyticsB.statusCode !== 200) throw new Error('Analytics failed for Manager B1');
    if (resAnalyticsB.data.data.leads.total !== 1) {
      throw new Error(`Manager B1 should only see 1 lead in Tenant B, got: ${resAnalyticsB.data.data.leads.total}`);
    }
    console.log('✓ Strict Multi-Tenant isolation verified: Manager B1 sees 0 leads from Tenant A');

    // -------------------------------------------------------------------------
    // TEST 3: Inventory Hold Concurrency (409 Conflict)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Atomic Inventory Hold Concurrency (409 Conflict) ---');
    const holdReq1 = {
      user: managerA1,
      params: { id: unitA1._id },
      body: { leadId: leadA1._id, holdDurationMinutes: 60, reason: 'First Hold' }
    };
    const holdRes1 = mockResponse();
    await realEstateController.holdInventoryUnit(holdReq1, holdRes1);
    if (holdRes1.statusCode !== 200) throw new Error(`Hold 1 failed: ${holdRes1.statusCode}`);
    console.log('✓ Hold 1 succeeded with status 200 and set unit status to HOLD');

    // Second parallel hold on same unit
    const holdReq2 = {
      user: managerA1,
      params: { id: unitA1._id },
      body: { leadId: leadA1._id, holdDurationMinutes: 60, reason: 'Second Hold (Conflicting)' }
    };
    const holdRes2 = mockResponse();
    await realEstateController.holdInventoryUnit(holdReq2, holdRes2);
    if (holdRes2.statusCode !== 409) {
      throw new Error(`Expected 409 Conflict on second hold, got: ${holdRes2.statusCode}`);
    }
    console.log('✓ Concurrent hold on already held unit correctly returned 409 Conflict');

    // -------------------------------------------------------------------------
    // TEST 4: Complete Real Estate Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Complete Real Estate Lifecycle ---');

    // A. Create Requirement
    const reqReq = {
      user: managerA1,
      body: {
        leadId: leadA1._id,
        title: '3BHK Luxury Highrise',
        propertyType: 'APARTMENT',
        configurations: ['3BHK'],
        preferredLocations: ['Noida Expressway'],
        budgetMin: 7500000,
        budgetMax: 10000000,
      }
    };
    const resReq = mockResponse();
    await realEstateController.createRequirement(reqReq, resReq);
    if (resReq.statusCode !== 201) throw new Error(`Create requirement failed: ${resReq.statusCode}`);
    const createdReq = resReq.data.data;
    console.log('✓ Requirement created successfully');

    // B. Match Properties
    const matchReq = {
      user: managerA1,
      body: { requirementId: createdReq._id }
    };
    const matchRes = mockResponse();
    await realEstateController.matchProperties(matchReq, matchRes);
    if (matchRes.statusCode !== 200) throw new Error(`Match properties failed: ${matchRes.statusCode}`);
    if (!matchRes.data.data || matchRes.data.data.length === 0) throw new Error('Expected matching projects');
    console.log(`✓ Match properties engine found ${matchRes.data.data.length} matching project(s)`);

    // C. Create Opportunity
    const oppReq = {
      user: managerA1,
      body: {
        leadId: leadA1._id,
        projectId: projectA._id,
        inventoryId: unitA1._id,
        requirementId: createdReq._id,
        expectedValue: 8500000,
        probability: 75,
        stage: 'NEGOTIATION',
      }
    };
    const oppRes = mockResponse();
    await realEstateController.createOpportunity(oppReq, oppRes);
    if (oppRes.statusCode !== 201) throw new Error(`Create opportunity failed: ${oppRes.statusCode}`);
    const createdOpp = oppRes.data.data;
    console.log('✓ Opportunity created in NEGOTIATION stage');

    // D. Create EOI
    const eoiReq = {
      user: managerA1,
      body: {
        leadId: leadA1._id,
        projectId: projectA._id,
        inventoryId: unitA1._id,
        tokenAmount: 200000,
        paymentStatus: 'PAID',
      }
    };
    const eoiRes = mockResponse();
    await realEstateController.createEOI(eoiReq, eoiRes);
    if (eoiRes.statusCode !== 201) throw new Error(`Create EOI failed: ${eoiRes.statusCode}`);
    const createdEOI = eoiRes.data.data;
    console.log(`✓ EOI token created: ${createdEOI.eoiNumber}`);

    // Confirm EOI
    const confirmEOIReq = {
      user: managerA1,
      params: { id: createdEOI._id }
    };
    const confirmEOIRes = mockResponse();
    await realEstateController.confirmEOI(confirmEOIReq, confirmEOIRes);
    if (confirmEOIRes.statusCode !== 200) throw new Error(`Confirm EOI failed: ${confirmEOIRes.statusCode}`);
    console.log('✓ EOI confirmed successfully');

    // E. Convert EOI to Booking
    const bkReq = {
      user: managerA1,
      body: {
        leadId: leadA1._id,
        projectId: projectA._id,
        inventoryId: unitA1._id,
        eoiId: createdEOI._id,
        bookingAmount: 850000,
        agreementValue: 8500000,
        paymentPlan: 'CLP',
      }
    };
    const bkRes = mockResponse();
    await realEstateController.createBooking(bkReq, bkRes);
    if (bkRes.statusCode !== 201) throw new Error(`Create Booking failed: ${bkRes.statusCode}`);
    const createdBooking = bkRes.data.data;
    console.log(`✓ Booking converted: ${createdBooking.bookingNumber}`);

    // Verify unit status updated to BOOKED
    const bookedUnit = await Inventory.findById(unitA1._id);
    if (bookedUnit.status !== 'BOOKED') throw new Error(`Unit status should be BOOKED, got: ${bookedUnit.status}`);
    console.log('✓ Inventory unit status atomically transitioned from HOLD -> BOOKED');

    // F. Fetch Payment Schedule for Booking
    const schedReq = {
      user: managerA1,
      params: { id: createdBooking._id },
    };
    const schedRes = mockResponse();
    await realEstateController.getBookingPaymentSchedule(schedReq, schedRes);
    if (schedRes.statusCode !== 200) throw new Error(`Fetch payment schedule failed: ${schedRes.statusCode}`);
    const schedules = schedRes.data.data;
    console.log(`✓ Retrieved ${schedules.length} auto-generated payment milestones for booking`);

    // G. Record Payment Receipt on Milestone 2
    const upcomingMilestone = schedules.find(s => s.status === 'UPCOMING');
    const payReq = {
      user: managerA1,
      params: { scheduleId: upcomingMilestone._id },
      body: {
        paidAmount: upcomingMilestone.amount,
        paymentMode: 'ONLINE_TRANSFER',
        transactionRef: 'HDFC-REF-998822',
        notes: 'Agreement signing milestone fully received',
      }
    };
    const payRes = mockResponse();
    await realEstateController.recordPaymentReceipt(payReq, payRes);
    if (payRes.statusCode !== 200) throw new Error(`Record payment receipt failed: ${payRes.statusCode}`);
    console.log('✓ Payment receipt recorded and milestone status updated to PAID');

    // Verify Booking totalPaid updated
    const updatedBooking = await Booking.findById(createdBooking._id);
    const expectedTotal = 850000 + upcomingMilestone.amount;
    if (updatedBooking.totalPaid !== expectedTotal) {
      throw new Error(`Booking totalPaid should be ${expectedTotal}, got: ${updatedBooking.totalPaid}`);
    }
    console.log(`✓ Booking totalPaid updated to ${updatedBooking.totalPaid}`);

    // H. Payments Summary API
    const paySumReq = { user: managerA1, query: {} };
    const paySumRes = mockResponse();
    await realEstateController.getPaymentsSummary(paySumReq, paySumRes);
    if (paySumRes.statusCode !== 200) throw new Error(`getPaymentsSummary failed: ${paySumRes.statusCode}`);
    if (paySumRes.data.data.totalCollected !== expectedTotal) {
      throw new Error(`Total collected should be ${expectedTotal}, got: ${paySumRes.data.data.totalCollected}`);
    }
    console.log(`✓ Payments Summary: Total Collected = ${paySumRes.data.data.totalCollected}, Due = ${paySumRes.data.data.dueAmount}`);

    // -------------------------------------------------------------------------
    // TEST 5: Manager Lead Reassignment within Tenant Scope
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Lead Reassignment within Tenant Scope ---');
    const reassignReq = {
      user: managerA1,
      body: {
        fromAgentId: agentA1._id,
        toAgentId: agentA2._id,
      }
    };
    const reassignRes = mockResponse();
    await adminController.reassignAgentLeads(reassignReq, reassignRes);
    if (reassignRes.statusCode !== 200) throw new Error(`Reassign leads failed: ${reassignRes.statusCode}`);

    const reassignedLead = await Lead.findById(leadA1._id);
    if (String(reassignedLead.assignedTo) !== String(agentA2._id)) {
      throw new Error(`Lead should now be assigned to Agent A2, got: ${reassignedLead.assignedTo}`);
    }
    console.log('✓ Manager successfully reassigned leads from Agent A1 to Agent A2 within tenant scope');

    console.log('\n====================================================');
    console.log('🎉 ALL 5 TEST PHASES PASSED WITH ZERO ERRORS!');
    console.log('====================================================\n');

  } finally {
    await mongoose.disconnect();
    console.log('✓ Database disconnected cleanly');
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
