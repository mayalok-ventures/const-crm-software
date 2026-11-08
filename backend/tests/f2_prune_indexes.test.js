const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

let mongod;
let Lead;
const { REDUNDANT_INDEXES, pruneRedundantIndexes } = require('../src/scripts/pruneRedundantLeadIndexes');

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  Lead = require('../src/models/Lead');
  await Lead.init();
});

after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('F2.2: Lead Index Pruning and Schema Index Limit Compliance', () => {
  it('Lead schema defines 52 or fewer indexes, safely below the 64-index ceiling', () => {
    const indexes = Lead.schema.indexes();
    console.log(`Lead schema index count: ${indexes.length} (ceiling: 64)`);
    assert(indexes.length <= 52, `Expected <= 52 indexes on Lead schema, got ${indexes.length}`);
  });

  it('pruneRedundantIndexes defaults to dry-run mode and does not drop indexes', async () => {
    const res = await pruneRedundantIndexes(mongoose.connection, { apply: false });
    assert.strictEqual(res.mode, 'dry-run');
    assert.strictEqual(res.dropped.length, 0);
  });

  it('pruneRedundantIndexes successfully prunes redundant indexes in apply mode', async () => {
    const collection = mongoose.connection.collection('leads');
    // Ensure one redundant index exists so we can verify its dropping
    try {
      await collection.createIndex({ userId: 1, createdAt: -1 }, { name: 'userId_1_createdAt_-1' });
    } catch (_) {}

    const res = await pruneRedundantIndexes(mongoose.connection, { apply: true });
    assert.strictEqual(res.mode, 'apply');

    const remaining = await collection.listIndexes().toArray();
    const remainingNames = remaining.map((idx) => idx.name);
    assert(!remainingNames.includes('userId_1_createdAt_-1'), 'Dropped index must not exist in collection');
  });
});
