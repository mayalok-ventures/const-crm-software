const assert = require('assert');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

async function runTest() {
  console.log('🧪 Running Issue 3 Test: Insecure JWT Query Parameter Removal...');

  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_crm_2026_super_secure';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);

  const User = require('../src/models/User');

  const user = await User.create({
    name: 'Token Scope Tester',
    email: 'tokenscope@example.com',
    password: 'Password123!',
    role: 'agent',
  });

  const validToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth`;

  try {
    // 1. Request using URL query parameter ?token= must be REJECTED (HTTP 401)
    const resQueryToken = await fetch(`${baseUrl}/me?token=${validToken}`);
    assert.strictEqual(resQueryToken.status, 401, 'Request with ?token= must be rejected with 401 Unauthorized');
    const bodyQuery = await resQueryToken.json();
    assert.strictEqual(bodyQuery.message, 'Not authorized, no token');

    // 2. Request using standard Authorization: Bearer header must SUCCEED (HTTP 200)
    const resBearer = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.strictEqual(resBearer.status, 200, 'Request with Authorization: Bearer must succeed with 200 OK');
    const bodyBearer = await resBearer.json();
    assert.strictEqual(bodyBearer._id, user._id.toString());

    console.log('✅ Issue 3 Test PASSED: Query parameter ?token= rejected with 401, standard Bearer header authenticated successfully.');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Issue 3 Test FAILED:', err);
    process.exit(1);
  });
