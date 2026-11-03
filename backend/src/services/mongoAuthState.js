const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');

/**
 * Custom High-Performance MongoDB Auth State Adapter for Baileys
 * 
 * Implements:
 * 1. BufferJSON serialization & deserialization for cryptographic keys.
 * 2. Protobuf app-state-sync-key object rehydration to prevent state sync crashes.
 * 3. Batch find in keys.get to eliminate round-trip latency.
 * 4. Atomic bulkWrite in keys.set for fast, non-blocking key persistence.
 * 5. Corrupted document resilience with safe try/catch error boundaries.
 */
const useMongoDBAuthState = async (modelOrCollection, sessionId) => {
  const WhatsAppAuth = modelOrCollection;
  const sId = sessionId.toString();

  const writeData = async (key, data) => {
    try {
      const serialized = JSON.stringify(data, BufferJSON.replacer);
      await WhatsAppAuth.findOneAndUpdate(
        { sessionId: sId, key },
        { $set: { data: serialized } },
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
      return JSON.parse(doc.data, BufferJSON.reviver);
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
                let val = JSON.parse(doc.data, BufferJSON.reviver);
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
                  bulkOps.push({
                    updateOne: {
                      filter: { sessionId: sId, key },
                      update: { $set: { data: serialized } },
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

module.exports = { useMongoDBAuthState };
