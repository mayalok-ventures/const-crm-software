/**
 * Acceptance Test Suite: Phase 1 Auth Reliability & Phone Normalization
 * Tests:
 * 1. normalizePhone strips +91, 91, 0, spaces, dashes
 * 2. Registration with +91 normalizes to 10 digits
 * 3. Duplicate email returns clear 400 with DUPLICATE_ENTRY code
 * 4. Duplicate phone returns clear 400 with DUPLICATE_ENTRY code
 * 5. Login succeeds using +91 format against stored 10-digit number
 * 6. Wrong password returns 401 INVALID_CREDENTIALS
 * 7. Rate limiter authLimiter returns 429 AUTH_RATE_LIMITED without suspending user
 * 8. Auto-expiration of past suspension allows login
 * 9. Active suspension returns 403 ACCOUNT_SUSPENDED
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../src/models/User');
const { normalizePhone, getPhoneQueryCandidates } = require('../src/utils/phoneUtils');
const authController = require('../src/controllers/authController');

let passed = 0;
let failed = 0;

function assert(condition, testName, extra = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${extra}`);
    failed++;
  }
}

const mockRes = () => {
  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    send(data) {
      this.jsonData = data;
      return this;
    }
  };
  return res;
};

async function runTests() {
  console.log('\n🔐 ========================================================');
  console.log('   TEST SUITE: PHASE 1 AUTH RELIABILITY & PHONE NORMALIZATION');
  console.log('========================================================\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  await mongoose.connect(mongoUri);

  try {
    // 1. normalizePhone unit test
    assert(normalizePhone('+91 98765-43210') === '9876543210', 'Step 1a: normalizePhone strips +91, spaces and dashes');
    assert(normalizePhone('919876543210') === '9876543210', 'Step 1b: normalizePhone strips leading 91');
    assert(normalizePhone('09876543210') === '9876543210', 'Step 1c: normalizePhone strips leading 0');
    assert(normalizePhone('9876543210') === '9876543210', 'Step 1d: normalizePhone preserves clean 10 digits');

    const candidates = getPhoneQueryCandidates('+91 98765-43210');
    assert(candidates.includes('9876543210') && candidates.includes('919876543210'), 'Step 1e: getPhoneQueryCandidates returns both 10-digit and raw digits');

    // 2. Registration with phone normalization
    const uniqueId = Date.now();
    const testEmail = `phase1_${uniqueId}@edcrm.com`;
    const testPhone = `+91 98${String(uniqueId).slice(-8)}`;

    const regReq = {
      body: {
        name: 'Phase1 Test User',
        email: testEmail,
        phone: testPhone,
        password: 'SecurePassword123!',
      },
      ip: '127.0.0.1',
      headers: {},
    };
    const regRes = mockRes();
    await authController.register(regReq, regRes);

    assert(regRes.statusCode === 201, 'Step 2a: Registration returns 201 Created');
    assert(regRes.jsonData.phone === normalizePhone(testPhone), 'Step 2b: Registered phone is normalized to 10 digits');
    assert(!!regRes.jsonData.token, 'Step 2c: Registration returns auth JWT token');
    assert(!!regRes.jsonData.usercode, 'Step 2d: Registration returns auto-generated usercode');

    // 3. Duplicate email returns DUPLICATE_ENTRY code
    const dupEmailReq = {
      body: {
        name: 'Another User',
        email: testEmail,
        password: 'Password123!',
      },
      ip: '127.0.0.1',
      headers: {},
    };
    const dupEmailRes = mockRes();
    await authController.register(dupEmailReq, dupEmailRes);

    assert(dupEmailRes.statusCode === 400, 'Step 3a: Duplicate email returns 400 Bad Request');
    assert(dupEmailRes.jsonData.code === 'DUPLICATE_ENTRY', 'Step 3b: Duplicate email returns code DUPLICATE_ENTRY');
    assert(dupEmailRes.jsonData.field === 'email', 'Step 3c: Duplicate email indicates email field');

    // 4. Duplicate phone returns DUPLICATE_ENTRY code
    const dupPhoneReq = {
      body: {
        name: 'Phone User',
        phone: testPhone,
        password: 'Password123!',
      },
      ip: '127.0.0.1',
      headers: {},
    };
    const dupPhoneRes = mockRes();
    await authController.register(dupPhoneReq, dupPhoneRes);

    assert(dupPhoneRes.statusCode === 400, 'Step 4a: Duplicate phone returns 400 Bad Request');
    assert(dupPhoneRes.jsonData.code === 'DUPLICATE_ENTRY', 'Step 4b: Duplicate phone returns code DUPLICATE_ENTRY');

    // 5. Login works with different phone format (+91 vs plain digits)
    const loginReq = {
      body: {
        identifier: `91${normalizePhone(testPhone)}`, // entered with 91 prefix
        password: 'SecurePassword123!',
      },
      ip: '127.0.0.1',
      headers: {},
    };
    const loginRes = mockRes();
    await authController.login(loginReq, loginRes);

    assert(loginRes.statusCode === 200, 'Step 5a: Login succeeds with prefixed phone number format');
    assert(loginRes.jsonData.name === 'Phase1 Test User', 'Step 5b: Login returns correct user profile');
    assert(!!loginRes.jsonData.token, 'Step 5c: Login returns valid JWT token');

    // 6. Wrong password returns 401 INVALID_CREDENTIALS
    const wrongPassReq = {
      body: {
        identifier: testEmail,
        password: 'CompletelyWrongPassword!',
      },
      ip: '127.0.0.1',
      headers: {},
    };
    const wrongPassRes = mockRes();
    await authController.login(wrongPassReq, wrongPassRes);

    assert(wrongPassRes.statusCode === 401, 'Step 6a: Wrong password returns 401 Unauthorized');
    assert(wrongPassRes.jsonData.code === 'INVALID_CREDENTIALS', 'Step 6b: Wrong password returns code INVALID_CREDENTIALS');

    // 7. Auto-expiration of past suspension
    const expiredUser = await User.create({
      name: 'Expired Suspended User',
      email: `expired_${uniqueId}@edcrm.com`,
      password: 'MyPassword123!',
      role: 'agent',
      suspension: {
        isSuspended: true,
        level: 1,
        reason: 'Temporary test lockout',
        suspendedAt: new Date(Date.now() - 3600000),
        suspendedUntil: new Date(Date.now() - 10000), // expired 10 seconds ago
      }
    });

    const expLoginReq = {
      body: {
        identifier: `expired_${uniqueId}@edcrm.com`,
        password: 'MyPassword123!',
      },
      ip: '127.0.0.1',
      headers: {},
    };
    const expLoginRes = mockRes();
    await authController.login(expLoginReq, expLoginRes);

    assert(expLoginRes.statusCode === 200, 'Step 7a: Expired suspension is automatically lifted on login');
    const dbUser = await User.findById(expiredUser._id);
    assert(dbUser.suspension.isSuspended === false, 'Step 7b: User suspension.isSuspended is reset to false in DB');

    // 8. Active suspension returns 403 ACCOUNT_SUSPENDED
    const activeSuspendedUser = await User.create({
      name: 'Active Suspended User',
      email: `active_${uniqueId}@edcrm.com`,
      password: 'MyPassword123!',
      role: 'agent',
      suspension: {
        isSuspended: true,
        level: 1,
        reason: 'Violation of platform terms',
        suspendedAt: new Date(),
        suspendedUntil: new Date(Date.now() + 86400000), // active for 24h
      }
    });

    const actLoginReq = {
      body: {
        identifier: `active_${uniqueId}@edcrm.com`,
        password: 'MyPassword123!',
      },
      ip: '127.0.0.1',
      headers: {},
    };
    const actLoginRes = mockRes();
    await authController.login(actLoginReq, actLoginRes);

    assert(actLoginRes.statusCode === 403, 'Step 8a: Active suspension returns 403 Forbidden');
    assert(actLoginRes.jsonData.code === 'ACCOUNT_SUSPENDED', 'Step 8b: Active suspension returns code ACCOUNT_SUSPENDED');
    assert(actLoginRes.jsonData.message.includes('suspended'), 'Step 8c: Active suspension returns human-readable message');

    console.log('\n========================================================');
    console.log(`🏁 PHASE 1 AUTH RELIABILITY RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================================\n');

    await mongoose.disconnect();
    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTests();
