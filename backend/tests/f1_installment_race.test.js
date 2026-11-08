const http = require('http');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';

let replSet;
let server;
let baseUrl;
let Lead;
let FeeInstallment;
let User;
let Workspace;

const { recordInstallmentPayment } = require('../src/controllers/feeInstallmentController');

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  Lead = require('../src/models/Lead');
  FeeInstallment = require('../src/models/FeeInstallment');
  User = require('../src/models/User');
  Workspace = require('../src/models/Workspace');

  const app = express();
  app.use(express.json());

  app.post(
    '/api/leads/:id/installments/:installmentId/pay',
    (req, res, next) => {
      req.user = global.__testUser;
      req.workspaceId = global.__testWs._id;
      next();
    },
    recordInstallmentPayment
  );

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

describe('F1.1: Installment Concurrent Payment Race Condition', () => {
  it('should atomically record concurrent payments without lost updates', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({ name: 'F1 Race WS', ownerId });
    const user = await User.create({
      _id: ownerId,
      name: 'Owner F1',
      email: 'owner_f1@test.com',
      password: 'Password123!',
      role: 'admin',
      companyRole: 'owner',
      workspaceRole: 'owner',
      workspaceId: ws._id,
      companyId: ws._id,
      permissions: ['deals.create', 'deals.edit', 'leads.view', 'leads.edit'],
      isActive: true,
    });

    global.__testWs = ws;
    global.__testUser = user;

    const lead = await Lead.create({
      workspaceId: ws._id,
      companyId: ws._id,
      userId: user._id,
      assignedTo: user._id,
      name: 'Student Installment Race',
      phone: '9888877771',
      phoneDigits: '9888877771',
      email: 'student_race@test.com',
      status: 'new',
    });

    const installment = await FeeInstallment.create({
      leadId: lead._id,
      workspaceId: ws._id,
      companyId: ws._id,
      installmentNumber: 1,
      title: 'Term 1 Tuition',
      amount: 50000,
      paidAmount: 0,
      status: 'pending',
      dueDate: new Date(Date.now() + 86400000),
    });

    // Execute 2 concurrent payment requests of ₹25,000 each against the ₹50,000 installment
    const [res1, res2] = await Promise.all([
      axios.post(`${baseUrl}/api/leads/${lead._id}/installments/${installment._id}/pay`, {
        amount: 25000,
        paymentMethod: 'upi',
        transactionId: 'TXN_RACE_1',
      }),
      axios.post(`${baseUrl}/api/leads/${lead._id}/installments/${installment._id}/pay`, {
        amount: 25000,
        paymentMethod: 'upi',
        transactionId: 'TXN_RACE_2',
      }),
    ]);

    if (res1.status !== 200 || res2.status !== 200) {
      throw new Error(`Expected HTTP 200 but got ${res1.status} and ${res2.status}`);
    }

    // Re-fetch installment from database
    const freshInstallment = await FeeInstallment.findById(installment._id);

    // Total paidAmount MUST be exactly 50,000 and status MUST be 'paid'
    if (freshInstallment.paidAmount !== 50000) {
      throw new Error(`LOST UPDATE DETECTED: Expected paidAmount=50000, but got ${freshInstallment.paidAmount}`);
    }
    if (freshInstallment.status !== 'paid') {
      throw new Error(`Expected status='paid', but got ${freshInstallment.status}`);
    }
  });
});
