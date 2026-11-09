const assert = require('assert');
const http = require('http');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('RC-2 Public Share-Token Dashboard Expiry & Phone Masking', () => {
  let mongod;
  let server;
  let baseUrl;
  let User;
  let Lead;
  let Workspace;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    User = require('../src/models/User');
    Lead = require('../src/models/Lead');
    Workspace = require('../src/models/Workspace');

    const app = express();
    app.use(express.json());

    const shareRoutes = require('../src/routes/share');
    app.use('/api', shareRoutes);

    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  });

  it('should reject expired share tokens with HTTP 404', async () => {
    const expiredUser = await User.create({
      name: 'Expired Counselor',
      email: 'expired@example.com',
      password: 'Password123!',
      shareToken: 'token_expired_12345',
      shareTokenEnabled: true,
      shareTokenExpiresAt: new Date(Date.now() - 3600 * 1000), // Expired 1 hour ago
    });

    let error404 = null;
    try {
      await axios.get(`${baseUrl}/api/share/${expiredUser.shareToken}`);
    } catch (err) {
      error404 = err;
    }

    assert.ok(error404, 'Expired share token must return error');
    assert.strictEqual(error404.response?.status, 404);
    assert.match(error404.response?.data?.message, /expired/i);
  });

  it('should mask lead phone numbers when workspace maskLeadPhones setting is true', async () => {
    const ws = await Workspace.create({
      name: 'Masked Workspace',
      ownerId: new mongoose.Types.ObjectId(),
      settings: { maskLeadPhones: true },
    });

    const counselor = await User.create({
      name: 'Active Counselor Masked',
      email: 'counselor_masked@example.com',
      password: 'Password123!',
      workspaceId: ws._id,
      shareToken: 'token_valid_masked_12345',
      shareTokenEnabled: true,
      shareTokenExpiresAt: new Date(Date.now() + 86400 * 1000), // Valid for 24h
    });

    await Lead.create({
      name: 'John Doe',
      phone: '9876543210',
      userId: counselor._id,
      workspaceId: ws._id,
      status: 'new',
    });

    const res = await axios.get(`${baseUrl}/api/share/${counselor.shareToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.leads.length > 0, 'Leads should be returned');
    assert.notStrictEqual(res.data.leads[0].phone, '9876543210', 'Phone number must NOT be in clear text');
    assert.match(res.data.leads[0].phone, /\*/, 'Phone number must contain asterisks masking');
  });

  it('should preserve clear phone numbers when workspace maskLeadPhones setting is false', async () => {
    const ws = await Workspace.create({
      name: 'Unmasked Workspace',
      ownerId: new mongoose.Types.ObjectId(),
      settings: { maskLeadPhones: false },
    });

    const counselor = await User.create({
      name: 'Active Counselor Unmasked',
      email: 'counselor_unmasked@example.com',
      password: 'Password123!',
      workspaceId: ws._id,
      shareToken: 'token_valid_unmasked_12345',
      shareTokenEnabled: true,
      shareTokenExpiresAt: new Date(Date.now() + 86400 * 1000),
    });

    await Lead.create({
      name: 'Jane Smith',
      phone: '9123456780',
      userId: counselor._id,
      workspaceId: ws._id,
      status: 'contacted',
    });

    const res = await axios.get(`${baseUrl}/api/share/${counselor.shareToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.leads[0].phone, '9123456780', 'Phone number must remain in clear text when flag is off');
  });
});
