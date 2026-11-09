const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const crypto = require('crypto');

/**
 * Key ring resolution for key rotation.
 * Active key ID defaults to process.env.WA_ACTIVE_KEY_ID || 'k1'.
 * Active key is read exclusively from process.env.WA_ENCRYPTION_KEY (NO fallback to INTEGRATION_ENCRYPTION_KEY).
 * Historical/rotated keys can be provided via process.env.WA_KEY_RING (JSON: {"k1":"...", "k2":"..."})
 * or process.env[`WA_ENCRYPTION_KEY_${keyId.toUpperCase()}`].
 */
const getActiveKeyId = () => (process.env.WA_ACTIVE_KEY_ID || 'k1').trim();

function deriveKey(rawKey) {
  if (!rawKey) return null;
  const trimmed = String(rawKey).trim();
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  if (Buffer.byteLength(trimmed, 'utf8') === 32) {
    return Buffer.from(trimmed, 'utf8');
  }
  return crypto.createHash('sha256').update(trimmed, 'utf8').digest();
}

function resolveKey(keyId) {
  const activeId = getActiveKeyId();
  const targetId = keyId || activeId;

  // If requesting the current active keyId
  if (targetId === activeId) {
    const activeRaw = (process.env.WA_ENCRYPTION_KEY || '').trim();
    if (activeRaw) return deriveKey(activeRaw);
  }

  // Check key ring JSON
  if (process.env.WA_KEY_RING) {
    try {
      const ring = JSON.parse(process.env.WA_KEY_RING);
      if (ring && ring[targetId]) return deriveKey(ring[targetId]);
    } catch {}
  }

  // Check specific environment variable by key ID, e.g. WA_ENCRYPTION_KEY_K1 or WA_ENCRYPTION_KEY_OLD
  const specificEnv = process.env[`WA_ENCRYPTION_KEY_${targetId.toUpperCase()}`];
  if (specificEnv) return deriveKey(specificEnv);

  // Fallback for legacy 'v1' records if not explicitly specified in key ring
  if (targetId === 'v1') {
    const activeRaw = (process.env.WA_ENCRYPTION_KEY || '').trim();
    if (activeRaw) return deriveKey(activeRaw);
  }

  return null;
}

/**
 * Encrypts a serialized auth string with AES-256-GCM.
 * Output format: enc:<keyId>:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
function encryptAuthState(plaintext, keyId = null) {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;
  const targetKeyId = keyId || getActiveKeyId();
  const key = resolveKey(targetKeyId);
  if (!key) {
    // If no key is configured in dev/test, return plaintext
    return plaintext;
  }

  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `enc:${targetKeyId}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

/**
 * Decrypts an AES-256-GCM encrypted auth string.
 * Format: enc:<keyId>:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 * Transparently falls back to plaintext if the string does not have the enc: prefix.
 */
function decryptAuthState(storedData) {
  if (!storedData || typeof storedData !== 'string') return storedData;
  if (!storedData.startsWith('enc:')) {
    // Unencrypted legacy format (backward compatibility)
    return storedData;
  }

  const parts = storedData.split(':');
  if (parts.length !== 5) {
    throw new Error('Malformed encrypted auth state token: expected 5 colon-delimited components');
  }

  const [, keyId, ivHex, tagHex, cipherHex] = parts;
  const key = resolveKey(keyId);
  if (!key) {
    const err = new Error(`Cannot decrypt WhatsApp auth state: encryption key for keyId "${keyId}" not found in WA_ENCRYPTION_KEY or key ring`);
    err.code = 'WA_KEY_NOT_FOUND';
    err.keyId = keyId;
    throw err;
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (decErr) {
    const err = new Error(`Decryption failed for keyId "${keyId}": authentication tag mismatch or corrupted ciphertext`);
    err.code = 'WA_DECRYPT_FAILED';
    err.originalError = decErr.message;
    throw err;
  }
}

/**
 * Custom High-Performance MongoDB Auth State Adapter for Baileys
 * 
 * Implements:
 * 1. AES-256-GCM at-rest credential encryption with keyId rotation & backward-compatible plaintext read.
 * 2. BufferJSON serialization & deserialization for cryptographic keys.
 * 3. Protobuf app-state-sync-key object rehydration to prevent state sync crashes.
 * 4. Batch find in keys.get to eliminate round-trip latency.
 * 5. Atomic bulkWrite in keys.set for fast, non-blocking key persistence.
 * 6. Lazy re-encrypt on write: updates automatically re-encrypt legacy plaintext records to the active key.
 */
const useMongoDBAuthState = async (modelOrCollection, sessionId) => {
  const WhatsAppAuth = modelOrCollection;
  const sId = sessionId.toString();

  const writeData = async (key, data) => {
    try {
      const serialized = JSON.stringify(data, BufferJSON.replacer);
      const payload = encryptAuthState(serialized, getActiveKeyId());
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
          const dbKeys = ids.map((id) => {
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
          const activeKeyId = getActiveKeyId();
          for (const category in data) {
            for (const id in data[category]) {
              const key = `${category}-${id}`;
              const val = data[category][id];
              if (val) {
                try {
                  const serialized = JSON.stringify(val, BufferJSON.replacer);
                  const payload = encryptAuthState(serialized, activeKeyId);
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
  resolveKey,
  deriveKey,
  getActiveKeyId,
};
