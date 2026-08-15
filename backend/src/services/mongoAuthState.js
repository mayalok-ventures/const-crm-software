const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

/**
 * Custom MongoDB Auth State Adapter for Baileys
 * Persists WhatsApp sessions and crypto keys to MongoDB, surviving server/container restarts.
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
          await Promise.all(
            ids.map(async (id) => {
              const key = `${type}-${id}`;
              const val = await readData(key);
              if (val) data[id] = val;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const key = `${category}-${id}`;
              const val = data[category][id];
              if (val) {
                tasks.push(writeData(key, val));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => writeData('creds', creds),
    clearAuth: async () => {
      await WhatsAppAuth.deleteMany({ sessionId: sId });
    }
  };
};

module.exports = { useMongoDBAuthState };
