const mongoose = require('mongoose');
const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const TenantConfig = require('../src/models/TenantConfig');
const Notification = require('../src/models/Notification');
const {
  assignEdTechRoundRobin,
  processAbandonedCartLead,
  attachCountryDocumentChecklist,
  runTestPrepFeeAlertsCron,
  createHigherEdVerificationTask,
} = require('../src/services/automationHandlers');
const { emitCRMEvent, CRM_EVENTS } = require('../src/services/automationEvents');

async function runEducationAutomationTests() {
  console.log('🧪 Starting Education Sub-Profile Automations & Architecture Test Suite...\n');
  await connectDB();

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error('     Error:', err.message);
      failed++;
    }
  };

  // 1. PHASE 1: Tenant Workspace Seeding Tests
  await test('Phase 1: Higher Education Workspace Seeding', async () => {
    const testUser = await User.create({
      name: 'Dr. Dean Sharma',
      email: `dean_${Date.now()}@edcrm.com`,
      phone: `9400${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
      industryType: 'Education',
      educationSubProfile: 'higher_education',
      workStatus: 'company_owner',
      companyRole: 'owner',
    });

    const config = await TenantConfig.seedWorkspace(testUser._id, 'Education', 'higher_education', testUser.companyId);
    assert(config, 'TenantConfig should be created');
    assert.strictEqual(config.educationSubProfile, 'higher_education');
    assert.deepStrictEqual(config.pipelineStages, [
      'Lead Captured',
      'Counselling Scheduled',
      'Documents Uploaded',
      'Merit List',
      'Admission Fee Paid',
    ]);
    assert(config.customFields.some(f => f.fieldId === 'courseApplied'), 'Should include courseApplied field');
    assert(config.customFields.some(f => f.fieldId === 'academicPercentage'), 'Should include academicPercentage field');
    assert(config.customFields.some(f => f.fieldId === 'entranceScore'), 'Should include entranceScore field');
    assert(config.customFields.some(f => f.fieldId === 'hostelRequired'), 'Should include hostelRequired field');
    assert.strictEqual(config.automationSettings.docVerificationTaskEnabled, true);
  });

  await test('Phase 1: EdTech Companies Workspace Seeding', async () => {
    const testUser = await User.create({
      name: 'EdTech Academy Pro',
      email: `edtech_${Date.now()}@edcrm.com`,
      phone: `9401${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
      industryType: 'Education',
      educationSubProfile: 'edtech',
      workStatus: 'company_owner',
    });

    const config = await TenantConfig.seedWorkspace(testUser._id, 'Education', 'edtech', testUser.companyId);
    assert.strictEqual(config.educationSubProfile, 'edtech');
    assert.deepStrictEqual(config.pipelineStages, [
      'Signup',
      'Discovery Call',
      'Webinar/Demo',
      'Trial Active',
      'Plan Purchased',
    ]);
    assert(config.customFields.some(f => f.fieldId === 'professionalStatus'), 'Should include professionalStatus');
    assert(config.customFields.some(f => f.fieldId === 'courseInterest'), 'Should include courseInterest');
    assert(config.customFields.some(f => f.fieldId === 'batchTimePreference'), 'Should include batchTimePreference');
    assert.strictEqual(config.automationSettings.roundRobinEnabled, true);
    assert.strictEqual(config.automationSettings.abandonedCartWhatsApp, true);
  });

  await test('Phase 1: Study Abroad & Overseas Workspace Seeding', async () => {
    const testUser = await User.create({
      name: 'Global Overseas Counsellors',
      email: `abroad_${Date.now()}@edcrm.com`,
      phone: `9402${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
      industryType: 'Education',
      educationSubProfile: 'study_abroad',
      workStatus: 'company_owner',
    });

    const config = await TenantConfig.seedWorkspace(testUser._id, 'Education', 'study_abroad', testUser.companyId);
    assert.strictEqual(config.educationSubProfile, 'study_abroad');
    assert.deepStrictEqual(config.pipelineStages, [
      'Inquiry',
      'Profile Evaluation',
      'University Shortlisted',
      'Offer Letter',
      'Visa Lodged',
      'Fly Down',
    ]);
    assert(config.customFields.some(f => f.fieldId === 'targetCountry'), 'Should include targetCountry');
    assert(config.customFields.some(f => f.fieldId === 'languageTestScore'), 'Should include languageTestScore');
    assert(config.customFields.some(f => f.fieldId === 'intakeSeason'), 'Should include intakeSeason');
    assert(config.customFields.some(f => f.fieldId === 'visaStatus'), 'Should include visaStatus');
    assert.strictEqual(config.automationSettings.countryChecklistAutoAttach, true);
  });

  await test('Phase 1: Test Prep & Coaching Workspace Seeding', async () => {
    const testUser = await User.create({
      name: 'Apex JEE-NEET Classes',
      email: `testprep_${Date.now()}@edcrm.com`,
      phone: `9403${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
      industryType: 'Education',
      educationSubProfile: 'test_prep',
      workStatus: 'company_owner',
    });

    const config = await TenantConfig.seedWorkspace(testUser._id, 'Education', 'test_prep', testUser.companyId);
    assert.strictEqual(config.educationSubProfile, 'test_prep');
    assert.deepStrictEqual(config.pipelineStages, [
      'Inquiry',
      'Scholarship Test',
      'Test Attempted',
      'Demo Class',
      'Admission Confirmed',
    ]);
    assert(config.customFields.some(f => f.fieldId === 'stream'), 'Should include stream');
    assert(config.customFields.some(f => f.fieldId === 'preferredBranch'), 'Should include preferredBranch');
    assert(config.customFields.some(f => f.fieldId === 'parentContact'), 'Should include parentContact');
    assert.strictEqual(config.automationSettings.feeDueAlertsEnabled, true);
  });

  await test('Phase 1: K-12 Schools Workspace Seeding', async () => {
    const testUser = await User.create({
      name: 'St. Xavier International School',
      email: `k12_${Date.now()}@edcrm.com`,
      phone: `9404${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
      industryType: 'Education',
      educationSubProfile: 'k12',
      workStatus: 'company_owner',
    });

    const config = await TenantConfig.seedWorkspace(testUser._id, 'Education', 'k12', testUser.companyId);
    assert.strictEqual(config.educationSubProfile, 'k12');
    assert.deepStrictEqual(config.pipelineStages, [
      'Inquiry',
      'Campus Tour',
      'Parent-Child Interview',
      'Documentation',
      'Seat Secured',
    ]);
    assert(config.customFields.some(f => f.fieldId === 'childName'), 'Should include childName');
    assert(config.customFields.some(f => f.fieldId === 'gradeApplied'), 'Should include gradeApplied');
    assert(config.customFields.some(f => f.fieldId === 'previousSchool'), 'Should include previousSchool');
    assert(config.customFields.some(f => f.fieldId === 'transportRequired'), 'Should include transportRequired');
  });

  // 2. PHASE 2: Industry-Specific Automation Handlers Tests
  await test('Phase 2: EdTech Round-Robin Lead Distribution', async () => {
    const owner = await User.create({
      name: 'EdTech Master Org',
      email: `edorg_${Date.now()}@edcrm.com`,
      phone: `9500${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
      workStatus: 'company_owner',
    });

    const agent1 = await User.create({
      name: 'Agent Rohit',
      email: `agent1_${Date.now()}@edcrm.com`,
      phone: `9501${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
      companyId: owner._id,
      companyRole: 'agent',
    });

    const agent2 = await User.create({
      name: 'Agent Priya',
      email: `agent2_${Date.now()}@edcrm.com`,
      phone: `9502${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
      companyId: owner._id,
      companyRole: 'agent',
    });

    await TenantConfig.seedWorkspace(owner._id, 'Education', 'edtech', owner._id);

    // Call Round-Robin multiple times and check round-robin alternation
    const assigned1 = await assignEdTechRoundRobin({ tenantUserId: owner._id, companyId: owner._id });
    const assigned2 = await assignEdTechRoundRobin({ tenantUserId: owner._id, companyId: owner._id });
    const assigned3 = await assignEdTechRoundRobin({ tenantUserId: owner._id, companyId: owner._id });
    const assigned4 = await assignEdTechRoundRobin({ tenantUserId: owner._id, companyId: owner._id });

    assert(assigned1, 'Assigned 1 should not be null');
    assert(assigned2, 'Assigned 2 should not be null');
    assert(assigned3, 'Assigned 3 should not be null');
    assert(assigned4, 'Assigned 4 should not be null');
    assert.notStrictEqual(String(assigned1), String(assigned2), 'Consecutive leads should alternate between agents');
    assert.notStrictEqual(String(assigned2), String(assigned3), 'Consecutive leads should alternate between agents');
    assert.strictEqual(String(assigned1), String(assigned4), 'Round robin should wrap around to first agent');
  });

  await test('Phase 2: Study Abroad Country Document Checklist Auto-Generation', async () => {
    const testUser = await User.create({
      name: 'Abroad Branch',
      email: `study_${Date.now()}@edcrm.com`,
      phone: `9600${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
    });

    const lead = await Lead.create({
      userId: testUser._id,
      name: 'Kunal Overseas Applicant',
      phone: `9601${Date.now().toString().slice(-6)}`,
      status: 'Inquiry',
      customData: {
        targetCountry: 'Canada',
      },
    });

    const checklist = await attachCountryDocumentChecklist({
      leadId: lead._id,
      targetCountry: 'Canada',
      tenantUserId: testUser._id,
    });

    assert(Array.isArray(checklist), 'Checklist should be an array');
    assert(checklist.length >= 6, 'Canada checklist should have at least 6 mandatory documents');
    assert(checklist.some(c => c.item.includes('GIC') || c.item.includes('Funds')), 'Should include GIC/Funds proof for Canada');

    const updatedLead = await Lead.findById(lead._id);
    assert.strictEqual(updatedLead.customData.targetCountry, 'Canada');
    assert.strictEqual(updatedLead.customData.documentChecklist.length, checklist.length);
  });

  await test('Phase 2: Higher Ed "Documents Uploaded" Verification Task Creation', async () => {
    const testUser = await User.create({
      name: 'University Registrar',
      email: `registrar_${Date.now()}@edcrm.com`,
      phone: `9700${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
    });

    const lead = await Lead.create({
      userId: testUser._id,
      name: 'Rohan Sharma',
      phone: `9701${Date.now().toString().slice(-6)}`,
      status: 'Documents Uploaded',
      customData: {
        courseApplied: 'B.Tech Computer Science',
        academicPercentage: '92.4',
      },
    });

    const notification = await createHigherEdVerificationTask({
      leadId: lead._id,
      tenantUserId: testUser._id,
      companyId: null,
    });

    assert(notification, 'Verification notification should be created');
    assert.strictEqual(notification.type, 'document_verification');
    assert(notification.message.includes('Documents Uploaded'), 'Message should reference Documents Uploaded');
  });

  await test('Phase 2: Test Prep 5-Day Fee Alert Cron Logic', async () => {
    const testUser = await User.create({
      name: 'Kota Coaching Hub',
      email: `kota_${Date.now()}@edcrm.com`,
      phone: `9800${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
    });

    const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    const lead = await Lead.create({
      userId: testUser._id,
      name: 'Aarav JEE Aspirant',
      phone: `9801${Date.now().toString().slice(-6)}`,
      status: 'Demo Class',
      payable_amount: 45000,
      customData: {
        stream: 'IIT-JEE Target 2027',
        parentContact: `9802${Date.now().toString().slice(-6)}`,
        feeDueDate: fiveDaysFromNow,
        feeAmount: 45000,
        feeReminderSent: false,
      },
    });

    await runTestPrepFeeAlertsCron();

    const updatedLead = await Lead.findById(lead._id);
    assert.strictEqual(updatedLead.customData.feeReminderSent, true, 'Lead should be marked as feeReminderSent');
  });

  // 3. PHASE 3: K-12 Parent-Child Multi-Inquiry Edge Case Test
  await test('Phase 3: K-12 Parent-Child Multi-Inquiries Under Single Parent Phone', async () => {
    const schoolAdmin = await User.create({
      name: 'Delhi Public School Admin',
      email: `dps_${Date.now()}@edcrm.com`,
      phone: `9900${Date.now().toString().slice(-6)}`,
      password: 'Password@123',
    });

    const parentPhone = `9901${Date.now().toString().slice(-6)}`;

    // Create single parent lead
    const parentLead = await Lead.create({
      userId: schoolAdmin._id,
      name: 'Vikramaditya Oberoi (Father)',
      phone: parentPhone,
      email: 'oberoi.family@gmail.com',
      status: 'Inquiry',
      children: [
        {
          childName: 'Aarav Oberoi (Elder Son)',
          age: 14,
          gradeApplied: 'Grade 9',
          previousSchool: 'Bombay Scottish School',
          transportRequired: true,
          status: 'Inquiry',
        },
        {
          childName: 'Ananya Oberoi (Younger Daughter)',
          age: 6,
          gradeApplied: 'Grade 1',
          previousSchool: 'EuroKids Preschool',
          transportRequired: true,
          status: 'Inquiry',
        },
      ],
    });

    assert.strictEqual(parentLead.children.length, 2, 'Parent lead should contain 2 child inquiries');
    assert.strictEqual(parentLead.children[0].childName, 'Aarav Oberoi (Elder Son)');
    assert.strictEqual(parentLead.children[1].childName, 'Ananya Oberoi (Younger Daughter)');
    assert.strictEqual(parentLead.dependents.length, 2, 'Virtual alias dependents should match children array');

    // Add 3rd child inquiry dynamically
    parentLead.children.push({
      childName: 'Kabir Oberoi (Toddler)',
      age: 3,
      gradeApplied: 'Nursery',
      transportRequired: false,
      status: 'Inquiry',
    });
    await parentLead.save();

    const verifiedLead = await Lead.findById(parentLead._id);
    assert.strictEqual(verifiedLead.children.length, 3, 'Should successfully hold 3 child inquiries under 1 phone');
  });

  console.log(`\n========================================================`);
  console.log(`🏁 EDUCATION AUTOMATIONS TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================================\n`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runEducationAutomationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
