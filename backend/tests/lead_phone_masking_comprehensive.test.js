const { assertTestSafety } = require('./safetyGuard');
assertTestSafety();

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMembership = require('../src/models/WorkspaceMembership');
const AdmissionDeal = require('../src/models/AdmissionDeal');
const Notification = require('../src/models/Notification');
const ChatMessage = require('../src/models/ChatMessage');
const AuditLog = require('../src/models/AuditLog');
const {
  maskPhoneNumber,
  redactPhoneInText,
  shouldMaskPhoneForUser,
} = require('../src/utils/phoneMasking');
const leadsController = require('../src/controllers/leadsController');
const dealController = require('../src/controllers/dealController');
const whatsappController = require('../src/controllers/whatsappController');
const notificationsController = require('../src/controllers/notificationsController');

describe('F1 Hardening: Comprehensive Phone Masking & Server-Mediated Actions Suite', function () {
  this.timeout(25000);
  let mongod;
  let workspace;
  let owner;
  let counsellor;
  let privilegedAgent;
  let testLead;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    const ownerUserId = new mongoose.Types.ObjectId();

    // 1. Create Workspace with maskLeadPhones = true
    workspace = await Workspace.create({
      name: 'Global Academy Masking Test',
      domain: 'masking-test',
      ownerId: ownerUserId,
      settings: { maskLeadPhones: true },
    });

    // 2. Create Owner
    owner = await User.create({
      _id: ownerUserId,
      name: 'Owner Alice',
      email: 'owner@globalacademy.test',
      password: 'password123',
      role: 'admin',
      workStatus: 'company_owner',
      companyRole: 'owner',
      workspaceId: workspace._id,
    });

    // 3. Create Standard Counsellor
    counsellor = await User.create({
      name: 'Counsellor Bob',
      email: 'bob@globalacademy.test',
      password: 'password123',
      role: 'counsellor',
      workStatus: 'counsellor',
      workspaceId: workspace._id,
    });

    // 4. Create Privileged Agent with 'leads.view_phone_unmasked'
    privilegedAgent = await User.create({
      name: 'Privileged Carol',
      email: 'carol@globalacademy.test',
      password: 'password123',
      role: 'counsellor',
      permissions: ['leads.view_phone_unmasked'],
      workspaceId: workspace._id,
    });

    // 5. Create Memberships
    await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: owner._id,
      role: 'owner',
      status: 'active',
    });

    const counsellorMem = await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: counsellor._id,
      role: 'counsellor',
      status: 'active',
    });
    counsellor.membership = counsellorMem;

    const privMem = await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId: privilegedAgent._id,
      role: 'counsellor',
      status: 'active',
      permissionOverrides: [{ key: 'leads.view_phone_unmasked', granted: true }],
    });
    privilegedAgent.membership = privMem;

    // 6. Seed Lead with phones
    testLead = await Lead.create({
      name: 'Arjun Verma',
      phone: '+919876543210',
      phoneDigits: '9876543210',
      alternatePhone: '+919123456789',
      fatherPhone: '+919988776655',
      workspaceId: workspace._id,
      companyId: workspace._id,
      userId: owner._id,
      assignedTo: counsellor._id,
      status: 'contacted',
    });
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  it('1. Server-mediated call redirect returns tel: URL and logs LEAD_CALL_INITIATED in AuditLog', async () => {
    const initialLogCount = await AuditLog.countDocuments({ action: 'LEAD_CALL_INITIATED' });

    let redirectUrl = null;
    let jsonResponse = null;
    const req = {
      params: { id: testLead._id.toString() },
      query: { format: 'json' },
      user: counsellor,
      membership: counsellor.membership,
      workspace,
      workspaceId: workspace._id,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'MochaTest' },
    };
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(data) { jsonResponse = data; return this; },
      redirect(url) { redirectUrl = url; return this; },
    };

    await leadsController.callRedirect(req, res);
    assert(jsonResponse, 'Expected JSON response');
    assert.strictEqual(jsonResponse.success, true);
    assert.strictEqual(jsonResponse.url, 'tel:919876543210');

    // Verify AuditLog entry
    const finalLogCount = await AuditLog.countDocuments({ action: 'LEAD_CALL_INITIATED' });
    assert.strictEqual(finalLogCount, initialLogCount + 1, 'AuditLog entry must be persisted');
    const audit = await AuditLog.findOne({ action: 'LEAD_CALL_INITIATED' }).sort({ timestamp: -1 });
    assert.strictEqual(audit.resourceId, testLead._id.toString());
    assert.strictEqual(audit.actorId.toString(), counsellor._id.toString());
  });

  it('2. Server-mediated WhatsApp redirect returns wa.me URL and logs LEAD_WHATSAPP_INITIATED in AuditLog', async () => {
    const initialLogCount = await AuditLog.countDocuments({ action: 'LEAD_WHATSAPP_INITIATED' });

    let jsonResponse = null;
    const req = {
      params: { id: testLead._id.toString() },
      query: { format: 'json', text: 'Hello Arjun' },
      user: counsellor,
      membership: counsellor.membership,
      workspace,
      workspaceId: workspace._id,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'MochaTest' },
    };
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(data) { jsonResponse = data; return this; },
      redirect(url) { return this; },
    };

    await leadsController.whatsappRedirect(req, res);
    assert(jsonResponse, 'Expected JSON response');
    assert.strictEqual(jsonResponse.success, true);
    assert.strictEqual(jsonResponse.url, 'https://wa.me/919876543210?text=Hello%20Arjun');

    // Verify AuditLog entry
    const finalLogCount = await AuditLog.countDocuments({ action: 'LEAD_WHATSAPP_INITIATED' });
    assert.strictEqual(finalLogCount, initialLogCount + 1, 'AuditLog entry must be persisted');
  });

  it('3. Privileged agent with leads.view_phone_unmasked bypasses masking', async () => {
    const shouldMask = await shouldMaskPhoneForUser(privilegedAgent, privilegedAgent.membership, workspace);
    assert.strictEqual(shouldMask, false, 'User with leads.view_phone_unmasked must not be masked');
  });

  it('4. Deal controller masks studentPhone when maskLeadPhones is ON for counsellor', async () => {
    const deal = await AdmissionDeal.create({
      workspaceId: workspace._id,
      leadId: testLead._id,
      studentName: 'Arjun Verma',
      studentPhone: '+919876543210',
      collegeName: 'Apex Institute',
      courseName: 'B.Tech CS',
      admissionStatus: 'confirmed',
      assignedTo: counsellor._id,
      createdBy: owner._id,
    });

    const req = {
      params: { id: deal._id.toString() },
      user: counsellor,
      membership: counsellor.membership,
      workspace,
      workspaceId: workspace._id,
    };
    let dealPayload = null;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(data) { dealPayload = data; return this; },
    };

    await dealController.getDealById(req, res);
    assert(dealPayload && dealPayload.data, 'Expected deal response');
    assert.strictEqual(dealPayload.data.studentPhone, '+9198765*****', 'Deal studentPhone must be masked for counsellor');
  });

  it('5. WhatsApp chat list and messages mask phone and redact text when maskLeadPhones is ON', async () => {
    await ChatMessage.create({
      userId: counsellor._id,
      phone: '9876543210',
      leadId: testLead._id,
      direction: 'inbound',
      status: 'received',
      text: 'My alternate number is 9123456789 please call me',
      timestamp: new Date(),
    });

    const req = {
      params: { phone: '9876543210' },
      query: {},
      user: counsellor,
      membership: counsellor.membership,
      workspace,
      workspaceId: workspace._id,
    };
    let chatPayload = null;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(data) { chatPayload = data; return this; },
    };

    await whatsappController.getChatHistory(req, res);
    assert(Array.isArray(chatPayload) && chatPayload.length > 0, 'Expected messages list');
    const msg = chatPayload[0];
    assert.strictEqual(msg.phone, '98765*****', 'Message phone must be masked');
    assert(msg.text.includes('91234*****'), 'Phone inside message text must be redacted');
  });

  it('6. Notification controller masks lead phone and redacts message text for counsellor', async () => {
    await Notification.create({
      userId: counsellor._id,
      leadId: testLead._id,
      title: 'Follow-up Due',
      message: 'Call lead Arjun at 9876543210 today',
      isRead: false,
    });

    const req = {
      query: { page: 1, limit: 10 },
      user: counsellor,
      membership: counsellor.membership,
      workspace,
      workspaceId: workspace._id,
    };
    let notifPayload = null;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(data) { notifPayload = data; return this; },
    };

    await notificationsController.getNotifications(req, res);
    assert(notifPayload && Array.isArray(notifPayload.notifications), 'Expected notifications');
    const notif = notifPayload.notifications.find(n => n.leadId && n.leadId._id.toString() === testLead._id.toString());
    assert(notif, 'Notification must be found');
    assert.strictEqual(notif.leadId.phone, '+9198765*****', 'Notification leadId phone must be masked');
    assert(notif.message.includes('98765*****'), 'Notification message body phone must be redacted');
  });
});
