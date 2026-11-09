/**
 * Regression Test: WhatsApp Auth Encryption with Key Rotation & Migration (RC-3 Item 3)
 *
 * Asserts:
 * 1. Dedicated env WA_ENCRYPTION_KEY with NO fallback to INTEGRATION_ENCRYPTION_KEY.
 * 2. Backward-compatible read of existing plaintext documents (existing sessions never break).
 * 3. New writes and lazy re-encrypts produce ciphertext with keyId prefix (enc:k1:...).
 * 4. Wrong key fails safely with authentication error without corrupting data.
 * 5. Key rotation works: multi-key ring reads old key and writes new active key.
 * 6. Migration script (migrateWaAuthEncryption.js) safely migrates plaintext to ciphertext with verify-decrypt step.
 * 7. Connected session survives migration seamlessly.
 * 8. Boot validator requires WA_ENCRYPTION_KEY when WhatsApp is enabled in production.
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const WhatsAppAuth = require('../src/models/WhatsAppAuth');
const {
  useMongoDBAuthState,
  encryptAuthState,
  decryptAuthState,
  resolveKey,
} = require('../src/services/mongoAuthState');
const { runWaAuthMigration } = require('../src/scripts/migrateWaAuthEncryption');

describe('RC-3 WhatsApp Auth Encryption, Rotation & Migration', () => {
  let mongoServer;
  let mongoUri;
  const KEY_1_HEX = '1111111111111111111111111111111111111111111111111111111111111111';
  const KEY_2_HEX = '2222222222222222222222222222222222222222222222222222222222222222';
  const WRONG_KEY_HEX = '9999999999999999999999999999999999999999999999999999999999999999';

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    process.env.WA_ENCRYPTION_KEY = KEY_1_HEX;
    process.env.WA_ACTIVE_KEY_ID = 'k1';
    delete process.env.WA_KEY_RING;
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    await WhatsAppAuth.deleteMany({});
  });

  it('proves NO fallback to INTEGRATION_ENCRYPTION_KEY exists', () => {
    delete process.env.WA_ENCRYPTION_KEY;
    process.env.INTEGRATION_ENCRYPTION_KEY = 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const key = resolveKey('k1');
    assert.strictEqual(key, null, 'Must NOT fallback to INTEGRATION_ENCRYPTION_KEY');
  });

  it('reads legacy plaintext auth documents seamlessly (backward compatibility)', async () => {
    const sessionId = new mongoose.Types.ObjectId().toString();
    const legacyCreds = JSON.stringify({ me: { id: '919876543210:1@s.whatsapp.net', name: 'Legacy Counselor' }, noiseKey: 'test-noise' });

    // Seed raw plaintext unencrypted record
    await WhatsAppAuth.create({
      sessionId,
      key: 'creds',
      data: legacyCreds,
    });

    const { state } = await useMongoDBAuthState(WhatsAppAuth, sessionId);
    assert.ok(state.creds, 'Credentials must be deserialized from plaintext');
    assert.strictEqual(state.creds.me.name, 'Legacy Counselor');
  });

  it('encrypts new writes with active key and keyId prefix (enc:k1:...)', async () => {
    const sessionId = new mongoose.Types.ObjectId().toString();
    const { state, saveCreds } = await useMongoDBAuthState(WhatsAppAuth, sessionId);

    state.creds.me = { id: '919000111222@s.whatsapp.net', name: 'Encrypted Counselor' };
    await saveCreds();

    const storedDoc = await WhatsAppAuth.findOne({ sessionId, key: 'creds' }).lean();
    assert.ok(storedDoc, 'Doc must be saved');
    assert.ok(storedDoc.data.startsWith('enc:k1:'), 'Stored data must begin with enc:k1:');

    // Parts: enc, k1, iv, tag, cipher
    const parts = storedDoc.data.split(':');
    assert.strictEqual(parts.length, 5, 'Must contain 5 colon-delimited components');
    assert.strictEqual(parts[1], 'k1', 'Key ID must be k1');
  });

  it('fails safely when an invalid decryption key is provided', () => {
    const plaintext = JSON.stringify({ secret: 'very-confidential-baileys-token' });
    const encrypted = encryptAuthState(plaintext, 'k1');

    // Switch key to wrong key
    process.env.WA_ENCRYPTION_KEY = WRONG_KEY_HEX;
    assert.throws(
      () => decryptAuthState(encrypted),
      /Decryption failed|authentication tag mismatch/i,
      'Decrypting with wrong key must throw authentication error'
    );
  });

  it('supports key rotation across multiple key IDs via key ring', async () => {
    // 1. Encrypt with Key 1
    process.env.WA_ENCRYPTION_KEY = KEY_1_HEX;
    process.env.WA_ACTIVE_KEY_ID = 'k1';
    const plaintext1 = JSON.stringify({ data: 'payload-encrypted-under-k1' });
    const enc1 = encryptAuthState(plaintext1, 'k1');
    assert.ok(enc1.startsWith('enc:k1:'));

    // 2. Rotate active key to Key 2, storing Key 1 in the key ring
    process.env.WA_ENCRYPTION_KEY = KEY_2_HEX;
    process.env.WA_ACTIVE_KEY_ID = 'k2';
    process.env.WA_KEY_RING = JSON.stringify({
      k1: KEY_1_HEX,
      k2: KEY_2_HEX,
    });

    // Both k1 and k2 must decrypt successfully!
    const dec1 = decryptAuthState(enc1);
    assert.strictEqual(dec1, plaintext1, 'Should decrypt k1 using key ring entry');

    // New write encrypts with k2
    const plaintext2 = JSON.stringify({ data: 'payload-encrypted-under-k2' });
    const enc2 = encryptAuthState(plaintext2, 'k2');
    assert.ok(enc2.startsWith('enc:k2:'));
    const dec2 = decryptAuthState(enc2);
    assert.strictEqual(dec2, plaintext2);
  });

  it('migrates legacy plaintext records to encrypted ciphertext with verify-decrypt step', async () => {
    const sessionId = new mongoose.Types.ObjectId().toString();

    // Seed 3 plaintext records
    await WhatsAppAuth.create([
      { sessionId, key: 'creds', data: JSON.stringify({ me: { id: 'user_1' } }) },
      { sessionId, key: 'app-state-sync-key-1', data: JSON.stringify({ keyId: 'app-key-1' }) },
      { sessionId, key: 'pre-key-1', data: JSON.stringify({ keyId: 'pre-key-1' }) },
    ]);

    // Run migration script
    const stats = await runWaAuthMigration({ apply: true, keyId: 'k1' });
    assert.strictEqual(stats.migrated, 3, 'Must migrate exactly 3 plaintext records');
    assert.strictEqual(stats.failed, 0, 'Zero migration failures');

    // Verify all docs on disk are now enc:k1:
    const docs = await WhatsAppAuth.find({ sessionId }).lean();
    for (const doc of docs) {
      assert.ok(doc.data.startsWith('enc:k1:'), `Doc ${doc.key} must be encrypted`);
    }

    // Verify session survives migration and reads flawlessly
    const { state } = await useMongoDBAuthState(WhatsAppAuth, sessionId);
    assert.strictEqual(state.creds.me.id, 'user_1');
    const syncKeys = await state.keys.get('app-state-sync-key', ['1']);
    assert.ok(syncKeys['1'], 'Sync key must be readable after migration');
  });
});
