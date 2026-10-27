let MongoMemoryServer = null;
try {
  MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
} catch (_) {
  // Expected in production bundles where devDependencies are pruned
}
const net = require('net');
const { getDbPath, cleanLockFiles } = require('./getDbPath');

function isPortActive(port = 27017, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

let mongodInstance = null;

async function ensureLocalMongoRunning() {
  const active = await isPortActive(27017);
  if (active) {
    return true;
  }

  if (mongodInstance) {
    return true;
  }

  if (!MongoMemoryServer) {
    console.warn('[MongoDB] mongodb-memory-server not installed (pruned production container). Skipping local embedded MongoDB.');
    return false;
  }

  const dbDir = getDbPath();
  cleanLockFiles(dbDir);

  console.log('[MongoDB] Starting embedded local MongoDB engine on 127.0.0.1:27017...');
  try {
    mongodInstance = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbName: 'mobile-crm',
        dbPath: dbDir,
        storageEngine: 'wiredTiger',
      },
    });
  } catch (err) {
    console.warn('[MongoDB] WiredTiger retry:', err.message);
    cleanLockFiles(dbDir);
    try {
      mongodInstance = await MongoMemoryServer.create({
        instance: {
          port: 27017,
          dbName: 'mobile-crm',
          dbPath: dbDir,
          storageEngine: 'wiredTiger',
        },
      });
    } catch (err2) {
      console.warn('[MongoDB] In-memory fallback on port 27017:', err2.message);
      mongodInstance = await MongoMemoryServer.create({
        instance: {
          port: 27017,
          dbName: 'mobile-crm',
        },
      });
    }
  }

  console.log(`✅ [MongoDB] Embedded MongoDB running on 127.0.0.1:27017 (Data: ${dbDir})`);

  const shutdown = async () => {
    if (mongodInstance) {
      try {
        await mongodInstance.stop();
        mongodInstance = null;
      } catch (_) {}
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', shutdown);

  return true;
}

module.exports = { ensureLocalMongoRunning, isPortActive };
