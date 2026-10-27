const mongoose = require('mongoose');
const ActivityLog = require('../src/models/ActivityLog');
const User = require('../src/models/User');
const Pipeline = require('../src/models/Pipeline');
const FormSchema = require('../src/models/FormSchema');

function runSchemaValidationTests() {
  console.log('\n======================================================');
  console.log('🧪 PURE SCHEMA & BUSINESS LOGIC VALIDATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failed++;
    }
  }

  // 1. ActivityLog Schema Validation
  console.log('1️⃣ Validating ActivityLog Schema (Universal Append-Only Audit Trail)...');
  const dummyActorId = new mongoose.Types.ObjectId();
  const dummyEntityId = new mongoose.Types.ObjectId();

  const logDoc = new ActivityLog({
    actor: dummyActorId,
    actorRole: 'admin',
    action: 'CREATE',
    entityType: 'User',
    entityId: dummyEntityId,
    metadata: { oldValue: null, newValue: { name: 'Manager Alex' }, details: 'Added manager' },
    ipAddress: '192.168.0.25',
  });

  const logErr = logDoc.validateSync();
  assert(!logErr, 'ActivityLog passes all field validations');
  assert(logDoc.action === 'CREATE' && logDoc.entityType === 'User', 'ActivityLog action and entityType enum validated');

  // Test invalid enum
  const invalidLog = new ActivityLog({
    actor: dummyActorId,
    action: 'INVALID_ACTION',
    entityType: 'InvalidEntity',
    entityId: dummyEntityId,
  });
  const invalidLogErr = invalidLog.validateSync();
  assert(invalidLogErr && invalidLogErr.errors['action'], 'ActivityLog rejects invalid action enum');
  assert(invalidLogErr && invalidLogErr.errors['entityType'], 'ActivityLog rejects invalid entityType enum');

  // 2. User Schema Validation (Hierarchy, Roles, Routing Controls)
  console.log('\n2️⃣ Validating User Schema (Hierarchy, Strict Roles & Routing)...');
  const managerId = new mongoose.Types.ObjectId();
  const agentUser = new User({
    name: 'Agent Priya',
    email: 'priya@crm.com',
    phone: '9876543210',
    password: 'SecurePassword@123',
    role: 'agent',
    managerId: managerId,
    managerName: 'Manager Deepak',
    leadCap: 80,
    isAvailableForRouting: true,
    userStatus: 'active',
    isActive: true,
  });

  const agentErr = agentUser.validateSync();
  assert(!agentErr, 'Agent user with manager hierarchy passes validation');
  assert(agentUser.role === 'agent', 'User role confirmed as agent');
  assert(String(agentUser.managerId) === String(managerId), 'Agent linked to managerId');
  assert(agentUser.leadCap === 80 && agentUser.isAvailableForRouting === true, 'Operational routing controls validated');

  // 3. Pipeline Schema Validation
  console.log('\n3️⃣ Validating Pipeline Schema (Dynamic Stages, SLA & Win Probability)...');
  const pipeline = new Pipeline({
    name: 'Real Estate Luxury Residential Pipeline',
    description: 'High-ticket deals workflow',
    isActive: true,
    stages: [
      { name: 'Site Visit Scheduled', order: 0, probability: 25, colorCode: '#3b82f6', slaHours: 6 },
      { name: 'Token Amount Received', order: 1, probability: 75, colorCode: '#8b5cf6', slaHours: 48 },
      { name: 'Agreement Signed', order: 2, probability: 100, colorCode: '#10b981', slaHours: 72 },
    ],
  });

  const pipelineErr = pipeline.validateSync();
  assert(!pipelineErr, 'Pipeline schema with customized stages passes validation');
  assert(pipeline.stages[0].slaHours === 6 && pipeline.stages[1].probability === 75, 'Stage order, probability and SLA hours validated');

  // 4. FormSchema Validation
  console.log('\n4️⃣ Validating FormSchema (Dynamic Form Centre & Pipeline Routing)...');
  const form = new FormSchema({
    title: 'Ad Landing Page Lead Capture Form',
    description: 'Direct Facebook & Google Ads lead capture',
    isActive: true,
    fields: [
      { label: 'Full Name', name: 'name', type: 'text', isRequired: true },
      { label: 'Mobile Number', name: 'phone', type: 'phone', isRequired: true },
      { label: 'Investment Budget', name: 'budget', type: 'dropdown', options: ['₹50 Lakhs', '₹1 Crore', '₹2+ Crores'], isRequired: false },
      { label: 'Preferred City', name: 'city', type: 'text', defaultValue: 'Bangalore' },
    ],
    routing: {
      targetPipeline: pipeline._id,
      targetStage: 'Site Visit Scheduled',
    },
  });

  const formErr = form.validateSync();
  assert(!formErr, 'FormSchema with dynamic fields passes validation');
  assert(form.fields.length === 4, 'Dynamic field definitions (text, phone, dropdown) verified');
  assert(String(form.routing.targetPipeline) === String(pipeline._id), 'Form target pipeline routing linked');

  console.log('\n======================================================');
  console.log(`📊 FINAL RESULT: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runSchemaValidationTests();
