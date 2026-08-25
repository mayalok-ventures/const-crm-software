/**
 * Dynamic Form Builder — Comprehensive Test Suite
 * Strictly isolated for Prospect Lead and Product/Package dynamic forms.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('dotenv').config();

const User = require('../src/models/User');
const Lead = require('../src/models/Lead');
const Project = require('../src/models/Project');
const authController = require('../src/controllers/authController');
const leadsController = require('../src/controllers/leadsController');
const projectsController = require('../src/controllers/projectsController');
const {
  evaluateRule,
  isFieldVisible,
  isFieldRequired,
  validateFormData,
  getDefaultProductFormSchema,
} = require('../src/utils/formValidator');

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

async function runDynamicFormBuilderTestSuite() {
  console.log('\n======================================================');
  console.log('📋  DYNAMIC FORM BUILDER & CUSTOM FIELDS TEST SUITE');
  console.log('======================================================\n');

  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const tenantAId = new mongoose.Types.ObjectId();
    const tenantBId = new mongoose.Types.ObjectId();

    const userA = await User.create({
      _id: tenantAId,
      name: 'Tenant A Admin',
      email: 'adminA@example.com',
      password: 'Password123!',
      companyId: tenantAId,
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      industryType: 'Real Estate',
    });

    const userB = await User.create({
      _id: tenantBId,
      name: 'Tenant B Admin',
      email: 'adminB@example.com',
      password: 'Password123!',
      companyId: tenantBId,
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      industryType: 'Agency',
    });

    // ─────────────────────────────────────────────────────────────
    // 1. CONDITIONAL LOGIC OPERATOR ENGINE
    // ─────────────────────────────────────────────────────────────
    console.log('1️⃣ Testing Conditional Logic Operators (=, !=, >, <, contains, is empty, in)...');

    assert(evaluateRule({ field: 'type', operator: '=', value: 'Commercial' }, { type: 'Commercial' }) === true, 'Equality (=) operator matches');
    assert(evaluateRule({ field: 'type', operator: '=', value: 'Commercial' }, { type: 'Residential' }) === false, 'Equality (=) operator rejects mismatch');
    assert(evaluateRule({ field: 'type', operator: '!=', value: 'Commercial' }, { type: 'Residential' }) === true, 'Inequality (!=) operator works');
    assert(evaluateRule({ field: 'budget', operator: '>=', value: 5000000 }, { budget: 6000000 }) === true, 'Greater Than / Equal (>=) works');
    assert(evaluateRule({ field: 'budget', operator: '<', value: 5000000 }, { budget: 6000000 }) === false, 'Less Than (<) works');
    assert(evaluateRule({ field: 'tags', operator: 'contains', value: 'VIP' }, { tags: ['Investor', 'VIP'] }) === true, 'Contains operator matches array item');
    assert(evaluateRule({ field: 'remarks', operator: 'is empty' }, { remarks: '' }) === true, 'Is Empty operator matches empty string');
    assert(evaluateRule({ field: 'city', operator: 'in', value: 'Noida, Delhi, Gurgaon' }, { city: 'Noida' }) === true, 'In operator matches list');

    // ─────────────────────────────────────────────────────────────
    // 2. AND / OR CONDITIONAL COMBINATORS & VISIBILITY
    // ─────────────────────────────────────────────────────────────
    console.log('2️⃣ Testing AND / OR Combinators for Field Visibility...');

    const conditionalFieldAND = {
      fieldId: 'premiumFeatures',
      label: 'Premium Features',
      isHidden: false,
      conditionalRules: {
        combinator: 'AND',
        rules: [
          { field: 'propertyType', operator: '=', value: 'Commercial' },
          { field: 'budget', operator: '>=', value: 10000000 },
        ],
      },
    };

    assert(isFieldVisible(conditionalFieldAND, { propertyType: 'Commercial', budget: 15000000 }) === true, 'AND rule passes when all match');
    assert(isFieldVisible(conditionalFieldAND, { propertyType: 'Commercial', budget: 5000000 }) === false, 'AND rule hides field when one condition fails');

    const conditionalFieldOR = {
      fieldId: 'urgentFollowUp',
      label: 'Urgent Action',
      isHidden: false,
      conditionalRules: {
        combinator: 'OR',
        rules: [
          { field: 'timeline', operator: '=', value: 'Immediate' },
          { field: 'vipClient', operator: '=', value: 'true' },
        ],
      },
    };

    assert(isFieldVisible(conditionalFieldOR, { timeline: 'Immediate', vipClient: 'false' }) === true, 'OR rule passes when at least one matches');
    assert(isFieldVisible(conditionalFieldOR, { timeline: '3-6 Months', vipClient: 'false' }) === false, 'OR rule hides field when none match');

    // ─────────────────────────────────────────────────────────────
    // 3. CONDITIONAL REQUIREDNESS
    // ─────────────────────────────────────────────────────────────
    console.log('3️⃣ Testing Conditional Requiredness Logic...');

    const conditionallyRequiredField = {
      fieldId: 'gstNumber',
      label: 'GST Number',
      isRequired: false,
      isHidden: false,
      conditionalRequiredRules: {
        combinator: 'AND',
        rules: [{ field: 'hasCompany', operator: '=', value: 'Yes' }],
      },
    };

    assert(isFieldRequired(conditionallyRequiredField, { hasCompany: 'Yes' }) === true, 'Field becomes required when condition is met');
    assert(isFieldRequired(conditionallyRequiredField, { hasCompany: 'No' }) === false, 'Field is optional when condition is not met');

    // ─────────────────────────────────────────────────────────────
    // 4. PROSPECT LEAD FORM SCHEMA CONFIGURATION API
    // ─────────────────────────────────────────────────────────────
    console.log('4️⃣ Testing Prospect Lead Form Custom Schema Save & Retrieval...');

    const customLeadSchema = [
      { fieldId: 'name', label: 'Full Name', fieldType: 'text', isRequired: true, isSystem: true, order: 1 },
      { fieldId: 'phone', label: 'Mobile Number', fieldType: 'phone', isRequired: true, isSystem: true, order: 2 },
      { fieldId: 'email', label: 'Email Address', fieldType: 'email', isRequired: false, isSystem: true, order: 3 },
      { fieldId: 'propertyType', label: 'Property Type', fieldType: 'select', options: ['Residential', 'Commercial', 'Plot'], isRequired: true, order: 4 },
      {
        fieldId: 'commercialType',
        label: 'Commercial Type',
        fieldType: 'select',
        options: ['Retail Shop', 'Office Space', 'Warehouse'],
        isRequired: false,
        order: 5,
        conditionalRules: {
          combinator: 'AND',
          rules: [{ field: 'propertyType', operator: '=', value: 'Commercial' }],
        },
      },
      {
        fieldId: 'gstNumber',
        label: 'Company GST',
        fieldType: 'text',
        isRequired: false,
        order: 6,
        conditionalRequiredRules: {
          combinator: 'AND',
          rules: [{ field: 'propertyType', operator: '=', value: 'Commercial' }],
        },
      },
    ];

    const saveLeadReq = {
      user: userA,
      query: { type: 'lead' },
      body: { fields: customLeadSchema },
    };
    const saveLeadRes = mockRes();
    await authController.updateFormSchema(saveLeadReq, saveLeadRes);
    assert(saveLeadRes.data && saveLeadRes.data.success, 'Tenant A custom lead form schema saved');

    const getLeadReq = { user: userA, query: { type: 'lead' } };
    const getLeadRes = mockRes();
    await authController.getFormSchema(getLeadReq, getLeadRes);
    assert(getLeadRes.data && getLeadRes.data.schema.length === 6, 'Tenant A retrieves customized 6-field lead schema');

    // ─────────────────────────────────────────────────────────────
    // 5. PRODUCT / PACKAGE FORM SCHEMA CONFIGURATION API
    // ─────────────────────────────────────────────────────────────
    console.log('5️⃣ Testing Product / Package Form Custom Schema Save & Retrieval...');

    const customProductSchema = [
      { fieldId: 'name', label: 'Suite Package Name', fieldType: 'text', isRequired: true, isSystem: true, order: 1 },
      { fieldId: 'location', label: 'Region / Market', fieldType: 'text', isRequired: true, isSystem: true, order: 2 },
      { fieldId: 'serviceTier', label: 'Service Tier', fieldType: 'select', options: ['Silver', 'Gold', 'Platinum'], isRequired: true, order: 3 },
      { fieldId: 'annualSlaPercent', label: 'SLA Guarantee (%)', fieldType: 'percentage', isRequired: false, order: 4 },
      { fieldId: 'supportHours', label: 'Support Window', fieldType: 'text', defaultValue: '24/7 Priority SLA', isRequired: false, order: 5 },
    ];

    const saveProdReq = {
      user: userA,
      query: { type: 'product' },
      body: { fields: customProductSchema },
    };
    const saveProdRes = mockRes();
    await authController.updateFormSchema(saveProdReq, saveProdRes);
    assert(saveProdRes.data && saveProdRes.data.success, 'Tenant A custom product/package schema saved');

    const getProdReq = { user: userA, query: { type: 'product' } };
    const getProdRes = mockRes();
    await authController.getFormSchema(getProdReq, getProdRes);
    assert(getProdRes.data && getProdRes.data.schema.length === 5, 'Tenant A retrieves customized 5-field product schema');

    // ─────────────────────────────────────────────────────────────
    // 6. BACKEND VALIDATION ENFORCEMENT ON LEAD CREATION
    // ─────────────────────────────────────────────────────────────
    console.log('6️⃣ Testing Backend Validation on Lead Creation...');

    const refreshedUserA = await User.findById(tenantAId);

    // Test missing required field (propertyType is required in custom schema)
    const invalidLeadReq = {
      user: refreshedUserA,
      body: {
        name: 'Aarav Mehta',
        phone: '9811223344',
        // propertyType missing
      },
    };
    const invalidLeadRes = mockRes();
    await leadsController.createLead(invalidLeadReq, invalidLeadRes);
    assert(invalidLeadRes.statusCode === 400, 'Lead creation rejected with 400 when required custom field is missing');

    // Test conditionally required field (gstNumber required when propertyType is Commercial)
    const invalidGstReq = {
      user: refreshedUserA,
      body: {
        name: 'Aarav Mehta',
        phone: '9811223344',
        propertyType: 'Commercial',
        // gstNumber missing
      },
    };
    const invalidGstRes = mockRes();
    await leadsController.createLead(invalidGstReq, invalidGstRes);
    assert(invalidGstRes.statusCode === 400, 'Lead creation rejected with 400 when conditionally required field is missing');

    // Test valid lead creation with all conditional fields satisfied
    const validLeadReq = {
      user: refreshedUserA,
      body: {
        name: 'Aarav Mehta',
        phone: '9811223344',
        propertyType: 'Commercial',
        commercialType: 'Office Space',
        gstNumber: '07AAAAA1111A1Z5',
      },
    };
    const validLeadRes = mockRes();
    await leadsController.createLead(validLeadReq, validLeadRes);
    assert(validLeadRes.statusCode === 201 || validLeadRes.data?.success || validLeadRes.data?._id, 'Valid lead created successfully');

    // Verify custom fields stored in lead.customData
    const savedLead = await Lead.findOne({ phone: '9811223344' });
    assert(savedLead && savedLead.customData?.gstNumber === '07AAAAA1111A1Z5', 'Custom fields preserved in lead.customData');

    // ─────────────────────────────────────────────────────────────
    // 7. BACKEND VALIDATION ENFORCEMENT ON PRODUCT CREATION
    // ─────────────────────────────────────────────────────────────
    console.log('7️⃣ Testing Backend Validation on Product / Package Creation...');

    // Test missing serviceTier in product creation
    const invalidProdReq = {
      user: refreshedUserA,
      body: {
        name: 'Cloud Hosting Enterprise',
        location: 'Global',
        // serviceTier missing
      },
    };
    const invalidProdRes = mockRes();
    await projectsController.createProject(invalidProdReq, invalidProdRes);
    assert(invalidProdRes.statusCode === 400, 'Product creation rejected with 400 when required custom field is missing');

    // Test valid product creation with custom fields
    const validProdReq = {
      user: refreshedUserA,
      body: {
        name: 'Cloud Hosting Enterprise',
        location: 'Global',
        serviceTier: 'Platinum',
        annualSlaPercent: 99.99,
        supportHours: '24/7 Dedicated Team',
      },
    };
    const validProdRes = mockRes();
    await projectsController.createProject(validProdReq, validProdRes);
    assert(validProdRes.statusCode === 201 || validProdRes.data?._id, 'Product created successfully with dynamic fields');

    const savedProject = await Project.findOne({ name: 'Cloud Hosting Enterprise' });
    assert(savedProject && savedProject.customData?.serviceTier === 'Platinum', 'Custom fields preserved in project.customData');

    // ─────────────────────────────────────────────────────────────
    // 8. MULTI-TENANT ISOLATION
    // ─────────────────────────────────────────────────────────────
    console.log('8️⃣ Testing Multi-Tenant Isolation (Tenant A vs Tenant B)...');

    const getTenantBSchemaReq = { user: userB, query: { type: 'lead' } };
    const getTenantBSchemaRes = mockRes();
    await authController.getFormSchema(getTenantBSchemaReq, getTenantBSchemaRes);

    const tenantBHasGst = getTenantBSchemaRes.data.schema.some(f => f.fieldId === 'gstNumber');
    assert(tenantBHasGst === false, 'Tenant B does not inherit or see Tenant A custom fields (Tenant Isolation verified)');

    console.log('\n======================================================');
    console.log('🏁 DYNAMIC FORM BUILDER: ALL 8 TEST SUITES PASSED');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Error during dynamic form builder test suite:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    if (mongoServer) await mongoServer.stop();
  }
}

runDynamicFormBuilderTestSuite();
