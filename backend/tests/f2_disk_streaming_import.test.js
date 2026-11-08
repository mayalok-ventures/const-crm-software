const assert = require('assert');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

let replSet;
let Lead;
let User;
let Workspace;

const leadsController = require('../src/controllers/leadsController');

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  Lead = require('../src/models/Lead');
  User = require('../src/models/User');
  Workspace = require('../src/models/Workspace');
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

describe('F2.4: Multer Disk Storage, Off-Heap Streaming Import, and CSV Formula Escaping', () => {
  it('streams CSV import from disk path and unlinks temp file after completion', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({ name: 'Disk WS', ownerId });
    const user = await User.create({
      _id: ownerId,
      name: 'Disk Manager',
      email: 'disk@test.com',
      password: 'Password123!',
      role: 'superadmin',
      companyRole: 'owner',
      workspaceRole: 'owner',
      workspaceId: ws._id,
      companyId: ws._id,
      isActive: true,
    });

    const tempFilePath = path.join(os.tmpdir(), `test_import_${Date.now()}.csv`);
    const csvContent = 'name,phone,email,status\nDisk Student 1,9333311111,ds1@test.com,new\nDisk Student 2,9333322222,ds2@test.com,new\n';
    fs.writeFileSync(tempFilePath, csvContent, 'utf-8');

    const req = {
      file: {
        path: tempFilePath,
        originalname: 'test_import.csv',
        mimetype: 'text/csv',
      },
      body: {},
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const res = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.importLeads(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.importedCount, 2);

    const count = await Lead.countDocuments({ workspaceId: ws._id });
    assert.strictEqual(count, 2);

    // Verify temp file on disk was cleanly unlinked to prevent disk leak
    assert(!fs.existsSync(tempFilePath), 'Temporary disk upload file must be unlinked after import');
  });

  it('exportLeads safely escapes formula characters (=, +, -, @) to prevent CSV injection', async () => {
    const ws = await Workspace.findOne();
    const user = await User.findOne();

    // Create lead with formula injection in name and company
    await Lead.create({
      workspaceId: ws._id,
      companyId: ws._id,
      userId: user._id,
      assignedTo: user._id,
      name: '=cmd|\' /C calc\'!A0',
      phone: '9333344444',
      phoneDigits: '9333344444',
      company: '@malicious_domain',
      status: '+injected_status',
    });

    let writtenOutput = '';
    const req = {
      query: { format: 'csv' },
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      write(chunk) { writtenOutput += chunk.toString(); },
      end() {},
    };

    await leadsController.exportLeads(req, res);
    assert(writtenOutput.length > 0);

    // Verify leading formula characters are escaped with a single quote '
    assert(writtenOutput.includes(`"'=cmd|' /C calc'!A0"`), 'Name with = must be escaped with single quote');
    assert(writtenOutput.includes(`"'@malicious_domain"`), 'Company with @ must be escaped with single quote');
    assert(writtenOutput.includes(`"'+injected_status"`), 'Status with + must be escaped with single quote');
  });
});
