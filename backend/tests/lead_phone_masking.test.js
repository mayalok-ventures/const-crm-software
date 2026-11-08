const { assertTestSafety } = require('./safetyGuard');
assertTestSafety();

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const AuditLog = require('../src/models/AuditLog');
const {
  maskPhoneNumber,
  shouldMaskPhoneForUser,
  sanitizeLeadPhone,
} = require('../src/utils/phoneMasking');
const leadsController = require('../src/controllers/leadsController');

describe('F1: Role-Based Phone Masking & Unmask Audit Integration Tests', () => {
  let mongod;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  it('Unit: maskPhoneNumber correctly masks trailing digits while preserving country/area prefix', () => {
    assert.strictEqual(maskPhoneNumber('+919876543210'), '+9198765*****');
    assert.strictEqual(maskPhoneNumber('9876543210'), '98765*****');
    assert.strictEqual(maskPhoneNumber('1234'), '****');
    assert.strictEqual(maskPhoneNumber(''), '');
    assert.strictEqual(maskPhoneNumber(null), null);
    assert.strictEqual(maskPhoneNumber(undefined), undefined);
  });

  it('Integration: Counsellor sees masked phone in getLead, Owner sees unmasked phone', async () => {
    const ownerUserId = new mongoose.Types.ObjectId();

    // 1. Create Workspace
    const workspace = await Workspace.create({
      name: 'EduConsult Test Academy',
      domain: 'educonsult-test',
      ownerId: ownerUserId,
    });

    // 2. Create Owner and Counsellor Users
    const owner = await User.create({
      _id: ownerUserId,
      name: 'Director Jane',
      email: 'jane@educonsult.test',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      workspaceId: workspace._id,
    });

    const counsellor = await User.create({
      name: 'Agent John',
      email: 'john@educonsult.test',
      password: 'password123',
      role: 'counsellor',
      workStatus: 'counsellor',
      workspaceId: workspace._id,
    });

    // 3. Create WorkspaceMemberships
    const ownerMembership = await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: owner._id,
      role: 'owner',
      status: 'active',
    });

    const counsellorMembership = await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: counsellor._id,
      role: 'counsellor',
      status: 'active',
    });

    // 4. Create Lead
    const rawPhone = '+919876543210';
    const rawAlternate = '+919123456789';
    const rawFather = '+919988776655';

    const testLead = await Lead.create({
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.test',
      phone: rawPhone,
      alternatePhone: rawAlternate,
      fatherPhone: rawFather,
      workspaceId: workspace._id,
      companyId: workspace._id,
      userId: owner._id,
      assignedTo: counsellor._id,
      status: 'new_lead',
    });

    counsellor.workspaceId = workspace._id;
    counsellor.workspaceRole = 'counsellor';
    counsellor.membership = counsellorMembership;

    owner.workspaceId = workspace._id;
    owner.workspaceRole = 'owner';
    owner.membership = ownerMembership;

    // 5. Test Counsellor getLead invocation
    const mockReqCounsellor = {
      params: { id: testLead._id.toString() },
      user: counsellor,
      membership: counsellorMembership,
      workspaceId: workspace._id,
    };

    let counsellorResPayload = null;
    const mockResCounsellor = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        counsellorResPayload = data;
        return this;
      },
    };

    await leadsController.getLead(mockReqCounsellor, mockResCounsellor);
    assert(counsellorResPayload, 'Expected JSON response for counsellor getLead');
    assert.strictEqual(counsellorResPayload.isPhoneMasked, true, 'isPhoneMasked must be true');
    assert.strictEqual(counsellorResPayload.phone, '+9198765*****', 'Phone must be masked for counsellor');
    assert.strictEqual(counsellorResPayload.alternatePhone, '+9191234*****', 'Alternate phone must be masked');
    assert.strictEqual(counsellorResPayload.fatherPhone, '+9199887*****', 'Father phone must be masked');

    // 6. Test Owner getLead invocation
    const mockReqOwner = {
      params: { id: testLead._id.toString() },
      user: owner,
      membership: ownerMembership,
      workspaceId: workspace._id,
    };

    let ownerResPayload = null;
    const mockResOwner = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        ownerResPayload = data;
        return this;
      },
    };

    await leadsController.getLead(mockReqOwner, mockResOwner);
    assert(ownerResPayload, 'Expected JSON response for owner getLead');
    assert.strictEqual(ownerResPayload.isPhoneMasked, false, 'isPhoneMasked must be false for owner');
    assert.strictEqual(ownerResPayload.phone, rawPhone, 'Phone must remain raw unmasked for owner');
    assert.strictEqual(ownerResPayload.alternatePhone, rawAlternate, 'Alternate phone must remain raw unmasked');

    // 7. Test getLeads (list view) masking for counsellor
    const mockReqList = {
      query: { page: 1, limit: 10 },
      user: counsellor,
      membership: counsellorMembership,
      workspaceId: workspace._id,
    };
    let listPayload = null;
    const mockResList = {
      status(code) { this.statusCode = code; return this; },
      json(data) { listPayload = data; return this; },
    };
    await leadsController.getLeads(mockReqList, mockResList);
    assert(listPayload && Array.isArray(listPayload.leads), 'Expected leads list in response');
    const returnedLead = listPayload.leads.find(l => l._id.toString() === testLead._id.toString());
    assert(returnedLead, 'Created lead must be in counsellor getLeads list');
    assert.strictEqual(returnedLead.isPhoneMasked, true, 'isPhoneMasked must be true in list view');
    assert.strictEqual(returnedLead.phone, '+9198765*****', 'Phone in list must be masked for counsellor');
  });

  it('Integration: unmaskLeadPhone logs AuditLog and returns raw unmasked numbers', async () => {
    const workspace = await Workspace.findOne({ name: 'EduConsult Test Academy' });
    const counsellor = await User.findOne({ email: 'john@educonsult.test' });
    const counsellorMembership = await WorkspaceMembership.findOne({ userId: counsellor._id });
    const testLead = await Lead.findOne({ email: 'rohan.sharma@example.test' });

    const initialAuditCount = await AuditLog.countDocuments({ action: 'LEAD_PHONE_UNMASKED' });

    const mockReq = {
      params: { id: testLead._id.toString() },
      user: counsellor,
      membership: counsellorMembership,
      workspaceId: workspace._id,
      ip: '192.168.1.100',
      headers: { 'user-agent': 'AntigravityAuditAgent/3.0' },
    };

    let resPayload = null;
    const mockRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        resPayload = data;
        return this;
      },
    };

    await leadsController.unmaskLeadPhone(mockReq, mockRes);
    assert(resPayload, 'Response payload expected from unmaskLeadPhone');
    assert.strictEqual(resPayload.success, true);
    assert.strictEqual(resPayload.phone, '+919876543210');
    assert.strictEqual(resPayload.alternatePhone, '+919123456789');
    assert.strictEqual(resPayload.fatherPhone, '+919988776655');

    // Verify AuditLog entry was persisted
    const finalAuditCount = await AuditLog.countDocuments({ action: 'LEAD_PHONE_UNMASKED' });
    assert.strictEqual(finalAuditCount, initialAuditCount + 1, 'AuditLog entry must be created');

    const auditEntry = await AuditLog.findOne({
      action: 'LEAD_PHONE_UNMASKED',
      resourceId: testLead._id.toString(),
    }).sort({ timestamp: -1 });

    assert(auditEntry, 'Audit log document must exist');
    assert.strictEqual(auditEntry.actorId.toString(), counsellor._id.toString());
    assert.strictEqual(auditEntry.actorName, 'Agent John');
    assert.strictEqual(auditEntry.resourceType, 'Lead');
    assert.deepStrictEqual(auditEntry.metadata.unmaskedFields, ['phone', 'alternatePhone', 'fatherPhone']);
  });
});
