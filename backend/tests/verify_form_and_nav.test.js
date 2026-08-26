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
  res.set = () => res;
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
      password: 'password123',
      role: 'admin',
      companyRole: 'owner',
      workStatus: 'company_owner',
      industryType: 'REAL ESTATE',
    });

    const agent = await User.create({
      _id: agentId,
      name: 'Sales Agent',
      email: 'agent@agency.com',
      password: 'password123',
      role: 'agent',
      companyRole: 'agent',
      companyId: ownerId,
      industryType: 'REAL ESTATE',
    });

    // 1. Owner updates lead form schema
    console.log('1️⃣ Testing Owner Customizing Form (Making Phone Optional & renaming Client Name)...');
    const updateReq = {
      user: owner,
      query: { type: 'lead' },
      body: {
        formType: 'lead',
        schema: [
          { fieldId: 'name', label: 'Prospect Full Name', fieldType: 'text', isRequired: false },
          { fieldId: 'phone', label: 'Mobile Number', fieldType: 'phone', isRequired: false },
          { fieldId: 'preferredLocation', label: 'Preferred Sector / Area', fieldType: 'text', isRequired: true },
          { fieldId: 'budget', label: 'Expected Budget', fieldType: 'currency', isRequired: false },
          { fieldId: 'followUpDate', label: 'Next Follow-up Date & Time', fieldType: 'datetime', isRequired: false },
        ]
      }
    };
    const updateRes = mockRes();
    await authController.updateFormSchema(updateReq, updateRes);

    assert(updateRes.data && updateRes.data.success === true, 'Owner schema update API succeeded');
    assert(updateRes.data.leadFormSchema.length === 5, 'Owner saved 5 customized fields');
    assert(updateRes.data.leadFormSchema.find(f => f.fieldId === 'phone').isRequired === false, 'Phone field is saved as isRequired: false (Full Owner Control)');

    // 2. Sub-agent fetches form schema and inherits owner's customizations
    console.log('2️⃣ Testing Sub-Agent Multi-Tenant Schema Inheritance...');
    const agentGetReq = { user: agent, query: { type: 'lead' } };
    const agentGetRes = mockRes();
    await authController.getFormSchema(agentGetReq, agentGetRes);

    assert(agentGetRes.data && agentGetRes.data.schema.length === 5, 'Sub-agent dynamically inherits owner custom schema (5 fields)');
    assert(agentGetRes.data.schema.find(f => f.fieldId === 'phone').isRequired === false, 'Sub-agent sees phone as optional');
    assert(agentGetRes.data.schema.find(f => f.fieldId === 'name').label === 'Prospect Full Name', 'Sub-agent sees customized label "Prospect Full Name"');

    // 3. Dynamic Lead Form Validation
    console.log('3️⃣ Testing Dynamic Validation on Lead Creation...');
    const invalidLeadReq = {
      user: agent,
      body: {
        name: 'Vikas Sharma',
        // preferredLocation omitted even though it is marked required by owner!
        budget: '25000000',
      }
    };
    const invalidLeadRes = mockRes();
    await leadsController.createLead(invalidLeadReq, invalidLeadRes);
    assert(invalidLeadRes.statusCode === 400, 'Lead rejected with 400 because custom required field "preferredLocation" is missing');

    // 4. Create Lead with phone omitted
    console.log('4️⃣ Testing Lead Creation with Optional Phone omitted & Custom Fields saved...');
    const validLeadReq = {
      user: agent,
      body: {
        name: 'Vikas Sharma',
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

    // 5. Product/Package Custom Schema & Creation
    console.log('5️⃣ Testing Product / Package Custom Schema & Creation...');
    const projectsController = require('../src/controllers/projectsController');
    const Project = require('../src/models/Project');

    const updateProdReq = {
      user: owner,
      query: { type: 'product' },
      body: {
        formType: 'product',
        schema: [
          { fieldId: 'name', label: 'Package Name', fieldType: 'text', isRequired: false },
          { fieldId: 'location', label: 'Market / Region', fieldType: 'text', isRequired: false },
          { fieldId: 'basePrice', label: 'Base Pricing', fieldType: 'currency', isRequired: false },
          { fieldId: 'customWarranty', label: 'Warranty Period', fieldType: 'text', isRequired: false },
        ]
      }
    };
    const updateProdRes = mockRes();
    await authController.updateFormSchema(updateProdReq, updateProdRes);
    assert(updateProdRes.data && updateProdRes.data.success === true, 'Owner Product schema update succeeded');
    assert(updateProdRes.data.productFormSchema.length === 4, 'Owner saved 4 customized product fields');

    const prodCreateReq = {
      user: agent,
      body: {
        name: 'Premium Growth Suite',
        location: 'Mumbai & NCR',
        basePrice: '50 Lakhs',
        customWarranty: '2 Years Comprehensive',
      }
    };
    const prodCreateRes = mockRes();
    await projectsController.createProject(prodCreateReq, prodCreateRes);
    assert(prodCreateRes.statusCode === 201, 'Product created successfully with dynamic schema');

    const createdProject = await Project.findOne({ name: 'Premium Growth Suite' });
    assert(createdProject !== null, 'Project saved in MongoDB');
    assert(createdProject.customData?.customWarranty === '2 Years Comprehensive', 'Custom product field saved in customData');

    console.log('\n======================================================');
    console.log('🎉 ALL DYNAMIC FORM, PRODUCT & MULTI-TENANT TESTS PASSED!');
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
