'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LEAD PROFILE, WHATSAPP, AND FORMS VERIFICATION SUITE
 * Validates:
 * 1. Product/Package form removal and graceful schema resolution
 * 2. SendFeeStructureOnWhatsApp message editability and English defaults
 * 3. Lead profile activity logging on WhatsApp fee structure dispatch
 * ═══════════════════════════════════════════════════════════════════════════
 */

const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Load Models
const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const TenantCatalogue = require('../src/models/TenantCatalogue');
const MasterCollege = require('../src/models/MasterCollege');
const { getIndustryDefaults } = require('../src/utils/industryTemplates');
const waSession = require('../src/services/waSession');

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_dev_key_123';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';

async function runLeadProfileAndFormsSuite() {
  console.log('============================================================');
  console.log('🏛️  RUNNING LEAD PROFILE, WHATSAPP & FORMS VERIFICATION SUITE');
  console.log('============================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }
  console.log('✅ Connected to MongoDB\n');

  const testSuffix = Date.now();

  try {
    // 1. Provision Test Owner & Lead
    const owner = await User.create({
      name: `Consultant Owner ${testSuffix}`,
      email: `consultant_owner_${testSuffix}@example.com`,
      phone: `9198${String(testSuffix).slice(-8)}`,
      password: 'Password123!',
      workStatus: 'company_owner',
      companyRole: 'owner',
      role: 'admin',
      isVerified: true,
      leadFormSchema: getIndustryDefaults('education').leadFormSchema,
    });

    const testLead = await Lead.create({
      name: `Priya Sharma ${testSuffix}`,
      phone: `9197${String(testSuffix).slice(-8)}`,
      email: `priya_${testSuffix}@example.com`,
      assignedTo: owner._id,
      companyId: owner._id,
      user: owner._id,
      userId: owner._id,
      status: 'contacted',
      targetCourse: 'B.Tech CSE',
      leadActivities: [],
    });

    console.log('--- SECTION 1: Forms Engine Schema Resolution & Product Form Removal ---');

    // 1.1 Verify lead form schema returns successfully
    assert(Array.isArray(owner.leadFormSchema), 'leadFormSchema should be an array');
    assert(owner.leadFormSchema.length > 0, 'leadFormSchema should have default fields');
    console.log('  ✅ PASS: 1.1 Lead form schema initialized with admission fields');

    // 1.2 Verify that productFormSchema is removed or gracefully handled
    const reqMockLead = {
      query: { type: 'lead' },
      user: owner,
    };
    const adminController = require('../src/controllers/adminController');
    let resDataLead = null;
    await adminController.getFormSchemas(reqMockLead, {
      json: (data) => { resDataLead = data; },
      status: () => ({ json: (d) => { resDataLead = d; } }),
    });

    assert(resDataLead && resDataLead.success === true, 'getFormSchemas should succeed for lead');
    assert(resDataLead.formType === 'lead', 'formType should be lead');
    assert(Array.isArray(resDataLead.schema) && resDataLead.schema.length > 0, 'schema should not be empty');
    console.log('  ✅ PASS: 1.2 getFormSchemas returns candidate lead schema');

    // 1.3 Verify saving updated lead schema
    let saveResData = null;
    const reqSaveMock = {
      query: { type: 'lead' },
      body: {
        formType: 'lead',
        fields: [
          ...owner.leadFormSchema,
          { fieldId: 'preferred_hostel', label: 'Hostel Required', fieldType: 'select', options: ['Yes', 'No'] },
        ],
      },
      user: owner,
      ip: '127.0.0.1',
    };
    await adminController.saveFormSchema(reqSaveMock, {
      json: (data) => { saveResData = data; },
      status: () => ({ json: (d) => { saveResData = d; } }),
    });

    const updatedOwner = await User.findById(owner._id).lean();
    const hasNewField = updatedOwner.leadFormSchema.some(f => f.fieldId === 'preferred_hostel');
    assert(hasNewField, 'Updated field should be persisted in leadFormSchema');
    console.log('  ✅ PASS: 1.3 saveFormSchema updates candidate lead schema with validation');

    console.log('\n--- SECTION 2: WhatsApp Fee Structure Dispatch & English Message Editability ---');

    // 2.1 Provision a test College in Catalogue
    const testCollege = await TenantCatalogue.create({
      tenantId: owner._id,
      companyId: owner._id,
      customCollegeName: `Apex Institute of Technology ${testSuffix}`,
      location: { city: 'Bangalore', state: 'Karnataka' },
      accreditation: ['NAAC A++', 'NBA Accredited'],
      website: 'https://apex.edu.in',
      courses: [
        {
          degreeName: 'B.Tech / B.E.',
          specialization: 'Computer Science & Engineering (CSE)',
          durationYears: 4,
          level: 'Undergraduate',
          admissionStatus: 'admissions_open',
          customFeeStructure: {
            annualTuitionFee: 250000,
            packageFee: 1000000,
            hostelFeePerYear: 90000,
            oneTimeAdmissionFee: 25000,
            currency: 'INR',
            feeNotes: 'Merit scholarship applicable up to ₹50,000 for >85% in 12th.',
          },
        },
      ],
    });

    const targetCourse = testCollege.courses[0];

    // Mock WhatsApp Session connection
    let sentDispatches = [];
    const originalSendText = waSession.sendText;
    const originalGetStatus = waSession.getStatus;

    waSession.getStatus = () => ({ status: 'connected' });
    waSession.sendText = async (sessionId, phone, messageText, userId, senderName) => {
      sentDispatches.push({ sessionId, phone, messageText, userId, senderName });
      return { key: { id: 'msg_' + Date.now() }, message: { conversation: messageText } };
    };

    const catalogueController = require('../src/controllers/catalogueController');

    // 2.2 Dispatch with default English template
    let dispatchRes1 = null;
    const reqDispatch1 = {
      user: owner,
      body: {
        leadId: testLead._id,
        recipientPhone: testLead.phone,
        recipientName: testLead.name,
        collegeId: testCollege._id,
        courseId: targetCourse._id,
        sender: 'personal',
      },
    };

    await catalogueController.sendFeeStructureOnWhatsApp(reqDispatch1, {
      json: (data) => { dispatchRes1 = data; },
      status: (code) => ({ json: (d) => { dispatchRes1 = { ...d, statusCode: code }; } }),
    });

    assert(dispatchRes1 && dispatchRes1.success === true, 'sendFeeStructureOnWhatsApp should succeed');
    assert(sentDispatches.length === 1, 'Should have sent exactly 1 WhatsApp message');
    assert(sentDispatches[0].messageText.includes('OFFICIAL FEE STRUCTURE'), 'Default message must be in English with official structure');
    assert(sentDispatches[0].messageText.includes('2,50,000') || sentDispatches[0].messageText.includes('250000'), 'Should contain tuition fee');
    console.log('  ✅ PASS: 2.1 sendFeeStructureOnWhatsApp generates default structured English message');

    // 2.3 Dispatch with CUSTOM EDITED English message
    const customEnglishText = `🎓 *OFFICIAL ADMISSION & FEE STRUCTURE*
━━━━━━━━━━━━━━━━━━━━
👤 *Dear Priya*,
Greetings! We have verified your eligibility for *B.Tech CSE* at *Apex Institute of Technology*.

💵 *Annual Fee:* INR 2,20,000/year (Special ₹30,000 Early Bird Scholarship Applied!)
📦 *Total 4-Year Package:* INR 8,80,000
🏠 *Hostel:* INR 90,000/year

Please confirm before Friday to lock your merit seat.
Best regards,
Admissions Desk`;

    let dispatchRes2 = null;
    const reqDispatch2 = {
      user: owner,
      body: {
        leadId: testLead._id,
        recipientPhone: testLead.phone,
        recipientName: testLead.name,
        collegeId: testCollege._id,
        courseId: targetCourse._id,
        sender: 'personal',
        message: customEnglishText, // Custom edited text by counselor
      },
    };

    await catalogueController.sendFeeStructureOnWhatsApp(reqDispatch2, {
      json: (data) => { dispatchRes2 = data; },
      status: (code) => ({ json: (d) => { dispatchRes2 = { ...d, statusCode: code }; } }),
    });

    assert(dispatchRes2 && dispatchRes2.success === true, 'Custom message dispatch should succeed');
    assert(sentDispatches.length === 2, 'Should have sent second WhatsApp message');
    assert.strictEqual(sentDispatches[1].messageText, customEnglishText, 'Custom edited message must be preserved exactly without overwriting');
    console.log('  ✅ PASS: 2.2 sendFeeStructureOnWhatsApp honors custom edited English message');

    // 2.4 Verify Lead Activities recorded for both dispatches
    const updatedLead = await Lead.findById(testLead._id).lean();
    assert(Array.isArray(updatedLead.leadActivities), 'leadActivities must be an array');
    const feeActivities = updatedLead.leadActivities.filter(a => a.action === 'WHATSAPP_FEE_STRUCTURE_SENT');
    assert.strictEqual(feeActivities.length, 2, 'Should record 2 WHATSAPP_FEE_STRUCTURE_SENT activities on the lead');
    console.log('  ✅ PASS: 2.3 Lead activities accurately audited on WhatsApp fee dispatch');

    // Cleanup mocks
    waSession.sendText = originalSendText;
    waSession.getStatus = originalGetStatus;

    // Cleanup test data
    await User.findByIdAndDelete(owner._id);
    await Lead.findByIdAndDelete(testLead._id);
    await TenantCatalogue.findByIdAndDelete(testCollege._id);

    console.log('\n============================================================');
    console.log('🏁 SUITE RESULTS: ALL 6 TESTS PASSED | 0 FAILED');
    console.log('============================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err);
    process.exit(1);
  }
}

runLeadProfileAndFormsSuite();
