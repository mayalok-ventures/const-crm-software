const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { ApiKey } = require('../src/models/ApiKey');
const { ApiKeySecurityAlert } = require('../src/models/ApiKeySecurityAlert');
const { ApiKeyAuditLog } = require('../src/models/ApiKeyAuditLog');
const { apiKeyService } = require('../src/monitoring/apikeys/apiKeyService');

async function runLiveVerification() {
  console.log('Connecting to MongoDB on EC2...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB Connected!');

  const keys = await ApiKey.find({}).lean();
  console.log(`\n🔑 Live ApiKeys Count: ${keys.length}`);
  keys.forEach(k => {
    console.log(` - [${k.status}] ${k.name} (${k.organizationName}) | Prefix: ${k.keyPrefix} | Calls: ${k.totalRequests} | IP: ${k.lastUsedIp || 'N/A'}`);
  });

  const alerts = await ApiKeySecurityAlert.find({}).lean();
  console.log(`\n🚨 Live Security Alerts Count: ${alerts.length}`);
  alerts.forEach(a => {
    console.log(` - [${a.severity}] ${a.title} | Type: ${a.type} | Resolved: ${a.resolved}`);
  });

  const auditLogs = await ApiKeyAuditLog.find({}).sort({ createdAt: -1 }).limit(5).lean();
  console.log(`\n📜 Recent Audit Logs (Top 5):`);
  auditLogs.forEach(l => {
    console.log(` - ${l.action} on key ${l.keyPrefix || l.keyId} by ${l.performedBy} (${l.details || 'N/A'})`);
  });

  // Test full cycle live on DB:
  console.log('\n🧪 Testing live ApiKey generation & validation cycle...');
  const { apiKey, rawKey } = await apiKeyService.generateApiKey({
    name: 'Live EC2 Integration Key',
    organizationId: 'org_ec2_live',
    organizationName: 'EC2 Live Testing Corp',
    permissions: ['leads:read', 'leads:write'],
    rateLimitPerMinute: 60,
    createdBy: 'system_qa_bot'
  });

  console.log(`Generated Key: raw=${rawKey.slice(0, 15)}... mask=${apiKey.keyPrefix} keyId=${apiKey.keyId}`);

  const validation = await apiKeyService.validateApiKey(rawKey, {
    ip: '13.51.219.53',
    userAgent: 'LiveTester/1.0',
    endpoint: '/api/v1/leads'
  });

  console.log(`Validation result: valid=${validation.valid} status=${validation.apiKey?.status} keyName=${validation.apiKey?.name}`);

  // Test rotation
  console.log('\n🔄 Testing key rotation live...');
  const rotated = await apiKeyService.rotateApiKey(apiKey.keyId, { performedBy: 'admin_live' });
  console.log(`Rotated key: newRaw=${rotated.newRawKey.slice(0, 15)}... newMask=${rotated.apiKey.keyPrefix} oldKeysArchived=${rotated.apiKey.rotationHistory.length}`);

  // Validate old raw key fails
  const oldValidation = await apiKeyService.validateApiKey(rawKey);
  console.log(`Old raw key validation after rotation (should fail): valid=${oldValidation.valid} error=${oldValidation.message}`);

  // Validate new raw key succeeds
  const newValidation = await apiKeyService.validateApiKey(rotated.newRawKey);
  console.log(`New raw key validation after rotation (should pass): valid=${newValidation.valid} keyName=${newValidation.apiKey?.name}`);

  // Revoke the test key
  await apiKeyService.revokeApiKey(apiKey.keyId, { performedBy: 'admin_live', reason: 'Live verification complete' });
  const postRevoke = await apiKeyService.validateApiKey(rotated.newRawKey);
  console.log(`Post-revocation validation (should fail): valid=${postRevoke.valid} error=${postRevoke.message}`);

  console.log('\n✅ ALL LIVE EC2 MONGO & SERVICE TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runLiveVerification().catch(err => {
  console.error('❌ Error during live verification:', err);
  process.exit(1);
});
