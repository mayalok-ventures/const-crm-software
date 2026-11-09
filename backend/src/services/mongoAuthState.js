const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const crypto = require('crypto');

/**
 * Resolves the 32-byte encryption key for WhatsApp Auth State credentials.
 * Supports 64-char hex strings or arbitrary passphrases hashed via SHA-256.
 */
function getEncryptionKey() {
  const rawKey = (process.env.WA_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || process.env.INTEGRATION_ENCRYPTION_KEY || '').trim();
  if (!rawKey) return null;
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest();
}

/**
 * Encrypts a serialized auth string with AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
function encryptAuthState(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;
  const key = getEncryptionKey();
  if (!key) return plaintext; // Store unencrypted if no key configured

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

/**
 * Decrypts an AES-256-GCM encrypted auth string.
 * Transparently falls back to plaintext if the string does not have the enc:v1: prefix.
 */
function decryptAuthState(storedData) {
  if (!storedData || typeof storedData !== 'string') return storedData;
  if (!storedData.startsWith('enc:v1:')) {
    // Unencrypted legacy format (backward compatibility)
    return storedData;
  }

  const parts = storedData.split(':');
  if (parts.length !== 5) {
    throw new Error('Malformed encrypted auth state token');
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error('Encountered encrypted WhatsApp auth state but WA_ENCRYPTION_KEY is not configured');
  }

  const [, , ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Custom High-Performance MongoDB Auth State Adapter for Baileys
 * 
 * Implements:
 * 1. AES-256-GCM at-rest credential encryption with backward-compatible plaintext read fallback.
 * 2. BufferJSON serialization & deserialization for cryptographic keys.
 * 3. Protobuf app-state-sync-key object rehydration to prevent state sync crashes.
 * 4. Batch find in keys.get to eliminate round-trip latency.
 * 5. Atomic bulkWrite in keys.set for fast, non-blocking key persistence.
 * 6. Corrupted document resilience with safe try/catch error boundaries.
 */
const useMongoDBAuthState = async (modelOrCollection, sessionId) => {
  const WhatsAppAuth = modelOrCollection;
  const sId = sessionId.toString();

  const writeData = async (key, data) => {
    try {
      const serialized = JSON.stringify(data, BufferJSON.replacer);
      const payload = encryptAuthState(serialized);
      await WhatsAppAuth.findOneAndUpdate(
        { sessionId: sId, key },
        { $set: { data: payload } },
        { upsert: true }
      );
    } catch (err) {
      console.error(`[MongoAuth] Error writing key ${key} for session ${sId}:`, err.message);
    }
  };

  const readData = async (key) => {
    try {
      const doc = await WhatsAppAuth.findOne({ sessionId: sId, key }).lean();
      if (!doc || !doc.data) return null;
      const decrypted = decryptAuthState(doc.data);
      return JSON.parse(decrypted, BufferJSON.reviver);
    } catch (err) {
      console.error(`[MongoAuth] Error reading key ${key} for session ${sId}:`, err.message);
      return null;
    }
  };

  const removeData = async (key) => {
    try {
      await WhatsAppAuth.deleteOne({ sessionId: sId, key });
    } catch (err) {
      console.error(`[MongoAuth] Error deleting key ${key} for session ${sId}:`, err.message);
    }
  };

  const credsDoc = await readData('creds');
  const creds = credsDoc || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          if (!ids || ids.length === 0) return data;

          const keyMap = new Map();
          const dbKeys = ids.map(id => {
            const fullKey = `${type}-${id}`;
            keyMap.set(fullKey, id);
            return fullKey;
          });

          try {
            const docs = await WhatsAppAuth.find({
              sessionId: sId,
              key: { $in: dbKeys },
            }).lean();

            for (const doc of docs) {
              if (!doc || !doc.data) continue;
              const id = keyMap.get(doc.key);
              if (!id) continue;
              try {
                const decrypted = decryptAuthState(doc.data);
                let val = JSON.parse(decrypted, BufferJSON.reviver);
                if (type === 'app-state-sync-key' && val) {
                  val = proto.Message.AppStateSyncKeyData.fromObject(val);
                }
                data[id] = val;
              } catch (parseErr) {
                console.warn(`[MongoAuth] Failed to parse key ${doc.key}:`, parseErr.message);
              }
            }
          } catch (err) {
            console.error(`[MongoAuth] Error batch reading keys for ${sId} (${type}):`, err.message);
          }

          return data;
        },
        set: async (data) => {
          const bulkOps = [];
          for (const category in data) {
            for (const id in data[category]) {
              const key = `${category}-${id}`;
              const val = data[category][id];
              if (val) {
                try {
                  const serialized = JSON.stringify(val, BufferJSON.replacer);
                  const payload = encryptAuthState(serialized);
                  bulkOps.push({
                    updateOne: {
                      filter: { sessionId: sId, key },
                      update: { $set: { data: payload } },
                      upsert: true,
                    },
                  });
                } catch (serErr) {
                  console.error(`[MongoAuth] Serialization error for ${key}:`, serErr.message);
                }
              } else {
                bulkOps.push({
                  deleteOne: {
                    filter: { sessionId: sId, key },
                  },
                });
              }
            }
          }

          if (bulkOps.length > 0) {
            try {
              await WhatsAppAuth.bulkWrite(bulkOps, { ordered: false });
            } catch (err) {
              console.error(`[MongoAuth] Error in bulkWrite for ${sId}:`, err.message);
            }
          }
        },
      },
    },
    saveCreds: () => writeData('creds', creds),
    clearAuth: async () => {
      try {
        await WhatsAppAuth.deleteMany({ sessionId: sId });
      } catch (err) {
        console.error(`[MongoAuth] Error clearing auth for ${sId}:`, err.message);
      }
    },
  };
};

module.exports = {
  useMongoDBAuthState,
  encryptAuthState,
  decryptAuthState,
  getEncryptionKey,
};
