const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { runBackupRestoreDrill } = require('../src/scripts/backupRestoreVerification');

describe('RC-3 Disaster Recovery: Backup & Restore Verification Gate', () => {
  let mongod;
  let srcUri;
  let tgtUri;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const baseUri = mongod.getUri();
    srcUri = `${baseUri}crm_source_db`;
    tgtUri = `${baseUri}crm_restore_target_db`;

    // Seed source database with realistic data
    const conn = await mongoose.createConnection(srcUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
    const User = conn.model('User', new mongoose.Schema({ name: String, email: String, role: String }));
    const Workspace = conn.model('Workspace', new mongoose.Schema({ name: String, ownerId: mongoose.Schema.Types.ObjectId }));
    const Lead = conn.model('Lead', new mongoose.Schema({
      name: String,
      phone: String,
      status: String,
      budget: String,
      workspaceId: mongoose.Schema.Types.ObjectId,
    }));

    const workspaceId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();

    await Workspace.create({ _id: workspaceId, name: 'Disaster Recovery Workspace', ownerId });
    await User.create({ _id: ownerId, name: 'Admin', email: 'admin@dr.local', role: 'superadmin' });

    const leads = [];
    for (let i = 1; i <= 2000; i++) {
      leads.push({
        _id: new mongoose.Types.ObjectId(),
        name: `DR Lead ${i}`,
        phone: `9187${String(i).padStart(6, '0')}`,
        status: 'new_lead',
        budget: '50000',
        workspaceId,
      });
    }
    await Lead.insertMany(leads, { ordered: false });
    await conn.close();
  }, 60000);

  afterAll(async () => {
    if (mongod) await mongod.stop();
  });

  test('Local BSON dump and restore achieves 100% count match and SHA-256 field checksum parity', async () => {
    const drillResult = await runBackupRestoreDrill({
      uri: srcUri,
      targetUri: tgtUri,
    });

    console.log('\nDR Drill Telemetry Summary:', {
      totalDocs: drillResult.totalDocs,
      dumpElapsed: `${drillResult.dumpElapsedMs}ms (${drillResult.dumpDocsPerSec} docs/sec)`,
      restoreElapsed: `${drillResult.restoreElapsedMs}ms (${drillResult.restoreDocsPerSec} docs/sec)`,
      checksumParity: drillResult.checksumParity,
    });

    expect(drillResult.totalDocs).toBe(2002); // 1 workspace + 1 user + 2000 leads
    expect(drillResult.checksumParity).toBe(true);

    for (const [colName, colData] of Object.entries(drillResult.collections)) {
      expect(colData.restoredCount).toBe(colData.count);
      expect(colData.checksumMatch).toBe(true);
      expect(colData.preDumpChecksum).toBe(colData.postRestoreChecksum);
    }
  });
});
