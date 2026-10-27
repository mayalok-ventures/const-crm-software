const mongoose = require('mongoose');
const assert = require('assert');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const { updateLead, getLead } = require('../src/controllers/leadsController');

async function runTest() {
  console.log('--- Starting Lead Profile Comprehensive Edit QA Test ---');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  await mongoose.connect(mongoUri);

  // Setup test user
  let user = await User.findOne({ email: 'qa-tester@leadprofile.test' });
  if (!user) {
    user = await User.create({
      name: 'QA Lead Tester',
      email: 'qa-tester@leadprofile.test',
      phone: '9998887771',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      pipelineStages: ['new', 'contacted', 'site_visit_scheduled', 'closed', 'lost']
    });
  }

  // 1. Create a minimal lead (as if concise initial form was used)
  const minimalLead = await Lead.create({
    userId: user._id,
    companyId: user._id,
    name: 'Kunal Test Lead',
    phone: '8193948870',
    status: 'new',
    source: 'agent_manual',
    customData: {
      quotaPreference: 'Management / Institutional Quota',
      pipelineStage: 'site_visit_scheduled'
    }
  });

  console.log('✅ 1. Created minimal lead with ID:', minimalLead._id.toString());
  assert.strictEqual(minimalLead.name, 'Kunal Test Lead');
  assert.strictEqual(minimalLead.status, 'new');

  // 2. Mock req/res for updateLead with full suite of profile fields
  const mockReq = {
    user: user,
    params: { id: minimalLead._id.toString() },
    body: {
      name: 'Kunal Pratap Singh',
      phone: '8193948870',
      email: 'kunalpratapsingh1998@gmail.com',
      location: 'Oxford, England',
      company: 'Oxford University / DPS Pune',
      targetDomain: 'Medical (MBBS/BDS/BAMS)',
      targetStream: 'Medical (MBBS/BDS/BAMS)',
      targetCourse: 'MBBS',
      targetState: 'Pune, Maharashtra',
      quotaPreference: 'Management / Institutional Quota',
      academicScore: '55%',
      academicScore10th: 75,
      academicScore12th: 55,
      entranceExam: 'NEET',
      entranceRank: 'Rank 145000',
      temperature: 'HOT',
      status: 'site_visit_scheduled',
      pipelineStage: 'site_visit_scheduled',
      packageBudget: '₹20 - ₹35 Lakhs',
      budget: '₹20 - ₹35 Lakhs',
      tokenAdvancePaid: 50000,
      customField1: 'Special Counselor Review Needed'
    }
  };

  let updateStatusCode = 200;
  let updateResponseJson = null;

  const mockRes = {
    status(code) {
      updateStatusCode = code;
      return this;
    },
    json(data) {
      updateResponseJson = data;
      return this;
    }
  };

  await updateLead(mockReq, mockRes);

  console.log('✅ 2. updateLead returned status:', updateStatusCode);
  assert.strictEqual(updateStatusCode, 200);

  // 3. Inspect updated lead from DB
  const updatedLead = await Lead.findById(minimalLead._id).lean();

  console.log('--- Verifying Stored Lead Profile Values ---');
  console.log('Name:', updatedLead.name);
  console.log('Email:', updatedLead.email);
  console.log('Location:', updatedLead.location);
  console.log('Target Stream:', updatedLead.targetStream);
  console.log('Target Course:', updatedLead.targetCourse);
  console.log('Target State:', updatedLead.targetState);
  console.log('Quota Preference:', updatedLead.quotaPreference);
  console.log('Academic Score 12th:', updatedLead.academicScore12th);
  console.log('Entrance Exam:', updatedLead.entranceExam);
  console.log('Entrance Rank:', updatedLead.entranceRank);
  console.log('Budget:', updatedLead.budget);
  console.log('Temperature:', updatedLead.temperature);
  console.log('Token Advance Paid:', updatedLead.tokenAdvancePaid);
  console.log('Custom Data:', updatedLead.customData);

  assert.strictEqual(updatedLead.name, 'Kunal Pratap Singh');
  assert.strictEqual(updatedLead.email, 'kunalpratapsingh1998@gmail.com');
  assert.strictEqual(updatedLead.location, 'Oxford, England');
  assert.strictEqual(updatedLead.targetStream, 'Medical (MBBS/BDS/BAMS)');
  assert.strictEqual(updatedLead.targetCourse, 'MBBS');
  assert.strictEqual(updatedLead.targetState, 'Pune, Maharashtra');
  assert.strictEqual(updatedLead.quotaPreference, 'Management / Institutional Quota');
  assert.strictEqual(updatedLead.academicScore12th, 55);
  assert.strictEqual(updatedLead.entranceExam, 'NEET');
  assert.strictEqual(updatedLead.entranceRank, 'Rank 145000');
  assert.strictEqual(updatedLead.budget, '₹20 - ₹35 Lakhs');
  assert.strictEqual(updatedLead.temperature, 'HOT');
  assert.strictEqual(updatedLead.tokenAdvancePaid, 50000);

  // Verify deduplication: quotaPreference and pipelineStage must NOT be duplicated in customData
  assert.strictEqual(updatedLead.customData.quotaPreference, undefined, 'Core key quotaPreference must be pruned from customData');
  assert.strictEqual(updatedLead.customData.pipelineStage, undefined, 'Core key pipelineStage must be pruned from customData');
  assert.strictEqual(updatedLead.customData.customField1, 'Special Counselor Review Needed', 'Non-core custom field must be preserved in customData');

  console.log('✅ 3. All field assertions passed! Deduplication verified.');

  // Clean up
  await Lead.deleteOne({ _id: minimalLead._id });
  await User.deleteOne({ _id: user._id });
  await mongoose.disconnect();

  console.log('🎉 --- ALL TESTS PASSED SUCCESSFULLY! --- 🎉');
}

runTest().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
