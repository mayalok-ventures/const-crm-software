const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

let replSet;
let ChatMessage;
let User;
let Workspace;

const whatsappController = require('../src/controllers/whatsappController');

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  ChatMessage = require('../src/models/ChatMessage');
  User = require('../src/models/User');
  Workspace = require('../src/models/Workspace');
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

describe('F2.3: Lighter Chat Polling via ETag 304 and Since Timestamp Cursor', () => {
  it('returns ETag header on chat history and returns 304 Not Modified when if-none-match matches', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({ name: 'Chat WS', ownerId });
    const user = await User.create({
      _id: ownerId,
      name: 'Agent Chat',
      email: 'chat@test.com',
      password: 'Password123!',
      role: 'admin',
      companyRole: 'owner',
      workspaceRole: 'owner',
      workspaceId: ws._id,
      companyId: ws._id,
      isActive: true,
    });

    const phone = '9888877777';

    // Seed 2 chat messages
    await ChatMessage.create({
      userId: user._id,
      phone,
      sender: user._id,
      text: 'Hello from counselor',
      direction: 'outbound',
      status: 'sent',
      timestamp: new Date(Date.now() - 60000),
    });

    await ChatMessage.create({
      userId: user._id,
      phone,
      sender: user._id,
      text: 'Reply from student',
      direction: 'inbound',
      status: 'received',
      timestamp: new Date(Date.now() - 30000),
    });

    // 1. Initial poll
    const headersSent1 = {};
    const req1 = {
      params: { phone },
      query: {},
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const res1 = {
      statusCode: 200,
      headers: headersSent1,
      set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
      end() { return this; },
    };

    await whatsappController.getChatHistory(req1, res1);
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.body.length, 2);
    assert(res1.headers['etag'], 'Response must set ETag header');

    const etag = res1.headers['etag'];

    // 2. Poll with If-None-Match matching etag (no new messages)
    const headersSent2 = {};
    const req2 = {
      params: { phone },
      query: {},
      headers: { 'if-none-match': etag },
      user,
      workspaceId: ws._id,
    };
    const res2 = {
      statusCode: 200,
      headers: headersSent2,
      set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
      end() { return this; },
    };

    await whatsappController.getChatHistory(req2, res2);
    assert.strictEqual(res2.statusCode, 304, 'Must return 304 Not Modified when ETag matches');

    // 3. Poll with since query parameter
    const cutoff = new Date(Date.now() - 45000).toISOString();
    const req3 = {
      params: { phone },
      query: { since: cutoff },
      headers: {},
      user,
      workspaceId: ws._id,
    };
    const res3 = {
      statusCode: 200,
      headers: {},
      set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
      status(s) { this.statusCode = s; return this; },
      json(b) { this.body = b; return this; },
      end() { return this; },
    };

    await whatsappController.getChatHistory(req3, res3);
    assert.strictEqual(res3.statusCode, 200);
    assert.strictEqual(res3.body.length, 1, 'Only messages after cutoff timestamp must be returned');
    assert.strictEqual(res3.body[0].text, 'Reply from student');
  });
});

