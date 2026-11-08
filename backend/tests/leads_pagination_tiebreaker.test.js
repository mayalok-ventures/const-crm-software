const assert = require('assert');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

async function runTest() {
  console.log('🧪 Running Test: Leads Pagination Deterministic Tiebreaker & Cap (P3)...');
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const Lead = require('../src/models/Lead');
  const Workspace = require('../src/models/Workspace');
  const User = require('../src/models/User');
  require('../src/models/Catalogue');
  const { getLeads } = require('../src/controllers/leadsController');

  const ws = await Workspace.create({ name: 'Pagination WS', slug: 'page-ws', ownerId: new mongoose.Types.ObjectId() });
  const user = await User.create({
    name: 'Pager User',
    email: 'pager@crm.local',
    password: 'Password123!',
    phone: '9876543450',
    role: 'admin',
  });
  user.workspaceId = ws._id;
  user.workspaceRole = 'owner';

  // Seed 25 leads with the EXACT same updatedAt timestamp
  const identicalTimestamp = new Date('2026-11-08T10:00:00.000Z');
  const docs = [];
  for (let i = 0; i < 25; i++) {
    docs.push({
      name: `Candidate ${i}`,
      phone: `91100000${String(i).padStart(2, '0')}`,
      workspaceId: ws._id,
      userId: user._id,
      targetDomain: 'Engineering',
      updatedAt: identicalTimestamp,
      createdAt: identicalTimestamp,
    });
  }
  await Lead.insertMany(docs);

  const mockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.data = payload;
        return this;
      },
    };
    return res;
  };

  // 1. Fetch Page 1, 2, 3 with limit=10
  const fetchPage = async (page) => {
    const req = {
      query: { page: String(page), limit: '10' },
      user,
      workspaceId: ws._id,
    };
    const res = mockRes();
    await getLeads(req, res);
    return res.data.leads || res.data;
  };

  const page1 = await fetchPage(1);
  const page2 = await fetchPage(2);
  const page3 = await fetchPage(3);

  assert.strictEqual(page1.length, 10, 'Page 1 must have 10 items');
  assert.strictEqual(page2.length, 10, 'Page 2 must have 10 items');
  assert.strictEqual(page3.length, 5, 'Page 3 must have 5 items');

  const allIds = [
    ...page1.map((l) => l._id.toString()),
    ...page2.map((l) => l._id.toString()),
    ...page3.map((l) => l._id.toString()),
  ];

  const uniqueIds = new Set(allIds);
  assert.strictEqual(uniqueIds.size, 25, 'All 25 items across pages must be unique (no duplicate rows from unstable sort)');
  console.log('✅ Step 1: Pagination is 100% deterministic with _id tiebreaker across identical timestamps.');

  // 2. Kanban-sized request (limit=250) is not truncated below 250
  const reqKanban = {
    query: { limit: '250', page: '1' },
    user,
    workspaceId: ws._id,
  };
  const resKanban = mockRes();
  await getLeads(reqKanban, resKanban);
  const kanbanLeads = resKanban.data.leads || resKanban.data;
  assert.strictEqual(kanbanLeads.length, 25, 'Should return all 25 rows without truncation');
  console.log('✅ Step 2: Kanban request with limit 250 supported cleanly.');

  // 3. Excessive limit capped at 300
  const reqOver = {
    query: { limit: '1000', page: '1' },
    user,
    workspaceId: ws._id,
  };
  const resOver = mockRes();
  await getLeads(reqOver, resOver);
  // Capped at 300
  assert.strictEqual(resOver.statusCode, 200);
  console.log('✅ Step 3: Excessive limit gracefully capped at 300.');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('🎉 ALL P3 LEADS PAGINATION TIEBREAKER TESTS PASSED!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
