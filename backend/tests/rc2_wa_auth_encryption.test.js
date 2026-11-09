const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const crypto = require('crypto');
const assert = require('assert');
const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

describe('RC-2 WhatsApp Auth State AES-256-GCM Encryption', () => {
  let mongod;
  let WhatsAppAuth;
  const originalEnvKey = process.env.WA_ENCRYPTION_KEY;
  const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars = 32 bytes

  beforeAll(async () => {
    process.env.WA_ENCRYPTION_KEY = TEST_KEY;
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const WhatsAppAuthSchema = new mongoose.Schema({
      sessionId: { type: String, required: true },
      key: { type: String, required: true },
      data: { type: String, required: true },
    });
    WhatsAppAuthSchema.index({ sessionId: 1, key: 1 }, { unique: true });
    WhatsAppAuth = mongoose.models.WhatsAppAuth || mongoose.model('WhatsAppAuth', WhatsAppAuthSchema);
  });

  afterAll(async () => {
    process.env.WA_ENCRYPTION_KEY = originalEnvKey;
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should encrypt stored credentials with AES-256-GCM and prefix with enc:v1:', async () => {
    const { useMongoDBAuthState } = require('../src/services/mongoAuthState');
    const sessionId = 'test-session-encrypted-1';

    const auth = await useMongoDBAuthState(WhatsAppAuth, sessionId);
    await auth.saveCreds();

    const rawDoc = await WhatsAppAuth.findOne({ sessionId, key: 'creds' }).lean();
    assert.ok(rawDoc, 'Raw doc should be persisted');
    assert.ok(rawDoc.data.startsWith('enc:v1:') || rawDoc.data.startsWith('enc:k1:'), `Expected data to start with enc:v1: or enc:k1:, got: ${rawDoc.data.slice(0, 20)}`);

    const parts = rawDoc.data.split(':');
    assert.strictEqual(parts.length, 5, 'Encrypted format must be enc:v1:<iv>:<tag>:<ciphertext>');
    assert.strictEqual(parts[2].length, 24, 'IV hex must be 24 characters (12 bytes)');
    assert.strictEqual(parts[3].length, 32, 'Auth tag hex must be 32 characters (16 bytes)');
  });

  it('should transparently read and decrypt stored credentials and keys', async () => {
    const { useMongoDBAuthState } = require('../src/services/mongoAuthState');
    const sessionId = 'test-session-encrypted-2';

    const auth = await useMongoDBAuthState(WhatsAppAuth, sessionId);
    auth.state.creds.me = { id: '919876543210:1@s.whatsapp.net', name: 'Test Counselor' };
    await auth.saveCreds();

    // Store sample key
    await auth.state.keys.set({
      'app-state-sync-key': {
        'key-id-123': { keyData: Buffer.from('super-secret-sync-data') }
      }
    });

    // Rehydrate auth state in a fresh instance
    const rehydrated = await useMongoDBAuthState(WhatsAppAuth, sessionId);
    assert.ok(rehydrated.state.creds, 'Creds should rehydrate');
    assert.strictEqual(rehydrated.state.creds.me.name, 'Test Counselor');

    const fetchedKeys = await rehydrated.state.keys.get('app-state-sync-key', ['key-id-123']);
    assert.ok(fetchedKeys['key-id-123'], 'Key should rehydrate');
  });

  it('should support legacy unencrypted plaintext credentials without crashing (backward compatibility)', async () => {
    const { useMongoDBAuthState } = require('../src/services/mongoAuthState');
    const sessionId = 'test-session-legacy-plain';

    // Insert legacy plaintext document (simulating pre-existing deployment)
    const legacyCreds = initAuthCreds();
    legacyCreds.me = { id: '919111122223:1@s.whatsapp.net', name: 'Legacy Counselor' };
    const rawPlaintext = JSON.stringify(legacyCreds, BufferJSON.replacer);

    await WhatsAppAuth.create({
      sessionId,
      key: 'creds',
      data: rawPlaintext, // Unencrypted JSON string
    });

    const auth = await useMongoDBAuthState(WhatsAppAuth, sessionId);
    assert.ok(auth.state.creds, 'Legacy creds should be read without error');
    assert.strictEqual(auth.state.creds.me?.name, 'Legacy Counselor');
  });

  it('should reject tampered encrypted credentials cleanly', async () => {
    const { useMongoDBAuthState } = require('../src/services/mongoAuthState');
    const sessionId = 'test-session-tampered';

    const auth = await useMongoDBAuthState(WhatsAppAuth, sessionId);
    await auth.saveCreds();

    // Tamper with ciphertext in MongoDB
    const doc = await WhatsAppAuth.findOne({ sessionId, key: 'creds' });
    const parts = doc.data.split(':');
    // Flip bytes in ciphertext
    const tamperedCipher = 'ff' + parts[4].slice(2);
    doc.data = `enc:v1:${parts[2]}:${parts[3]}:${tamperedCipher}`;
    await doc.save();

    // Attempting to read tampered data should return fresh creds or catch error safely
    const freshAuth = await useMongoDBAuthState(WhatsAppAuth, sessionId);
    // Since tampered creds failed to decrypt, readData returned null, so fresh initAuthCreds() was used
    assert.ok(freshAuth.state.creds, 'Should fallback safely to fresh creds');
    assert.strictEqual(freshAuth.state.creds.me, undefined);
  });
});
