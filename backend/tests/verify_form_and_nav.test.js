const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config();

const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const authController = require('../src/controllers/authController');
const leadsController = require('../src/controllers/leadsController');
const { validateFormData } = require('../src/utils/formValidator');

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

async function runVerification() {
  console.log('\n======================================================');
  console.log('🧪 VERIFYING DYNAMIC FORM ENGINE & MULTI-TENANT FIXES');
  console.log('======================================================\n');

  let mongoServer;
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const ownerId = new mongoose.Types.ObjectId();
    const agentId = new mongoose.Types.ObjectId();

    // 1. Create Agency Owner and Sub-Agent
    const owner = await User.create({
      _id: ownerId,
      name: 'Agency Owner',
      email: 'owner@agency.com',
      password: 'Password123!',
      companyId: ownerId,
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      industryType: 'Real Estate',
    });

    const agent = await User.create({
      _id: agentId,
      name: 'Agency Agent',
      email: 'agent@agency.com',
      password: 'Password123!',
      companyId: ownerId,
      role: 'agent',
      workStatus: 'employee',
      companyRole: 'agent',
      industryType: 'Real Estate',
    });

    // 2. Test Owner Saving Custom Schema with Optional Phone & Custom Name Label
    console.log('1️⃣ Testing Owner Customizing Form (Making Phone Optional & renaming Client Name)...');

    const customLeadSchema = [
      { fieldId: 'name', label: 'Prospect Full Name', fieldType: 'text', isRequired: true, isSystem: true, isHidden: false, order: 1 },
      { fieldId: 'phone', label: 'Mobile Contact', fieldType: 'phone', isRequired: false, isSystem: true, isHidden: false, order: 2 },
      { fieldId: 'email', label: 'Work Email', fieldType: 'email', isRequired: false, isSystem: true, isHidden: false, order: 3 },
      { fieldId: 'preferredLocation', label: 'Preferred Location', fieldType: 'text', isRequired: true, isSystem: false, isHidden: false, order: 4 },
      { fieldId: 'budget', label: 'Investment Budget', fieldType: 'currency', isRequired: false, isSystem: false, isHidden: false, order: 5 },
    ];

    const saveReq = {
      user: owner,
      query: { type: 'lead' },
      body: { schema: customLeadSchema, formType: 'lead' }
    };
    const saveRes = mockRes();
    await authController.updateFormSchema(saveReq, saveRes);

    assert(saveRes.data && saveRes.data.success === true, 'Owner schema update API succeeded');
    assert(saveRes.data.leadFormSchema.length === 5, 'Owner saved 5 customized fields');
    const savedPhoneField = saveRes.data.leadFormSchema.find(f => f.fieldId === 'phone');
    assert(savedPhoneField && savedPhoneField.isRequired === false, 'Phone field is saved as isRequired: false (Full Owner Control)');

    // 3. Test Sub-Agent Inheriting Owner Custom Schema
    console.log('2️⃣ Testing Sub-Agent Multi-Tenant Schema Inheritance...');

    const getAgentSchemaReq = { user: agent, query: { type: 'lead' } };
    const getAgentSchemaRes = mockRes();
    await authController.getFormSchema(getAgentSchemaReq, getAgentSchemaRes);

    assert(getAgentSchemaRes.data && getAgentSchemaRes.data.schema.length === 5, 'Sub-agent dynamically inherits owner custom schema (5 fields)');
    const agentPhoneField = getAgentSchemaRes.data.schema.find(f => f.fieldId === 'phone');
    assert(agentPhoneField && agentPhoneField.isRequired === false, 'Sub-agent sees phone as optional');
    const agentNameField = getAgentSchemaRes.data.schema.find(f => f.fieldId === 'name');
    assert(agentNameField && agentNameField.label === 'Prospect Full Name', 'Sub-agent sees customized label "Prospect Full Name"');

    // 4. Test Lead Creation with Missing Custom Required Field (preferredLocation)
    console.log('3️⃣ Testing Dynamic Validation on Lead Creation...');

    const invalidLeadReq = {
      user: agent,
      body: {
        name: 'Vikas Sharma',
        phone: '9876543210',
        // preferredLocation missing (which is required in custom schema)
      }
    };
    const invalidLeadRes = mockRes();
    await leadsController.createLead(invalidLeadReq, invalidLeadRes);
    assert(invalidLeadRes.statusCode === 400, 'Lead rejected with 400 because custom required field "preferredLocation" is missing');

    // 5. Test Lead Creation with Optional Phone left blank
    console.log('4️⃣ Testing Lead Creation with Optional Phone omitted & Custom Fields saved...');

    const validLeadReq = {
      user: agent,
      body: {
        name: 'Vikas Sharma',
        // phone omitted because owner made it optional!
        preferredLocation: 'Golf Course Road, Gurgaon',
        budget: '25000000',
      }
    };
    const validLeadRes = mockRes();
    await leadsController.createLead(validLeadReq, validLeadRes);

    assert(validLeadRes.statusCode !== 400, 'Lead created successfully without phone when phone is marked optional');

    const createdLead = await Lead.findOne({ name: 'Vikas Sharma' });
    assert(createdLead !== null, 'Lead saved in database');
    assert(createdLead.customData?.preferredLocation === 'Golf Course Road, Gurgaon', 'Custom field preferredLocation saved in customData');
    assert(createdLead.companyId.toString() === ownerId.toString(), 'Lead correctly linked to company tenant');

    console.log('\n======================================================');
    console.log('🎉 ALL DYNAMIC FORM & MULTI-TENANT TESTS PASSED!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    if (mongoServer) await mongoServer.stop();
  }
}

runVerification();
