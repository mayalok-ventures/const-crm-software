const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const AutomationRule = require('../src/models/AutomationRule');

async function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runApiVerification() {
  console.log('🚀 Starting Automation REST API End-to-End Verification...');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Find an active user with owner/admin role
  let user = await User.findOne({ isActive: true, role: { $in: ['owner', 'admin', 'manager'] } });
  if (!user) {
    user = await User.findOne({ isActive: true });
  }

  if (!user) {
    console.error('❌ No active user found in database for API verification');
    process.exit(1);
  }

  console.log(`👤 Using user: ${user.name} (${user.email}) [Role: ${user.role}]`);

  const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const workspaceId = user.workspaceId || user._id.toString();

  // 1. GET /api/automations
  console.log('\n--- 1. Testing GET /api/automations ---');
  const getRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/automations',
    method: 'GET',
    headers,
  });
  console.log(`Response Code: ${getRes.status}`);
  if (getRes.status !== 200 || !Array.isArray(getRes.body.rules)) {
    console.error('❌ Failed GET /api/automations:', getRes.body);
    process.exit(1);
  }
  console.log(`✅ Success! Retrieved ${getRes.body.rules.length} automation rules.`);

  // 2. POST /api/automations (Create Rule)
  console.log('\n--- 2. Testing POST /api/automations ---');
  const newRulePayload = {
    name: 'E2E Test REST Bot',
    description: 'Created via automated REST test suite',
    category: 'inbound_bot',
    triggerType: 'whatsapp_inbound',
    triggerConfig: {
      channel: 'whatsapp',
      keywords: ['testrest', 'restbot'],
      matchType: 'keyword_exact',
    },
    actionType: 'send_whatsapp_template',
    actionConfig: {
      templateText: 'Hello {{name}}! REST E2E Bot response verified.',
      options: ['Option A', 'Option B'],
    },
    actions: [
      {
        order: 1,
        type: 'send_whatsapp_template',
        config: {
          templateText: 'Hello {{name}}! REST E2E Bot response verified.',
          options: ['Option A', 'Option B'],
        },
      },
    ],
    isActive: true,
  };

  const createRes = await request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/automations',
      method: 'POST',
      headers,
    },
    newRulePayload
  );

  console.log(`Response Code: ${createRes.status}`);
  if (createRes.status !== 201 || !createRes.body.rule?._id) {
    console.error('❌ Failed POST /api/automations:', createRes.body);
    process.exit(1);
  }
  const createdRuleId = createRes.body.rule._id;
  console.log(`✅ Success! Rule created with ID: ${createdRuleId}`);

  // 3. POST /api/automations/test (Dry-Run Test)
  console.log('\n--- 3. Testing POST /api/automations/test ---');
  const testPayload = {
    actionType: 'send_whatsapp_template',
    actionConfig: {
      templateText: 'Welcome {{name}}! Your chosen course is {{course}}.',
    },
    leadData: {
      name: 'Aditya Sharma',
      phone: '919876543210',
      course: 'B.Tech AI & Data Science',
    },
  };

  const testRes = await request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/automations/test',
      method: 'POST',
      headers,
    },
    testPayload
  );

  console.log(`Response Code: ${testRes.status}`);
  if (testRes.status !== 200 || !testRes.body.renderedPreview?.includes('Aditya Sharma')) {
    console.error('❌ Failed POST /api/automations/test:', testRes.body);
    process.exit(1);
  }
  console.log(`✅ Success! Dry-run rendered: "${testRes.body.renderedPreview}"`);

  // 4. PATCH /api/automations/:id/toggle (Toggle Status)
  console.log('\n--- 4. Testing PATCH /api/automations/:id/toggle ---');
  const toggleRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/automations/${createdRuleId}/toggle`,
    method: 'PATCH',
    headers,
  });

  console.log(`Response Code: ${toggleRes.status}`);
  if (toggleRes.status !== 200 || toggleRes.body.rule?.isActive !== false) {
    console.error('❌ Failed PATCH toggle:', toggleRes.body);
    process.exit(1);
  }
  console.log(`✅ Success! Rule status toggled. New isActive: ${toggleRes.body.rule.isActive}`);

  // 5. GET /api/automations/logs (Execution Logs)
  console.log('\n--- 5. Testing GET /api/automations/logs ---');
  const logsRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/automations/logs',
    method: 'GET',
    headers,
  });

  console.log(`Response Code: ${logsRes.status}`);
  if (logsRes.status !== 200 || !Array.isArray(logsRes.body.logs)) {
    console.error('❌ Failed GET /api/automations/logs:', logsRes.body);
    process.exit(1);
  }
  console.log(`✅ Success! Fetched ${logsRes.body.logs.length} automation execution logs.`);

  // 6. Cleanup
  console.log('\n--- 6. Cleanup Test Rule ---');
  const deleteRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/automations/${createdRuleId}`,
    method: 'DELETE',
    headers,
  });
  console.log(`Delete Status: ${deleteRes.status}`);
  if (deleteRes.status === 200) {
    console.log('✅ Cleanup successful.');
  }

  await mongoose.disconnect();
  console.log('\n🎉 ALL REST API ENDPOINTS VERIFIED AND FULLY OPERATIONAL!');
  process.exit(0);
}

runApiVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
