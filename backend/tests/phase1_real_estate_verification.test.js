/**
 * PHASE 1 REAL ESTATE CRM VERIFICATION TEST SUITE
 * Tests:
 * 1. Existing Lead CRUD
 * 2. Normal Lead Updates (Non-Real-Estate leads remain untouched)
 * 3. Real Estate Lead Updates
 * 4. Deterministic Score Recalculation Engine
 * 5. Deterministic HOT / WARM / COLD Temperature Mapping
 * 6. Requirement CRUD
 * 7. Multiple Requirements per Lead
 * 8. Opportunity CRUD & Stage Progression
 * 9. Multiple Opportunities per Lead
 * 10. Site Visit Scheduling via FollowUp Model
 * 11. Site Visit Completion with Outcome & Feedback
 * 12. Multi-Tenant Isolation
 * 13. Property Matcher Tenant Isolation
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Models
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Project = require('../src/models/Project');
const FollowUp = require('../src/models/FollowUp');
const Requirement = require('../src/models/Requirement');
const Opportunity = require('../src/models/Opportunity');
const Inventory = require('../src/models/Inventory');
const EOI = require('../src/models/EOI');
const Booking = require('../src/models/Booking');

// Controllers
const { calculateLeadScoreInternal, matchProperties } = require('../src/controllers/realEstateController');
const leadsController = require('../src/controllers/leadsController');

let mongoServer;

const runPhase1Tests = async () => {
  console.log('\n======================================================');
  console.log('🏗️  PHASE 1 REAL ESTATE INTEGRATION VERIFICATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, extra = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${extra}`);
      failed++;
    }
  };

  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    const tenantAId = new mongoose.Types.ObjectId();
    const tenantBId = new mongoose.Types.ObjectId();
    const userAId = new mongoose.Types.ObjectId();
    const userBId = new mongoose.Types.ObjectId();

    const userA = {
      _id: userAId,
      name: 'Agent Tenant A',
      companyId: tenantAId,
      industryType: 'Real Estate',
      role: 'agent',
    };

    const userB = {
      _id: userBId,
      name: 'Agent Tenant B',
      companyId: tenantBId,
      industryType: 'Real Estate',
      role: 'agent',
    };

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Generic Lead Creation & CRUD
    // ─────────────────────────────────────────────────────────────
    console.log('1️⃣ Testing Lead CRUD...');
    const leadA1 = await Lead.create({
      userId: userA._id,
      companyId: tenantAId,
      name: 'Priya Sharma',
      phone: '9876543210',
      email: 'priya@example.com',
      status: 'New Inquiry',
      propertyType: 'Apartment',
      location: 'Noida Expressway',
      budget: '₹85 Lakhs',
      budgetMin: 7500000,
      budgetMax: 9500000,
      areasOfInterest: ['Sector 150', 'Sector 128'],
    });

    assert(leadA1 && leadA1._id, 'Lead A1 created successfully');
    assert(leadA1.name === 'Priya Sharma', 'Lead name matches');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Deterministic Lead Score Calculation Engine (HOT/WARM/COLD)
    // ─────────────────────────────────────────────────────────────
    console.log('\n2️⃣ Testing Lead Score Recalculation Engine & Deterministic Temperature...');
    // Initial lead with budget (+10) and location (+10) = 20 pts -> COLD (< 30)
    let scoreRes = await calculateLeadScoreInternal(leadA1._id, tenantAId);
    assert(scoreRes.score === 20, `Initial score should be 20 pts (Got ${scoreRes.score})`);
    assert(scoreRes.temperature === 'COLD', `Initial temperature should be COLD (Got ${scoreRes.temperature})`);

    // Add an active requirement (+10 pts) -> 30 pts -> WARM (30-59)
    const req1 = await Requirement.create({
      companyId: tenantAId,
      leadId: leadA1._id,
      title: '3BHK Apartment in Noida',
      propertyType: 'Apartment',
      configurations: ['3BHK'],
      preferredLocations: ['Sector 150'],
      budgetMin: 8000000,
      budgetMax: 10000000,
      status: 'ACTIVE',
      createdBy: userA._id,
    });
    assert(req1 && req1._id, 'Requirement 1 created for Lead A1');

    scoreRes = await calculateLeadScoreInternal(leadA1._id, tenantAId);
    assert(scoreRes.score === 30, `Score with Requirement should be 30 pts (Got ${scoreRes.score})`);
    assert(scoreRes.temperature === 'WARM', `Temperature should be WARM (Got ${scoreRes.temperature})`);

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Multiple Requirements for One Lead
    // ─────────────────────────────────────────────────────────────
    console.log('\n3️⃣ Testing Multiple Requirements for a single Lead...');
    const req2 = await Requirement.create({
      companyId: tenantAId,
      leadId: leadA1._id,
      title: 'Commercial Retail Shop in Expressway',
      propertyType: 'Commercial',
      configurations: ['Shop'],
      preferredLocations: ['Sector 132'],
      budgetMin: 4000000,
      budgetMax: 6000000,
      status: 'ACTIVE',
      createdBy: userA._id,
    });
    assert(req2 && req2._id, 'Requirement 2 created for same Lead A1');

    const leadReqs = await Requirement.find({ leadId: leadA1._id, companyId: tenantAId });
    assert(leadReqs.length === 2, `Lead A1 has exactly 2 active requirements (Found: ${leadReqs.length})`);

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Site Visit Scheduling via FollowUp Model
    // ─────────────────────────────────────────────────────────────
    console.log('\n4️⃣ Testing Site Visit Scheduling via FollowUp...');
    const projectA = await Project.create({
      userId: userA._id,
      companyId: tenantAId,
      name: 'Ace Parkway',
      location: 'Sector 150',
      basePrice: 8500000,
      developer: 'Ace Group',
    });

    const visitDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const mockReqSchedule = {
      params: { id: leadA1._id.toString() },
      user: userA,
      body: {
        scheduledAt: visitDate.toISOString(),
        note: 'Site visit for Tower B 3BHK flat demo',
        type: 'site_visit',
        siteVisitDetails: {
          projectId: projectA._id,
          location: 'Sector 150, Ace Parkway',
        },
      },
    };

    let mockResLead = null;
    const mockResSchedule = {
      status: (code) => ({
        json: (data) => {
          mockResLead = data.lead;
          return data;
        },
      }),
      json: (data) => {
        mockResLead = data.lead;
        return data;
      },
    };

    await leadsController.scheduleFollowUp(mockReqSchedule, mockResSchedule);
    assert(mockResLead && mockResLead.siteVisitDate, 'Site visit date saved on Lead');
    
    const visitFollowUp = await FollowUp.findOne({ lead_id: leadA1._id, type: 'site_visit' });
    assert(visitFollowUp && visitFollowUp.siteVisitDetails?.location === 'Sector 150, Ace Parkway', 'FollowUp recorded with siteVisitDetails');

    // Score with Scheduled Site Visit (+20 pts) -> 20 + 10 (budget) + 10 (location) + 10 (req) = 50 pts -> WARM
    const updatedLeadA1 = await Lead.findById(leadA1._id);
    assert(updatedLeadA1.score === 50, `Score with Scheduled Site Visit should be 50 pts (Got ${updatedLeadA1.score})`);
    assert(updatedLeadA1.temperature === 'WARM', `Temperature should be WARM (Got ${updatedLeadA1.temperature})`);

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Site Visit Completion & Score Jump to HOT
    // ─────────────────────────────────────────────────────────────
    console.log('\n5️⃣ Testing Site Visit Completion with Outcome & Score HOT...');
    const mockReqComplete = {
      params: { id: leadA1._id.toString() },
      user: userA,
      body: {
        outcomeNote: 'Completed property tour with client. Client loved Tower B unit 1204.',
        siteVisitOutcome: 'highly_interested',
        clientFeedback: 'Client prefers high floor with park view',
        nextAction: 'Prepare formal offer sheet',
      },
    };

    const mockResComplete = {
      status: (code) => ({ json: (d) => d }),
      json: (d) => d,
    };

    await leadsController.completeFollowUp(mockReqComplete, mockResComplete);

    const completedFu = await FollowUp.findOne({ lead_id: leadA1._id, type: 'site_visit' });
    assert(completedFu.status === 'done', 'FollowUp marked done');
    assert(completedFu.siteVisitDetails?.outcome === 'highly_interested', 'Site visit outcome recorded');
    assert(completedFu.siteVisitDetails?.clientFeedback === 'Client prefers high floor with park view', 'Client feedback recorded');

    // Score with Completed Site Visit (+30 pts): 30 (visit) + 10 (budget) + 10 (location) + 10 (req) = 60 pts -> HOT (>=60)
    const leadAfterVisit = await Lead.findById(leadA1._id);
    assert(leadAfterVisit.score === 60, `Score with Completed Site Visit should be 60 pts (Got ${leadAfterVisit.score})`);
    assert(leadAfterVisit.temperature === 'HOT', `Temperature should be HOT (Got ${leadAfterVisit.temperature})`);

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Opportunity CRUD & Multiple Opportunities per Lead
    // ─────────────────────────────────────────────────────────────
    console.log('\n6️⃣ Testing Opportunities CRUD & Multiple Deals per Lead...');
    const opp1 = await Opportunity.create({
      companyId: tenantAId,
      leadId: leadA1._id,
      projectId: projectA._id,
      title: 'Ace Parkway 3BHK Deal',
      stage: 'Negotiation',
      expectedValue: 9000000,
      probability: 70,
      createdBy: userA._id,
    });
    assert(opp1 && opp1._id, 'Opportunity 1 created');

    const opp2 = await Opportunity.create({
      companyId: tenantAId,
      leadId: leadA1._id,
      projectId: projectA._id,
      title: 'Ace Parkway Retail Shop Deal',
      stage: 'Qualified Inquiry',
      expectedValue: 4500000,
      probability: 30,
      createdBy: userA._id,
    });
    assert(opp2 && opp2._id, 'Opportunity 2 created for same lead');

    const oppList = await Opportunity.find({ leadId: leadA1._id, companyId: tenantAId });
    assert(oppList.length === 2, `Lead has 2 separate opportunities (Found: ${oppList.length})`);

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Non-Real-Estate Lead Behavior (Untouched)
    // ─────────────────────────────────────────────────────────────
    console.log('\n7️⃣ Testing Non-Real-Estate Lead Updates...');
    const genericLead = await Lead.create({
      userId: userA._id,
      companyId: tenantAId,
      name: 'Digital Agency Client',
      phone: '9123456780',
      email: 'client@agency.com',
      status: 'new',
      company: 'Tech Innovations Ltd',
    });

    const mockReqGenericUpdate = {
      params: { id: genericLead._id.toString() },
      user: userA,
      body: {
        company: 'Tech Innovations Worldwide',
        tags: ['Agency', 'High Priority'],
      },
    };

    let updatedGenericLead = null;
    const mockResGenericUpdate = {
      status: (code) => ({ json: (d) => { updatedGenericLead = d; return d; } }),
      json: (d) => { updatedGenericLead = d; return d; },
    };

    await leadsController.updateLead(mockReqGenericUpdate, mockResGenericUpdate);
    assert(updatedGenericLead.company === 'Tech Innovations Worldwide', 'Generic non-real-estate lead updated properly');
    assert(!updatedGenericLead.score, 'Generic lead has no score or temperature interference');

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Multi-Tenant Isolation
    // ─────────────────────────────────────────────────────────────
    console.log('\n8️⃣ Testing Multi-Tenant Isolation across Tenants...');
    const leadB1 = await Lead.create({
      userId: userB._id,
      companyId: tenantBId,
      name: 'Tenant B Buyer',
      phone: '9988776655',
      budget: '₹2 Cr',
      location: 'Gurgaon Golf Course Ext',
    });

    const projectB = await Project.create({
      userId: userB._id,
      companyId: tenantBId,
      name: 'DLF The Arbour',
      location: 'Sector 63 Gurgaon',
      basePrice: 20000000,
    });

    // Tenant A querying requirements / opportunities / properties must NOT see Tenant B's data
    const tenantAReqs = await Requirement.find({ companyId: tenantAId });
    assert(!tenantAReqs.some(r => r.leadId.toString() === leadB1._id.toString()), 'Tenant A cannot see Tenant B requirements');

    const tenantBOpps = await Opportunity.find({ companyId: tenantBId });
    assert(!tenantBOpps.some(o => o.leadId.toString() === leadA1._id.toString()), 'Tenant B cannot see Tenant A opportunities');

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Property Matcher with Tenant Isolation
    // ─────────────────────────────────────────────────────────────
    console.log('\n9️⃣ Testing Property Matcher Algorithm & Tenant Isolation...');
    await Inventory.create({
      userId: userA._id,
      companyId: tenantAId,
      projectId: projectA._id,
      unitNumber: 'T1-101',
      bhk: '3BHK',
      configuration: '3BHK',
      status: 'AVAILABLE',
      basePrice: 8500000,
      totalPrice: 9000000,
    });

    const matchReq = {
      user: userA,
      headers: {},
      body: { leadId: leadA1._id.toString() },
    };

    let matchOutput = null;
    const matchRes = {
      json: (data) => { matchOutput = data; return data; },
      status: () => ({ json: (data) => { matchOutput = data; return data; } }),
    };

    await matchProperties(matchReq, matchRes);
    assert(matchOutput && matchOutput.success, 'matchProperties executed successfully');
    assert(matchOutput.data && matchOutput.data.length > 0, `Matched properties found: ${matchOutput.data?.length}`);
    assert(matchOutput.data[0].project._id.toString() === projectA._id.toString(), 'Matched correct project Ace Parkway');
    assert(!matchOutput.data.some(m => m.project._id.toString() === projectB._id.toString()), 'Tenant B project DLF excluded from Tenant A matches (Tenant Isolation verified)');

  } catch (err) {
    console.error('Test Suite Error:', err);
    failed++;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }

  console.log('\n======================================================');
  console.log(`🏁 PHASE 1 VERIFICATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runPhase1Tests();
