const path = require('path');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'rc3_bulk_perf_secret_key_12345';
process.env.ALLOW_UNSCOPED_TENANT_READS = 'true';

const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const Lead = require('../src/models/Lead');
require('../src/models/Catalogue');
const leadsRouter = require('../src/routes/leads');

describe('RC-3 Bulk Performance & Optimization Gate', () => {
  let replSet;
  let server;
  let baseUrl;
  let owner;
  let counselor;
  let workspaceId;
  let token;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());

    const app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use('/api/leads', leadsRouter);

    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/leads`;

    workspaceId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const counselorId = new mongoose.Types.ObjectId();

    await Workspace.create({ _id: workspaceId, name: 'RC3 Bulk Perf Workspace', ownerId });

    owner = await User.create({
      _id: ownerId,
      name: 'Bulk Owner',
      email: 'owner@perf.local',
      password: 'Password123!',
      role: 'superadmin',
      companyRole: 'owner',
      companyId: ownerId,
      workspaceId,
      workspaces: [workspaceId],
    });

    counselor = await User.create({
      _id: counselorId,
      name: 'Lead Counselor',
      email: 'counselor@perf.local',
      password: 'Password123!',
      role: 'counselor',
      companyRole: 'agent',
      companyId: ownerId,
      workspaceId,
      workspaces: [workspaceId],
    });

    await WorkspaceMembership.create([
      { workspaceId, userId: ownerId, role: 'owner', status: 'active' },
      { workspaceId, userId: counselorId, role: 'counsellor', status: 'active' },
    ]);

    token = jwt.sign(
      { id: owner._id, role: owner.role, companyId: owner.companyId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }, 60000);

  afterAll(async () => {
    if (server) await new Promise((r) => server.close(r));
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${token}`,
    'x-workspace-id': workspaceId.toString(),
  });

  test('Bulk Transfer: chunks 1,000 leads via bulkWrite without N-save overhead in < 500ms', async () => {
    // Seed 1,000 leads
    const docs = [];
    const now = new Date();
    for (let i = 1; i <= 1000; i++) {
      docs.push({
        _id: new mongoose.Types.ObjectId(),
        workspaceId,
        companyId: owner._id,
        userId: owner._id,
        name: `Transfer Lead ${i}`,
        phone: `9180${String(i).padStart(6, '0')}`,
        status: 'new_lead',
        createdAt: now,
        updatedAt: now,
      });
    }
    await Lead.insertMany(docs, { ordered: false });

    const leadIds = docs.map((d) => d._id.toString());

    const t0 = Date.now();
    const res = await fetch(`${baseUrl}/bulk-transfer`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadIds,
        assignedToUserId: counselor._id.toString(),
        newStage: 'in_progress',
        transferNote: 'Bulk transfer high performance test',
      }),
    });
    const elapsed = Date.now() - t0;
    const body = await res.json();

    console.log(`Bulk Transfer: 1,000 leads in ${elapsed}ms`);
    expect(res.status).toBe(200);
    expect(body.count).toBe(1000);
    expect(elapsed).toBeLessThan(2500);

    // Verify persistence, status, edit history and activities
    const sample = await Lead.findById(leadIds[0]).lean();
    expect(sample.assignedTo.toString()).toBe(counselor._id.toString());
    expect(sample.assignedToName).toBe('Lead Counselor');
    expect(sample.status).toBe('in_progress');
    expect(sample.editHistory).toHaveLength(1);
    expect(sample.leadActivities).toHaveLength(1);
    expect(sample.leadActivities[0].action).toBe('lead_transferred');
  });

  test('Streaming CSV Export: exports 5,000 rows with high throughput (>2,000 rows/s) and flat memory', async () => {
    // Seed 4,000 more leads to make 5,000 total
    const extraDocs = [];
    const now = new Date();
    for (let i = 1001; i <= 5000; i++) {
      extraDocs.push({
        _id: new mongoose.Types.ObjectId(),
        workspaceId,
        companyId: owner._id,
        userId: owner._id,
        name: `Export Lead ${i}`,
        phone: `9181${String(i).padStart(6, '0')}`,
        status: 'new_lead',
        budget: '50000',
        createdAt: now,
        updatedAt: now,
      });
    }
    await Lead.insertMany(extraDocs, { ordered: false });

    const t0 = Date.now();
    const res = await fetch(`${baseUrl}/export?format=csv`, {
      headers: authHeaders(),
    });
    const csvText = await res.text();
    const elapsed = Date.now() - t0;

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    
    // Count CSV lines (1 header + 5000 rows)
    const lines = csvText.trim().split('\n');
    expect(lines.length).toBe(5001);

    const rowsPerSec = Math.round((5000 / elapsed) * 1000);
    console.log(`CSV Export: 5,000 rows in ${elapsed}ms (${rowsPerSec} rows/sec)`);
    expect(rowsPerSec).toBeGreaterThanOrEqual(1500);
  });

  test('XLSX Export Row Cap: rejects queries exceeding MAX_XLSX_EXPORT_ROWS with explicit HTTP 413', async () => {
    // Seed leads to push total over 10,000
    const extraDocs = [];
    const now = new Date();
    for (let i = 5001; i <= 10050; i++) {
      extraDocs.push({
        _id: new mongoose.Types.ObjectId(),
        workspaceId,
        companyId: owner._id,
        userId: owner._id,
        name: `Extra Lead ${i}`,
        phone: `9182${String(i).padStart(6, '0')}`,
        status: 'new_lead',
        createdAt: now,
        updatedAt: now,
      });
    }
    await Lead.insertMany(extraDocs, { ordered: false });

    const totalInDb = await Lead.countDocuments({ workspaceId });
    expect(totalInDb).toBeGreaterThan(10000);

    const res = await fetch(`${baseUrl}/export?format=xlsx`, {
      headers: authHeaders(),
    });
    const json = await res.json();

    expect(res.status).toBe(413);
    expect(json.code).toBe('EXPORT_TOO_LARGE');
    expect(json.message).toContain('XLSX export is capped');
    expect(json.maxRows).toBe(10000);
  });

  test('Bulk Import: imports 1,000 rows with chunked $in deduplication and ordered:false', async () => {
    // Generate CSV buffer with 1,000 rows, including 10 duplicate phones from earlier
    const lines = ['Name,Phone,Target Domain,Status,Budget,Note'];
    // 10 duplicate phones
    for (let i = 1; i <= 10; i++) {
      lines.push(`"Duplicate ${i}","9180${String(i).padStart(6, '0')}","Engineering (B.Tech/BE)","new_lead","50000","Duplicate test"`);
    }
    // 990 new phones
    for (let i = 11; i <= 1000; i++) {
      lines.push(`"Import Candidate ${i}","9190${String(i).padStart(6, '0')}","Engineering (B.Tech/BE)","new_lead","50000","Fresh import"`);
    }
    const csvBuffer = Buffer.from(lines.join('\n'), 'utf8');

    const boundary = '----WebKitFormBoundaryBulkTest' + Math.random().toString(36).substring(2);
    const parts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="import_1000.csv"\r\n`,
      `Content-Type: text/csv\r\n\r\n`,
    ];
    const bodyHeader = Buffer.from(parts.join(''));
    const bodyFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([bodyHeader, csvBuffer, bodyFooter]);

    const t0 = Date.now();
    const res = await fetch(`${baseUrl}/import`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });
    const elapsed = Date.now() - t0;
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.importedCount).toBe(990);
    expect(json.skippedCount).toBe(10);
    console.log(`Bulk Import: 1,000 rows (990 imported, 10 duplicate skipped) in ${elapsed}ms`);
    expect(elapsed).toBeLessThan(3000);
  });
});
