const mongoose = require('mongoose');
const assert = require('assert');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const { createLead, updateLead } = require('../src/controllers/leadsController');

async function runNoAssumedDataTest() {
  console.log('=== Starting Test: Verification of Comprehensive Student Fields & No Assumed Data ===');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  await mongoose.connect(mongoUri);

  const testEmail = `no-assumed-${Date.now()}@test.com`;
  const randomPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;

  let user = await User.create({
    name: 'Test Counselor',
    email: testEmail,
    phone: randomPhone,
    password: 'password123',
    role: 'admin',
    workStatus: 'company_owner',
    companyRole: 'owner'
  });

  let leadId = null;

  try {
    // TEST 1: Creating a Lead with NO quotaPreference must NOT default to "Merit Quota"
    console.log('\n▶ Test 1: Creating Lead without quotaPreference must NOT default to Merit Quota');
    const leadPhone = `91234${Math.floor(10000 + Math.random() * 90000)}`;
    const mockCreateReq = {
      user: user,
      body: {
        name: 'Unassumed Candidate',
        phone: leadPhone,
        targetDomain: 'Engineering (B.Tech/BE)',
        followUpDate: new Date(Date.now() + 86400000).toISOString()
      }
    };

    let createStatusCode = 201;
    let createdLeadData = null;
    const mockCreateRes = {
      status(code) { createStatusCode = code; return this; },
      json(data) { createdLeadData = data; return this; }
    };

    await createLead(mockCreateReq, mockCreateRes);
    if (createStatusCode !== 201) {
      console.error('Create failed with data:', createdLeadData);
    }
    assert.strictEqual(createStatusCode, 201, 'Lead creation should return 201');
    leadId = createdLeadData._id || createdLeadData.lead?._id;
    assert.ok(leadId, 'Lead ID must be present in response');

    const freshlyCreatedLead = await Lead.findById(leadId).lean();
    console.log('Stored quotaPreference:', JSON.stringify(freshlyCreatedLead.quotaPreference));
    assert.strictEqual(
      freshlyCreatedLead.quotaPreference || '',
      '',
      'CRITICAL: quotaPreference must NOT be defaulted to Merit Quota!'
    );
    console.log('✅ PASS: No assumed quotaPreference applied to new lead.');

    // TEST 2: Update with comprehensive student profile fields
    console.log('\n▶ Test 2: Updating with full suite of student fields (Academics, Entrance, Family, Address)');
    const mockUpdateReq = {
      user: user,
      params: { id: leadId.toString() },
      body: {
        // Personal & Family
        dob: '2005-04-12',
        gender: 'Male',
        category: 'General',
        alternatePhone: '9876543211',
        fatherName: 'Rajesh Sharma',
        fatherPhone: '9876543212',
        fatherOccupation: 'Civil Engineer',
        motherName: 'Sunita Sharma',
        city: 'Pune',
        state: 'Maharashtra',
        address: 'Flat 402, Green Valley',
        pincode: '411045',
        // Academics
        tenthBoard: 'CBSE',
        tenthPercentage: 88.5,
        tenthYear: 2021,
        twelfthBoard: 'Maharashtra State Board',
        twelfthStream: 'Science (PCM)',
        twelfthPercentage: 79.4,
        twelfthGroupPercentage: 82.0,
        twelfthYear: 2023,
        gradDegree: 'B.Sc Computer Science',
        gradCollege: 'Fergusson College',
        gradPercentage: 74.2,
        gradYear: 2026,
        // Entrance
        entranceExam: 'JEE Main',
        entranceRank: '42500',
        entranceScore: '185',
        entrancePercentile: 96.2,
        entranceExamRollNo: 'JEE20249876',
        // Preferences
        degreeLevel: 'Undergraduate (UG)',
        preferredSpecialization: 'Artificial Intelligence & Data Science',
        preferredColleges: 'COEP, PICT, MIT Pune',
        targetCourse: 'B.Tech AI & DS',
        targetState: 'Maharashtra',
        budget: '₹12 - ₹18 Lakhs',
        // Pipeline Stage
        status: 'site_visit_scheduled',
        campusVisitDate: new Date('2026-11-05T10:00:00Z'),
        tokenAdvancePaid: 25000
      }
    };

    let updateStatusCode = 200;
    let updateData = null;
    const mockUpdateRes = {
      status(code) { updateStatusCode = code; return this; },
      json(data) { updateData = data; return this; }
    };

    await updateLead(mockUpdateReq, mockUpdateRes);
    assert.strictEqual(updateStatusCode, 200, 'Lead update should return 200');

    // Verify in MongoDB
    const savedLead = await Lead.findById(leadId).lean();

    // Assertions for Academics
    assert.strictEqual(savedLead.tenthBoard, 'CBSE');
    assert.strictEqual(savedLead.tenthPercentage, 88.5);
    assert.strictEqual(savedLead.academicScore10th, 88.5, 'Sync between tenthPercentage and academicScore10th verified');
    assert.strictEqual(String(savedLead.tenthYear), '2021');
    assert.strictEqual(savedLead.twelfthBoard, 'Maharashtra State Board');
    assert.strictEqual(savedLead.twelfthStream, 'Science (PCM)');
    assert.strictEqual(savedLead.twelfthPercentage, 79.4);
    assert.strictEqual(savedLead.academicScore12th, 79.4, 'Sync between twelfthPercentage and academicScore12th verified');
    assert.strictEqual(savedLead.twelfthGroupPercentage, 82.0);
    assert.strictEqual(savedLead.gradDegree, 'B.Sc Computer Science');
    assert.strictEqual(savedLead.gradCollege, 'Fergusson College');
    assert.strictEqual(savedLead.gradPercentage, 74.2);
    assert.strictEqual(savedLead.academicScoreGrad, 74.2, 'Sync between gradPercentage and academicScoreGrad verified');
    assert.strictEqual(String(savedLead.gradYear), '2026');

    // Assertions for Entrance Exams
    assert.strictEqual(savedLead.entranceExam, 'JEE Main');
    assert.strictEqual(savedLead.entranceRank, '42500');
    assert.strictEqual(savedLead.entranceScore, '185');
    assert.strictEqual(String(savedLead.entrancePercentile), '96.2');
    assert.strictEqual(savedLead.entranceExamRollNo, 'JEE20249876');

    // Assertions for Preferences & Family
    assert.strictEqual(savedLead.degreeLevel, 'Undergraduate (UG)');
    assert.strictEqual(savedLead.preferredSpecialization, 'Artificial Intelligence & Data Science');
    assert.strictEqual(savedLead.preferredColleges, 'COEP, PICT, MIT Pune');
    assert.strictEqual(savedLead.fatherName, 'Rajesh Sharma');
    assert.strictEqual(savedLead.fatherOccupation, 'Civil Engineer');
    assert.strictEqual(savedLead.motherName, 'Sunita Sharma');
    assert.strictEqual(savedLead.city, 'Pune');
    assert.strictEqual(savedLead.pincode, '411045');

    // Assertions for Pipeline & Stage
    assert.strictEqual(savedLead.status, 'site_visit_scheduled');
    assert.strictEqual(savedLead.tokenAdvancePaid, 25000);
    assert.ok(savedLead.campusVisitDate, 'Campus visit date stored');

    console.log('✅ PASS: All 25+ comprehensive student profile fields successfully updated and verified in database.');
  } finally {
    if (leadId) await Lead.deleteOne({ _id: leadId });
    await User.deleteOne({ _id: user._id });
    await mongoose.disconnect();
  }

  console.log('\n🎉 ALL NO-ASSUMED-DATA AND COMPREHENSIVE FIELD TESTS PASSED SUCCESSFULLY! ✅');
}

runNoAssumedDataTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
