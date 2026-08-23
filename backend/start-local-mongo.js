const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');

async function startLocalMongo() {
  const dbDir = path.join(__dirname, 'data', 'db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log('🚀 Starting Local MongoDB Server on 127.0.0.1:27017...');

  const mongod = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbName: 'mobile-crm',
      dbPath: dbDir,
      storageEngine: 'wiredTiger',
    },
  });

  const uri = mongod.getUri();
  console.log(`\n======================================================`);
  console.log(`✅ LOCAL MONGODB SERVER IS RUNNING ON 127.0.0.1:27017!`);
  console.log(`Connection URI: mongodb://127.0.0.1:27017/mobile-crm`);
  console.log(`Database Name : mobile-crm`);
  console.log(`Data Directory: ${dbDir}`);
  console.log(`======================================================\n`);

  // Handle termination gracefully
  const shutdown = async () => {
    console.log('\nStopping Local MongoDB Server...');
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startLocalMongo().catch((err) => {
  console.error('❌ Failed to start local MongoDB:', err);
});
