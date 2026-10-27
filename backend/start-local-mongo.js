const { MongoMemoryServer } = require('mongodb-memory-server');
const net = require('net');
const path = require('path');
const { getDbPath, cleanLockFiles } = require('./src/config/getDbPath');

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

async function startLocalMongo() {
  const dbDir = getDbPath();
  const args = process.argv.slice(2);
  const isEnsureMode = args.includes('--ensure') || args.includes('--check') || args.includes('--daemon');

  // Check if port 27017 is already active
  const alreadyActive = await isPortActive(27017);
  if (alreadyActive) {
    console.log(`\n✅ Local MongoDB is already running on 127.0.0.1:27017`);
    console.log(`   Connection URI : mongodb://127.0.0.1:27017/mobile-crm`);
    console.log(`   Data Directory : ${dbDir}\n`);

    if (isEnsureMode) {
      process.exit(0);
    }

    // Keep process alive if invoked directly as long-running runner
    const keepAlive = setInterval(() => {}, 10000);
    process.on('SIGINT', () => { clearInterval(keepAlive); process.exit(0); });
    process.on('SIGTERM', () => { clearInterval(keepAlive); process.exit(0); });
    return;
  }

  // Clean stale lock files from previous unclean shutdowns
  cleanLockFiles(dbDir);

  console.log('🚀 Starting Local MongoDB Server on 127.0.0.1:27017...');
  console.log(`📂 Using Data Directory: ${dbDir}`);

  let mongod;
  try {
    mongod = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbName: 'mobile-crm',
        dbPath: dbDir,
        storageEngine: 'wiredTiger',
      },
    });
  } catch (err) {
    console.warn('⚠️ WiredTiger start failed, cleaning locks and retrying...', err.message);
    cleanLockFiles(dbDir);
    try {
      mongod = await MongoMemoryServer.create({
        instance: {
          port: 27017,
          dbName: 'mobile-crm',
          dbPath: dbDir,
          storageEngine: 'wiredTiger',
        },
      });
    } catch (err2) {
      console.warn('⚠️ Falling back to high-performance in-memory instance on port 27017...', err2.message);
      mongod = await MongoMemoryServer.create({
        instance: {
          port: 27017,
          dbName: 'mobile-crm',
        },
      });
    }
  }

  console.log(`\n======================================================`);
  console.log(`✅ LOCAL MONGODB SERVER IS RUNNING ON 127.0.0.1:27017!`);
  console.log(`Connection URI: mongodb://127.0.0.1:27017/mobile-crm`);
  console.log(`Database Name : mobile-crm`);
  console.log(`Data Directory: ${dbDir}`);
  console.log(`Compass Ready : Open MongoDB Compass and connect with preset`);
  console.log(`======================================================\n`);

  // Handle termination gracefully
  const shutdown = async () => {
    console.log('\nStopping Local MongoDB Server...');
    try {
      if (mongod) await mongod.stop();
    } catch {}
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  if (process.platform !== 'win32') {
    process.on('SIGHUP', shutdown);
  }

  // Keep process alive
  const keepAlive = setInterval(() => {}, 10000);
  process.on('exit', () => clearInterval(keepAlive));
}

startLocalMongo().catch((err) => {
  console.error('❌ Failed to start local MongoDB:', err);
  process.exit(1);
});
