const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const { shouldMaskPhoneForUser } = require('../src/utils/phoneMasking');
const { invalidateUserAuthCache } = require('../src/utils/authCache');

let mongod;
const JWT_SECRET = 'test_security_jwt_secret_12345';
process.env.JWT_SECRET = JWT_SECRET;

describe('F5: Security Hardening & Phone Masking Oracles', () => {
  let ownerUser;
  let counsellorUser;
  let workspace;
  let testLead;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const ownerId = new mongoose.Types.ObjectId();

    // Create workspace with phone masking enabled
    workspace = await Workspace.create({
      name: 'Secure Education Corp',
      ownerId,
      settings: { maskLeadPhones: true },
      maskLeadPhones: true,
    });

    ownerUser = await User.create({
      _id: ownerId,
      name: 'Owner Admin',
      email: `owner_${Date.now()}@test.com`,
      password: 'password123',
      role: 'admin',
    });
    ownerUser.workspaceId = workspace._id;

    counsellorUser = await User.create({
      name: 'Counsellor Jane',
      email: `counsellor_${Date.now()}@test.com`,
      password: 'password123',
      role: 'counsellor',
      workspaceRole: 'counsellor',
      permissions: ['leads.view', 'leads.create'], // lacks leads.view_phone_unmasked
    });
    counsellorUser.workspaceId = workspace._id;

    testLead = await Lead.create({
      name: 'Target Confidential Lead',
      phone: '+919876543210',
      phoneDigits: '9876543210',
      email: 'target.confidential@gmail.com',
      workspaceId: workspace._id,
      userId: ownerUser._id,
      assignedTo: counsellorUser._id,
      status: 'new_lead',
    });
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop({ force: true });
    process.exit(0);
  });

  it('F5.1: shouldMaskPhoneForUser should correctly evaluate masked status for counsellor vs owner', async () => {
    const ownerMasked = await shouldMaskPhoneForUser(ownerUser, null, workspace);
    const counsellorMasked = await shouldMaskPhoneForUser(counsellorUser, null, workspace);

    assert.strictEqual(ownerMasked, false, 'Owner must NOT have phone masking applied');
    assert.strictEqual(counsellorMasked, true, 'Counsellor without unmask permission MUST have phone masking applied');
  });

  it('F5.2: JWT Revocation via tokenVersion should immediately invalidate revoked tokens', async () => {
    const { protect } = require('../src/middleware/auth');

    // Create user with tokenVersion = 1
    const secureUser = await User.create({
      name: 'Token Revoke Test',
      email: `revoke_${Date.now()}@test.com`,
      password: 'password123',
      role: 'counsellor',
      tokenVersion: 1,
    });

    // Issue JWT with tokenVersion: 1
    const tokenV1 = jwt.sign({ id: secureUser._id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });

    // Mock request & response
    let req = { headers: { authorization: `Bearer ${tokenV1}` } };
    let res = {
      status: (code) => {
        res.statusCode = code;
        return res;
      },
      json: (data) => {
        res.data = data;
        return res;
      },
    };
    let nextCalled = false;

    // First call with active tokenVersion should succeed
    await protect(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'Token v1 should be accepted when tokenVersion matches');

    // Increment user tokenVersion to 2 (simulate logout / password reset / session revocation)
    await User.findByIdAndUpdate(secureUser._id, { $inc: { tokenVersion: 1 } });
    invalidateUserAuthCache(secureUser._id);

    // Next call with tokenV1 should be REJECTED with 401
    nextCalled = false;
    let authFailedCode = null;
    let authFailedMsg = null;
    res = {
      status: (code) => {
        authFailedCode = code;
        return {
          json: (data) => {
            authFailedMsg = data?.message;
          }
        };
      }
    };

    await protect(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false, 'Revoked token v1 MUST NOT pass protect middleware');
    assert.strictEqual(authFailedCode, 401, 'Revoked token must return HTTP 401');
    assert.ok(authFailedMsg && authFailedMsg.toLowerCase().includes('revoked'), 'Error message must indicate token revocation');
  });

  it('F5.3: lead merge duplicate candidates must not expose phone matchType to masked users', async () => {
    const { getDuplicateCandidates } = require('../src/controllers/leadMergeController');

    // Candidate with identical phone in same workspace but from another agent/user
    const candidateLead = await Lead.create({
      name: 'Potential Duplicate Lead',
      phone: '+919876543210',
      phoneDigits: '9876543210',
      workspaceId: workspace._id,
      userId: new mongoose.Types.ObjectId(),
      assignedTo: counsellorUser._id,
      status: 'new_lead',
    });

    const req = {
      params: { id: String(testLead._id) },
      user: counsellorUser,
      workspace: workspace,
      workspaceId: workspace._id,
    };

    let responseData = null;
    let statusCode = 200;
    const res = {
      status: (c) => {
        statusCode = c;
        return {
          json: (d) => {
            responseData = d;
          }
        };
      },
      json: (d) => {
        responseData = d;
      },
    };

    await getDuplicateCandidates(req, res);

    assert.ok(responseData && responseData.candidates, `Expected candidates but got status ${statusCode}: ${JSON.stringify(responseData)}`);
    assert.ok(responseData.candidates.length > 0, 'At least one candidate must match');

    const matchedCand = responseData.candidates.find(c => String(c._id) === String(candidateLead._id));
    assert.ok(matchedCand, 'Duplicate candidate must be present');

    // For masked counsellor, matchType MUST NOT be 'phone' (oracle leak)
    assert.notStrictEqual(matchedCand.matchType, 'phone', 'matchType must not reveal phone match to masked user');
    assert.strictEqual(matchedCand.matchType, 'record_match', 'matchType should be sanitized to record_match');
  });
});
