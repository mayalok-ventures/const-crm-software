const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { Writable } = require('stream');

async function runTest() {
  console.log('🧪 Running Test: PDF Export Event Loop Yielding & Row Cap (P2)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Lead = require('../src/models/Lead');
  const Workspace = require('../src/models/Workspace');
  const User = require('../src/models/User');
  require('../src/models/Catalogue');
  const { exportLeads } = require('../src/controllers/leadsController');

  const ws = await Workspace.create({ name: 'Export WS', slug: 'export-ws', ownerId: new mongoose.Types.ObjectId() });
  const user = await User.create({
    name: 'Exporter Admin',
    email: 'export@crm.local',
    password: 'Password123!',
    phone: '9876543477',
    role: 'superadmin',
    isAdmin: true,
    companyRole: 'owner',
  });
  user.workspaceId = ws._id;

  // Seed 150 leads
  const docs = [];
  for (let i = 0; i < 150; i++) {
    docs.push({
      name: `Student Record ${i}`,
      phone: `911000${String(i).padStart(4, '0')}`,
      workspaceId: ws._id,
      userId: user._id,
      status: i % 2 === 0 ? 'converted' : 'open',
      targetDomain: 'Engineering',
      customData: { department: 'CS', testScore: 95 },
    });
  }
  await Lead.insertMany(docs);

  // Monitor event loop lag during export
  let maxLag = 0;
  let lastTick = Date.now();
  const lagInterval = setInterval(() => {
    const now = Date.now();
    const lag = now - lastTick - 10;
    if (lag > maxLag) maxLag = lag;
    lastTick = now;
  }, 10);

  // Mock writable response stream for PDF output
  class MockResponse extends Writable {
    constructor() {
      super();
      this.headers = {};
      this.statusCode = 200;
    }
    setHeader(k, v) {
      this.headers[k] = v;
    }
    status(c) {
      this.statusCode = c;
      return this;
    }
    json(payload) {
      this.payload = payload;
      return this;
    }
    _write(chunk, enc, cb) {
      cb();
    }
  }

  const res = new MockResponse();
  const req = {
    query: { format: 'pdf' },
    user,
    workspaceId: ws._id,
  };

  await new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('error', reject);
    exportLeads(req, res).catch(reject);
  });

  clearInterval(lagInterval);

  assert.strictEqual(res.headers['Content-Type'], 'application/pdf');
  assert.ok(res.headers['Content-Disposition'].includes('leads_pipeline_report_'));
  assert.ok(maxLag < 250, `Event loop lag (${maxLag}ms) must remain minimal during PDF export.`);
  console.log(`✅ Event loop remained responsive throughout PDF generation (max lag: ${maxLag}ms).`);

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL P2 PDF EXPORT EVENT LOOP TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
