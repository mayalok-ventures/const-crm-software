const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

let replSet;
let Lead;
let User;
let Workspace;
let ImportJob;

const leadsController = require('../src/controllers/leadsController');

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  Lead = require('../src/models/Lead');
  User = require('../src/models/User');
  Workspace = require('../src/models/Workspace');
  ImportJob = require('../src/models/ImportJob');
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

describe('F1.6: Resumable and Idempotent ImportJob', () => {
  it('imports CSV rows, creates ImportJob, and deduplicates idempotent re-uploads', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({ name: 'Import Workspace', ownerId });
    const user = await User.create({
      _id: ownerId,
      name: 'Import Manager',
      email: 'importer@test.com',
      password: 'Password123!',
      role: 'superadmin',
      companyRole: 'owner',
      workspaceRole: 'owner',
      workspaceId: ws._id,
      companyId: ws._id,
      isActive: true,
    });

    const csvContent = 'name,phone,email,status\nStudent A,9777711111,a@test.com,new\nStudent B,9777722222,b@test.com,new\nStudent C,9777733333,c@test.com,new\n';
    const fileBuffer = Buffer.from(csvContent, 'utf-8');

    const req1 = {
      file: {
        buffer: fileBuffer,
        originalname: 'students.csv',
        mimetype: 'text/csv',
      },
      body: {},
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const res1 = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.importLeads(req1, res1);
    if (res1.statusCode !== 201) {
      console.error('importLeads res1 failed:', res1.statusCode, res1.body);
    }
    assert.strictEqual(res1.statusCode, 201, 'First import must succeed with 201');
    assert.strictEqual(res1.body.importedCount, 3);
    assert(res1.body.jobId, 'Response must return jobId');

    const leadCount1 = await Lead.countDocuments({ workspaceId: ws._id });
    assert.strictEqual(leadCount1, 3, 'Exactly 3 leads must be inserted in DB');

    const job = await ImportJob.findById(res1.body.jobId);
    assert(job, 'ImportJob document must be created');
    assert.strictEqual(job.status, 'completed');
    assert.strictEqual(job.importedCount, 3);

    // Second import of the EXACT same file buffer (re-upload or network retry)
    const req2 = {
      file: {
        buffer: fileBuffer,
        originalname: 'students.csv',
        mimetype: 'text/csv',
      },
      body: {},
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const res2 = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.importLeads(req2, res2);
    assert.strictEqual(res2.statusCode, 200, 'Re-imported completed file must return 200 idempotent');
    assert.strictEqual(res2.body.idempotent, true);
    assert.strictEqual(res2.body.importedCount, 3);

    const leadCount2 = await Lead.countDocuments({ workspaceId: ws._id });
    assert.strictEqual(leadCount2, 3, 'Lead count must still be 3 without duplicate records');
  });

  it('resumes partial import without duplicating previously processed rows', async () => {
    const ws = await Workspace.findOne();
    const user = await User.findOne();

    // Create a new CSV with 2 rows: one new, one simulating a row previously processed in a failed run
    const csvContent = 'name,phone,email,status\nResume One,9777744444,r1@test.com,new\nResume Two,9777755555,r2@test.com,new\n';
    const fileBuffer = Buffer.from(csvContent, 'utf-8');

    // Pre-insert Lead for 9777744444 to simulate what was committed before failure
    await Lead.create({
      workspaceId: ws._id,
      companyId: ws._id,
      userId: user._id,
      name: 'Resume One',
      phone: '9777744444',
      phoneDigits: '9777744444',
      status: 'new',
    });

    const crypto = require('crypto');
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Simulate an interrupted ImportJob with 9777744444 already in processedRowHashes
    const partialJob = await ImportJob.create({
      workspaceId: ws._id,
      companyId: ws._id,
      userId: user._id,
      fileHash,
      filename: 'resume_test.csv',
      status: 'failed',
      importedCount: 1,
      processedRows: 1,
      processedRowHashes: ['9777744444'],
    });

    const req = {
      file: {
        buffer: fileBuffer,
        originalname: 'resume_test.csv',
        mimetype: 'text/csv',
      },
      body: { importJobId: partialJob._id.toString() },
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
    // Should have only imported the 1 remaining new lead (Resume Two)
    assert.strictEqual(res.body.importedCount, 2, 'Total imported count updated to 2');

    const totalLeadsFor4444 = await Lead.countDocuments({ phone: '9777744444' });
    assert.strictEqual(totalLeadsFor4444, 1, 'Pre-processed phone must not be duplicated');

    const totalLeadsFor5555 = await Lead.countDocuments({ phone: '9777755555' });
    assert.strictEqual(totalLeadsFor5555, 1, 'Remaining phone must be successfully imported');
  });

  it('getImportStatus returns accurate job metadata', async () => {
    const ws = await Workspace.findOne();
    const user = await User.findOne();
    const job = await ImportJob.findOne();

    const req = {
      params: { jobId: job._id.toString() },
      user,
      workspaceId: ws._id,
    };
    const res = {
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
    };

    await leadsController.getImportStatus(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.jobId.toString(), job._id.toString());
  });
});
