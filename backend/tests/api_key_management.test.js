/**
 * Secure API Key and Token Management Module Automated Test Suite
 * Tests cryptographic entropy, HMAC-SHA256 one-way hashing, masking,
 * one-time secret reveal constraint, authentication validation,
 * sliding-window rate limiting, IP whitelist enforcement, permission scopes,
 * lifecycle transitions (Active, Revoked, Suspended, Expired), key rotation,
 * and security anomaly detection (excessive requests, unusual IP shift).
 */

const assert = require('assert');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Import compiled or source modules
const { ApiKeyService } = require('../src/monitoring/apikeys/apiKeyService');
const { requireApiKeyScope } = require('../src/middleware/apiKeyAuthMiddleware');
const ApiKey = require('../src/models/ApiKey');
const ApiKeyAuditLog = require('../src/models/ApiKeyAuditLog');
const ApiKeySecurityAlert = require('../src/models/ApiKeySecurityAlert');

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING SECURE API KEY & TOKEN MANAGEMENT MODULE TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function it(description, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Cryptographic Hashing Determinism & Integrity
  await it('should hash API keys using HMAC-SHA256 deterministically', () => {
    const rawKey = 'crm_live_9f8a1234567890abcdef1234567890abcdef12345678';
    const hash1 = ApiKeyService.hashKey(rawKey);
    const hash2 = ApiKeyService.hashKey(rawKey);

    assert.strictEqual(typeof hash1, 'string');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hex string should be 64 characters long');
    assert.strictEqual(hash1, hash2, 'Identical keys should produce identical hashes');

    const differentRawKey = 'crm_live_88881234567890abcdef1234567890abcdef12345678';
    const hash3 = ApiKeyService.hashKey(differentRawKey);
    assert.notStrictEqual(hash1, hash3, 'Different keys must produce distinct hashes');
  });

  // 2. Safe Masking & Preview Formatting
  await it('should correctly mask raw keys for safe UI previews', () => {
    const rawKey = 'crm_live_9f8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e';
    const masked = ApiKeyService.maskKey(rawKey);

    assert.strictEqual(masked.startsWith('crm_live_'), true);
    assert.strictEqual(masked.includes('...'), true);
    assert.strictEqual(masked.length, 13 + 3 + 4, 'Mask should contain prefix, ellipsis, and last 4 characters');
    assert.strictEqual(masked.endsWith(rawKey.slice(-4)), true);
  });

  // 3. One-Time Secret Generation & DB Zero Raw Storage
  await it('should generate a secure key, store only hash, and return raw key once', async () => {
    const mockDb = new Map();
    const mockAudits = [];

    // Mock ApiKey.create
    const origCreate = ApiKey.create;
    const origAuditCreate = ApiKeyAuditLog.create;

    ApiKey.create = async function(doc) {
      const record = {
        ...doc,
        _id: '507f1f77bcf86cd799439011',
        save: async function() { return this; },
        toObject: function() { return this; }
      };
      mockDb.set(doc.keyHash, record);
      return record;
    };
    ApiKeyAuditLog.create = async function(doc) {
      mockAudits.push(doc);
      return doc;
    };

    try {
      const result = await ApiKeyService.generateApiKey({
        name: 'Stripe Webhook Sync Key',
        organizationId: '507f1f77bcf86cd799439011',
        organizationName: 'Test Organization Inc.',
        createdBy: 'admin@test.com',
        permissions: ['leads:read', 'leads:write'],
        rateLimitPerMinute: 300,
        ipWhitelist: ['192.168.1.1', '10.0.0.1'],
        expiresAt: new Date(Date.now() + 30 * 86400000)
      });

      assert.ok(result.rawKey, 'Raw key must be returned to client upon creation');
      assert.ok(result.rawKey.startsWith('crm_live_'), 'Raw key must have crm_live_ prefix');
      assert.ok(result.apiKey, 'Key record must be returned');
      assert.strictEqual(result.apiKey.name, 'Stripe Webhook Sync Key');
      assert.strictEqual(result.apiKey.status, 'ACTIVE');

      // Verify that the database only holds the hash, NOT the raw secret
      const stored = mockDb.get(result.apiKey.keyHash);
      assert.ok(stored, 'Stored record must exist in DB');
      assert.strictEqual(stored.key, undefined, 'Raw key property must NEVER be stored on schema');
      assert.strictEqual(stored.rawKey, undefined, 'Raw key property must NEVER be stored on schema');
      assert.strictEqual(stored.keyHash, ApiKeyService.hashKey(result.rawKey), 'Stored hash must match HMAC of raw key');

      // Check audit log
      assert.strictEqual(mockAudits.length, 1);
      assert.strictEqual(mockAudits[0].action, 'KEY_CREATED');
      assert.strictEqual(mockAudits[0].keyPrefix, stored.keyPrefix);
    } finally {
      ApiKey.create = origCreate;
      ApiKeyAuditLog.create = origAuditCreate;
    }
  });

  // 4. Key Validation - Successful Active Key
  await it('should validate an active key with correct credentials and update telemetry', async () => {
    const rawKey = 'crm_live_valid_test_key_secret_123456789012345678901234';
    const keyHash = ApiKeyService.hashKey(rawKey);

    const mockRecord = {
      _id: '507f1f77bcf86cd799439011',
      keyId: 'ak_test_active_1',
      name: 'Valid Active Key',
      organizationId: '507f1f77bcf86cd799439011',
      organizationName: 'Acme Corp',
      keyPrefix: ApiKeyService.maskKey(rawKey),
      keyHash: keyHash,
      status: 'ACTIVE',
      permissions: ['leads:read', 'leads:write', 'campaigns:read'],
      rateLimitPerMinute: 60,
      ipWhitelist: [],
      expiresAt: new Date(Date.now() + 86400000), // 1 day in future
      totalRequests: 10,
      dailyRequests: 5,
      monthlyRequests: 10,
      lastUsedIp: '1.2.3.4',
      save: async function() { return this; }
    };

    const origFindOne = ApiKey.findOne;
    const origUpdateOne = ApiKey.updateOne;
    ApiKey.findOne = async function(query) {
      if (query.keyHash === keyHash) return mockRecord;
      return null;
    };
    ApiKey.updateOne = async function() { return { acknowledged: true }; };

    try {
      const validation = await ApiKeyService.validateApiKey(rawKey, {
        ip: '1.2.3.4',
        userAgent: 'PostmanRuntime/7.29.0',
        endpoint: '/api/v1/leads'
      });

      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.apiKey.status, 'ACTIVE');
      assert.strictEqual(validation.permissions.includes('leads:read'), true);
    } finally {
      ApiKey.findOne = origFindOne;
      ApiKey.updateOne = origUpdateOne;
    }
  });

  // 5. Key Validation - Reject Invalid / Unknown Keys
  await it('should reject unknown or tampered API keys with INVALID_KEY', async () => {
    const origFindOne = ApiKey.findOne;
    ApiKey.findOne = async function() { return null; };

    try {
      const validation = await ApiKeyService.validateApiKey('crm_live_invalid_key_999999999999');
      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.code, 'INVALID_KEY');
      assert.strictEqual(validation.message, 'Invalid or unrecognized API Key');
    } finally {
      ApiKey.findOne = origFindOne;
    }
  });

  // 6. Key Validation - Reject Revoked Keys & Track Failed Auth
  await it('should reject revoked keys with KEY_REVOKED status and log failed auth', async () => {
    const rawKey = 'crm_live_revoked_key_123456789012345678901234';
    const keyHash = ApiKeyService.hashKey(rawKey);

    const mockRecord = {
      _id: '507f1f77bcf86cd799439011',
      keyId: 'ak_test_revoked_1',
      name: 'Revoked Key',
      keyHash: keyHash,
      status: 'REVOKED',
      failedAuthCount: 2,
      save: async function() { return this; }
    };

    const origFindOne = ApiKey.findOne;
    const origUpdateOne = ApiKey.updateOne;
    const origAuditCreate = ApiKeyAuditLog.create;
    const origAlertFindOne = ApiKeySecurityAlert.findOne;
    const origAlertCreate = ApiKeySecurityAlert.create;
    ApiKey.findOne = async function() { return mockRecord; };
    ApiKey.updateOne = async function() { return { acknowledged: true }; };
    ApiKeyAuditLog.create = async function(doc) { return doc; };
    ApiKeySecurityAlert.findOne = async function() { return null; };
    ApiKeySecurityAlert.create = async function(doc) { return doc; };

    try {
      const validation = await ApiKeyService.validateApiKey(rawKey, { ip: '5.6.7.8' });
      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.code, 'KEY_REVOKED');
    } finally {
      ApiKey.findOne = origFindOne;
      ApiKey.updateOne = origUpdateOne;
      ApiKeyAuditLog.create = origAuditCreate;
      ApiKeySecurityAlert.findOne = origAlertFindOne;
      ApiKeySecurityAlert.create = origAlertCreate;
    }
  });

  // 7. Key Validation - Reject Suspended Keys
  await it('should reject suspended keys with KEY_SUSPENDED status', async () => {
    const rawKey = 'crm_live_suspended_key_123456789012345678901234';
    const keyHash = ApiKeyService.hashKey(rawKey);

    const mockRecord = {
      _id: '507f1f77bcf86cd799439011',
      keyId: 'ak_test_suspended_1',
      name: 'Suspended Key',
      keyHash: keyHash,
      status: 'SUSPENDED',
      failedAuthCount: 0,
      save: async function() { return this; }
    };

    const origFindOne = ApiKey.findOne;
    const origUpdateOne = ApiKey.updateOne;
    const origAuditCreate = ApiKeyAuditLog.create;
    ApiKey.findOne = async function() { return mockRecord; };
    ApiKey.updateOne = async function() { return { acknowledged: true }; };
    ApiKeyAuditLog.create = async function(doc) { return doc; };

    try {
      const validation = await ApiKeyService.validateApiKey(rawKey);
      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.code, 'KEY_SUSPENDED');
    } finally {
      ApiKey.findOne = origFindOne;
      ApiKey.updateOne = origUpdateOne;
      ApiKeyAuditLog.create = origAuditCreate;
    }
  });

  // 8. Key Validation - Reject Expired Keys & Auto-update Status
  await it('should reject expired keys and update status to KEY_EXPIRED', async () => {
    const rawKey = 'crm_live_expired_key_123456789012345678901234';
    const keyHash = ApiKeyService.hashKey(rawKey);

    const mockRecord = {
      _id: '507f1f77bcf86cd799439011',
      keyId: 'ak_test_expired_1',
      name: 'Expired Key',
      keyHash: keyHash,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      failedAuthCount: 0,
      save: async function() { return this; }
    };

    const origFindOne = ApiKey.findOne;
    const origUpdateOne = ApiKey.updateOne;
    const origAuditCreate = ApiKeyAuditLog.create;
    ApiKey.findOne = async function() { return mockRecord; };
    ApiKey.updateOne = async function() { return { acknowledged: true }; };
    ApiKeyAuditLog.create = async function(doc) { return doc; };

    try {
      const validation = await ApiKeyService.validateApiKey(rawKey);
      assert.strictEqual(validation.valid, false);
      assert.strictEqual(validation.code, 'KEY_EXPIRED');
      assert.strictEqual(mockRecord.status, 'EXPIRED', 'Status should auto-update to EXPIRED');
    } finally {
      ApiKey.findOne = origFindOne;
      ApiKey.updateOne = origUpdateOne;
      ApiKeyAuditLog.create = origAuditCreate;
    }
  });

  // 9. IP Whitelist Enforcement
  await it('should enforce IP whitelist and reject non-matching source IPs', async () => {
    const rawKey = 'crm_live_ip_whitelist_key_123456789012345678901234';
    const keyHash = ApiKeyService.hashKey(rawKey);

    const mockRecord = {
      _id: '507f1f77bcf86cd799439011',
      keyId: 'ak_test_ip_1',
      name: 'IP Restricted Key',
      keyHash: keyHash,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 86400000),
      ipWhitelist: ['192.168.1.100', '10.0.0.50'],
      totalRequests: 0,
      failedAuthCount: 0,
      rateLimitPerMinute: 100,
      save: async function() { return this; }
    };

    const origFindOne = ApiKey.findOne;
    const origUpdateOne = ApiKey.updateOne;
    const origAuditCreate = ApiKeyAuditLog.create;
    ApiKey.findOne = async function() { return mockRecord; };
    ApiKey.updateOne = async function() { return { acknowledged: true }; };
    ApiKeyAuditLog.create = async function(doc) { return doc; };

    try {
      // 1. Allowed IP
      const pass = await ApiKeyService.validateApiKey(rawKey, { ip: '192.168.1.100' });
      assert.strictEqual(pass.valid, true);

      // 2. Blocked IP
      const blocked = await ApiKeyService.validateApiKey(rawKey, { ip: '203.0.113.195' });
      assert.strictEqual(blocked.valid, false);
      assert.strictEqual(blocked.code, 'IP_NOT_AUTHORIZED');
    } finally {
      ApiKey.findOne = origFindOne;
      ApiKey.updateOne = origUpdateOne;
      ApiKeyAuditLog.create = origAuditCreate;
    }
  });

  // 10. Sliding Window Rate Limiting
  await it('should enforce sliding-window rate limits and reject bursts exceeding quota', async () => {
    const rawKey = 'crm_live_rate_limit_key_123456789012345678901234';
    const keyHash = ApiKeyService.hashKey(rawKey);

    const mockRecord = {
      _id: '507f1f77bcf86cd799439011',
      keyId: 'ak_test_ratelimit_unique_1',
      name: 'Rate Limited Key',
      keyHash: keyHash,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 86400000),
      ipWhitelist: [],
      rateLimitPerMinute: 3, // 3 requests per minute
      totalRequests: 0,
      rateLimitViolationsCount: 0,
      save: async function() { return this; }
    };

    const origFindOne = ApiKey.findOne;
    const origUpdateOne = ApiKey.updateOne;
    const origAuditCreate = ApiKeyAuditLog.create;
    ApiKey.findOne = async function() { return mockRecord; };
    ApiKey.updateOne = async function() { return { acknowledged: true }; };
    ApiKeyAuditLog.create = async function(doc) { return doc; };

    try {
      // Send 3 valid requests
      for (let i = 0; i < 3; i++) {
        const res = await ApiKeyService.validateApiKey(rawKey);
        assert.strictEqual(res.valid, true, `Request ${i + 1} should succeed within rate limit`);
      }

      // 4th request should be rate-limited
      const throttled = await ApiKeyService.validateApiKey(rawKey);
      assert.strictEqual(throttled.valid, false);
      assert.strictEqual(throttled.code, 'RATE_LIMIT_EXCEEDED');
    } finally {
      ApiKey.findOne = origFindOne;
      ApiKey.updateOne = origUpdateOne;
      ApiKeyAuditLog.create = origAuditCreate;
    }
  });

  // 11. Permission Scope Verification
  await it('should correctly verify permission scopes and wildcards', () => {
    // 1. Specific scope match
    const middleware1 = requireApiKeyScope('leads:write');
    let allowed = false;
    let forbidden = false;

    middleware1(
      { apiKey: { permissions: ['leads:read', 'leads:write'] } },
      { status: () => ({ json: () => { forbidden = true; } }) },
      () => { allowed = true; }
    );
    assert.strictEqual(allowed, true);
    assert.strictEqual(forbidden, false);

    // 2. Missing scope
    allowed = false;
    forbidden = false;
    middleware1(
      { apiKey: { permissions: ['leads:read'] } },
      { status: (code) => { assert.strictEqual(code, 403); return { json: () => { forbidden = true; } }; } },
      () => { allowed = true; }
    );
    assert.strictEqual(allowed, false);
    assert.strictEqual(forbidden, true);

    // 3. Full access wildcard
    allowed = false;
    forbidden = false;
    middleware1(
      { apiKey: { permissions: ['full_access'] } },
      { status: () => ({ json: () => { forbidden = true; } }) },
      () => { allowed = true; }
    );
    assert.strictEqual(allowed, true);
    assert.strictEqual(forbidden, false);
  });

  // 12. Key Rotation Lifecycle & Old Key Invalidation
  await it('should rotate an API key, issue new raw secret once, and invalidate old secret', async () => {
    const oldRawKey = 'crm_live_old_key_secret_123456789012345678901234';
    const oldHash = ApiKeyService.hashKey(oldRawKey);

    const mockKeyRecord = {
      _id: '507f1f77bcf86cd799439011',
      keyId: 'ak_rotate_test_1',
      name: 'Production Sync Token',
      organizationId: '507f1f77bcf86cd799439011',
      keyPrefix: ApiKeyService.maskKey(oldRawKey),
      keyHash: oldHash,
      status: 'ACTIVE',
      permissions: ['leads:read'],
      rotationHistory: [],
      save: async function() { return this; }
    };

    const origFindOne = ApiKey.findOne;
    const origAuditCreate = ApiKeyAuditLog.create;

    ApiKey.findOne = async function(query) {
      if (query.keyId === 'ak_rotate_test_1' || query.$or) return mockKeyRecord;
      return null;
    };
    ApiKeyAuditLog.create = async function(doc) { return doc; };

    try {
      const rotationResult = await ApiKeyService.rotateApiKey('ak_rotate_test_1', 'lead_dev@apex.com');

      assert.ok(rotationResult.newRawKey, 'New raw key secret must be returned upon rotation');
      assert.notStrictEqual(rotationResult.newRawKey, oldRawKey, 'New key must differ from old key');
      assert.strictEqual(mockKeyRecord.rotationHistory.length, 1, 'Rotation history entry should be recorded');
      assert.strictEqual(mockKeyRecord.rotationHistory[0].previousPrefix, ApiKeyService.maskKey(oldRawKey));
      assert.strictEqual(mockKeyRecord.keyHash, ApiKeyService.hashKey(rotationResult.newRawKey), 'Key record hash must be updated to new key');

      // Attempting validation with old raw key should now fail
      ApiKey.findOne = async function(query) {
        if (query.keyHash === mockKeyRecord.keyHash) return mockKeyRecord;
        return null; // Old hash is no longer in DB
      };

      const oldKeyValidation = await ApiKeyService.validateApiKey(oldRawKey);
      assert.strictEqual(oldKeyValidation.valid, false, 'Old raw key must be immediately invalid after rotation');

      // Validating with new raw key must succeed
      const newKeyValidation = await ApiKeyService.validateApiKey(rotationResult.newRawKey);
      assert.strictEqual(newKeyValidation.valid, true, 'New raw key must validate successfully');
    } finally {
      ApiKey.findOne = origFindOne;
      ApiKeyAuditLog.create = origAuditCreate;
    }
  });

  // 13. Security Anomaly Detection - Excessive Requests Alert
  await it('should detect excessive rate limit violations and trigger security alerts', async () => {
    const rawKey = 'crm_live_excessive_req_test_123456789012345678901234';
    const keyHash = ApiKeyService.hashKey(rawKey);

    const generatedAlerts = [];
    const origAlertFindOne = ApiKeySecurityAlert.findOne;
    const origAlertCreate = ApiKeySecurityAlert.create;
    ApiKeySecurityAlert.findOne = async function() { return null; };
    ApiKeySecurityAlert.create = async function(doc) {
      generatedAlerts.push(doc);
      return doc;
    };

    const mockRecord = {
      _id: '507f1f77bcf86cd799439011',
      keyId: 'ak_excessive_req_1',
      name: 'Global Edutech API',
      organizationId: '507f1f77bcf86cd799439011',
      organizationName: 'Global Edutech',
      keyPrefix: ApiKeyService.maskKey(rawKey),
      keyHash: keyHash,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 86400000),
      ipWhitelist: [],
      rateLimitPerMinute: 2,
      rateLimitViolationsCount: 4, // 1 more violation will hit 5 and trigger alert
      save: async function() { return this; }
    };

    const origFindOne = ApiKey.findOne;
    const origAuditCreate = ApiKeyAuditLog.create;
    ApiKey.findOne = async function() { return mockRecord; };
    ApiKeyAuditLog.create = async function(doc) { return doc; };

    try {
      // Exceed rate limit repeatedly to hit violation threshold
      await ApiKeyService.validateApiKey(rawKey);
      await ApiKeyService.validateApiKey(rawKey);
      await ApiKeyService.validateApiKey(rawKey);

      assert.ok(generatedAlerts.length >= 1, 'Security alert should be generated when violations hit multiple of 5');
      assert.strictEqual(generatedAlerts[0].alertType, 'EXCESSIVE_REQUESTS');
      assert.strictEqual(generatedAlerts[0].severity, 'HIGH');
    } finally {
      ApiKey.findOne = origFindOne;
      ApiKeySecurityAlert.findOne = origAlertFindOne;
      ApiKeySecurityAlert.create = origAlertCreate;
      ApiKeyAuditLog.create = origAuditCreate;
    }
  });

  // 14. Key Revocation Lifecycle
  await it('should revoke an API key and update audit trail', async () => {
    const mockRecord = {
      keyId: 'ak_revoke_1',
      name: 'Key To Revoke',
      status: 'ACTIVE',
      save: async function() { return this; }
    };

    const origFindOne = ApiKey.findOne;
    const origAuditCreate = ApiKeyAuditLog.create;
    let auditAction = null;

    ApiKey.findOne = async function() { return mockRecord; };
    ApiKeyAuditLog.create = async function(doc) { auditAction = doc.action; return doc; };

    try {
      const res = await ApiKeyService.revokeApiKey('ak_revoke_1', 'security_officer@crm.com', 'Compromised token');
      assert.strictEqual(res.status, 'REVOKED');
      assert.strictEqual(mockRecord.status, 'REVOKED');
      assert.strictEqual(auditAction, 'KEY_REVOKED');
    } finally {
      ApiKey.findOne = origFindOne;
      ApiKeyAuditLog.create = origAuditCreate;
    }
  });

  // 15. Key Suspension & Reactivation Lifecycle
  await it('should suspend and reactivate an API key', async () => {
    const mockRecord = {
      keyId: 'ak_suspend_reactivate_1',
      name: 'Key For Temp Hold',
      status: 'ACTIVE',
      save: async function() { return this; }
    };

    const origFindOne = ApiKey.findOne;
    const origAuditCreate = ApiKeyAuditLog.create;
    ApiKey.findOne = async function() { return mockRecord; };
    ApiKeyAuditLog.create = async function(doc) { return doc; };

    try {
      // 1. Suspend
      const suspended = await ApiKeyService.suspendApiKey('ak_suspend_reactivate_1', 'billing@crm.com', 'Payment failure hold');
      assert.strictEqual(suspended.status, 'SUSPENDED');
      assert.strictEqual(mockRecord.status, 'SUSPENDED');

      // 2. Reactivate
      const reactivated = await ApiKeyService.reactivateApiKey('ak_suspend_reactivate_1', 'admin@crm.com');
      assert.strictEqual(reactivated.status, 'ACTIVE');
      assert.strictEqual(mockRecord.status, 'ACTIVE');
    } finally {
      ApiKey.findOne = origFindOne;
      ApiKeyAuditLog.create = origAuditCreate;
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
