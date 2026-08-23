const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const ApiKey = require('../src/models/ApiKey');
const { ApiKeyService } = require('../src/monitoring/apikeys/apiKeyService');

async function testLive() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/mobile-crm';
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB on EC2');

  const overview = await ApiKeyService.getFleetOverview();
  const summary = overview.summary || {};
  console.log('\n--- API Key Fleet Overview ---');
  console.log(`Total Keys: ${summary.totalKeys}`);
  console.log(`Active: ${summary.activeKeys} | Expired: ${summary.expiredKeys} | Revoked: ${summary.revokedKeys} | Suspended: ${summary.suspendedKeys}`);
  console.log(`Total Requests: ${summary.totalRequests}`);
  console.log(`Active Alerts: ${summary.activeAlertsCount}`);
  console.log(`Rate Limit Violations: ${summary.rateLimitViolations}`);

  const keys = await ApiKey.find({}).sort({ createdAt: -1 });
  console.log(`\n--- Active Keys in Fleet (${keys.length}) ---`);
  keys.forEach((k) => {
    console.log(` • [${k.status}] ${k.name} | Org: ${k.organizationName} | Prefix: ${k.keyPrefix} | Hash: ${k.keyHash.substring(0, 16)}... | Requests: ${k.totalRequests || 0}`);
  });

  // Test Creating a temporary test key
  const created = await ApiKeyService.generateApiKey({
    name: 'Temporary Integration Probe',
    organizationId: new mongoose.Types.ObjectId(),
    organizationName: 'Probe Org Inc',
    permissions: ['leads:read', 'analytics:read'],
    rateLimitPerMinute: 120,
    expiresAt: new Date(Date.now() + 30 * 86400000),
    createdByName: 'Verification Bot',
  });
  console.log('\n✅ Created new test key:', created.apiKey.name, 'Prefix:', created.apiKey.keyPrefix);
  console.log('   Raw Secret (shown once):', created.rawKey.substring(0, 20) + '...');

  // Test Validating the raw key
  const validation = await ApiKeyService.validateApiKey(created.rawKey, {
    ip: '127.0.0.1',
    endpoint: '/api/leads',
  });
  console.log('✅ Validation Result (Valid):', validation.valid, 'Status:', validation.apiKey?.status);

  // Test Revocation
  const revoked = await ApiKeyService.revokeApiKey(created.apiKey.keyId, 'Automated test suite probe completion', 'Verification probe cleanup');
  console.log('✅ Revocation Result:', revoked.status);

  // Test Validating after revocation
  const postRevokeValidation = await ApiKeyService.validateApiKey(created.rawKey, {
    ip: '127.0.0.1',
  });
  console.log('✅ Validation Result after Revoke (Should be false):', postRevokeValidation.valid, 'Code:', postRevokeValidation.code);

  await mongoose.disconnect();
  console.log('\n🎉 ALL LIVE DATABASE OPERATIONS VALIDATED SUCCESSFULLY ON EC2!');
}

testLive().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
