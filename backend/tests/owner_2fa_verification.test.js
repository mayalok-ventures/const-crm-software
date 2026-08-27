const assert = require('assert');
const speakeasy = require('speakeasy');
const dotenv = require('dotenv');
dotenv.config();

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runOwner2FATestSuite() {
  console.log('\n=================================================================');
  console.log('🔒 OWNER-ONLY 2FA SETUP & SUPER ADMIN ISOLATION TEST SUITE');
  console.log('=================================================================\n');

  const timestamp = Date.now();
  const ownerEmail = `owner_2fa_${timestamp}@example.com`;
  const ownerPhone = `9811${timestamp.toString().slice(-6)}`;
  const ownerPassword = 'OwnerPassword@123';

  const agentEmail = `agent_${timestamp}@example.com`;
  const agentPhone = `9822${timestamp.toString().slice(-6)}`;
  const agentPassword = 'AgentPassword@123';

  const superAdminEmail = `superadmin_${timestamp}@crm.com`;
  const superAdminPassword = 'SuperAdminPassword@123';

  // ─────────────────────────────────────────────────────────────
  // 1. REGISTER OWNER & AGENT
  // ─────────────────────────────────────────────────────────────
  console.log('1. Registering Owner and Agent accounts...');
  
  // Register Owner (workStatus: company_owner)
  const regOwnerRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Executive Owner',
      email: ownerEmail,
      phone: ownerPhone,
      password: ownerPassword,
      workStatus: 'company_owner',
      industryType: 'Agency',
      companyName: 'Owner Enterprise Corp',
    }),
  });
  const regOwnerData = await regOwnerRes.json();
  assert.strictEqual(regOwnerRes.status, 201, 'Owner registration must return 201');
  const ownerToken = regOwnerData.token;
  console.log('   ✓ Owner registered successfully (2FA disabled by default)');

  // Register Agent (workStatus: independent_agent)
  const regAgentRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Field Sales Agent',
      email: agentEmail,
      phone: agentPhone,
      password: agentPassword,
      workStatus: 'independent_agent',
      industryType: 'Agency',
    }),
  });
  const regAgentData = await regAgentRes.json();
  assert.strictEqual(regAgentRes.status, 201, 'Agent registration must return 201');
  const agentToken = regAgentData.token;
  console.log('   ✓ Agent registered successfully\n');

  // ─────────────────────────────────────────────────────────────
  // 2. CHECK 2FA STATUS (INITIAL STATE)
  // ─────────────────────────────────────────────────────────────
  console.log('2. Checking initial 2FA status...');
  const statusRes = await fetch(`${BASE_URL}/auth/2fa/status`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` },
  });
  const statusData = await statusRes.json();
  assert.strictEqual(statusRes.status, 200);
  assert.strictEqual(statusData.twoFactorEnabled, false, 'Owner 2FA must initially be disabled');
  console.log('   ✓ Owner 2FA status verified: Disabled (twoFactorEnabled = false)\n');

  // ─────────────────────────────────────────────────────────────
  // 3. OWNER 2FA SETUP INITIATION (TEMPORARY ENROLLMENT)
  // ─────────────────────────────────────────────────────────────
  console.log('3. Owner requesting 2FA setup generation...');
  const setupRes = await fetch(`${BASE_URL}/auth/2fa/setup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
  });
  const setupData = await setupRes.json();
  assert.strictEqual(setupRes.status, 200, '2FA setup must return 200');
  assert.ok(setupData.secret, 'Setup must return base32 secret');
  assert.ok(setupData.qrCode, 'Setup must return QR code image data URL');
  assert.ok(Array.isArray(setupData.recoveryCodes), 'Setup must return 8 recovery codes');
  assert.strictEqual(setupData.recoveryCodes.length, 8, 'Must return exactly 8 recovery codes');
  console.log('   ✓ Generated temporary TOTP enrollment secret and QR Code');
  console.log('   ✓ 8 Emergency Recovery Codes generated:', setupData.recoveryCodes.slice(0, 2).join(', '), '...\n');

  // Verify that twoFactorSecret is NOT exposed in GET /api/auth/me
  console.log('4. Verifying sensitive secrets are stripped from API serialization...');
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` },
  });
  const meData = await meRes.json();
  assert.strictEqual(meData.twoFactorSecret, undefined, 'twoFactorSecret must NEVER be returned in /auth/me');
  assert.strictEqual(meData.twoFactorTempSecret, undefined, 'twoFactorTempSecret must NEVER be returned in /auth/me');
  assert.strictEqual(meData.twoFactorEnabled, false, '2FA must remain false before OTP verification');
  console.log('   ✓ Security check passed: All 2FA secret fields stripped from user object\n');

  // ─────────────────────────────────────────────────────────────
  // 5. NON-OWNER ACCESS CHECK (Agent cannot call 2FA setup)
  // ─────────────────────────────────────────────────────────────
  console.log('5. Verifying Agent cannot initiate Owner 2FA setup...');
  const agentSetupRes = await fetch(`${BASE_URL}/auth/2fa/setup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentToken}`,
    },
  });
  assert.strictEqual(agentSetupRes.status, 403, 'Agent must receive 403 Forbidden on Owner 2FA setup');
  console.log('   ✓ Agent blocked from Owner 2FA setup (HTTP 403 Forbidden)\n');

  // ─────────────────────────────────────────────────────────────
  // 6. INVALID OTP VERIFICATION REJECTION
  // ─────────────────────────────────────────────────────────────
  console.log('6. Testing Invalid OTP verification rejection...');
  const wrongOtpRes = await fetch(`${BASE_URL}/auth/2fa/enable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ code: '000000' }),
  });
  assert.strictEqual(wrongOtpRes.status, 400, 'Invalid OTP must return HTTP 400');
  
  // Verify 2FA still disabled
  const statusAfterWrong = await fetch(`${BASE_URL}/auth/2fa/status`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` },
  });
  const statusAfterWrongData = await statusAfterWrong.json();
  assert.strictEqual(statusAfterWrongData.twoFactorEnabled, false, '2FA must remain disabled after wrong OTP');
  console.log('   ✓ Invalid OTP rejected, 2FA remains disabled\n');

  // ─────────────────────────────────────────────────────────────
  // 7. VALID OTP ENABLING & ACTIVATION
  // ─────────────────────────────────────────────────────────────
  console.log('7. Testing Valid OTP verification and 2FA activation...');
  const liveOtp = speakeasy.totp({
    secret: setupData.secret,
    encoding: 'base32',
  });

  const enableRes = await fetch(`${BASE_URL}/auth/2fa/enable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ code: liveOtp }),
  });
  const enableData = await enableRes.json();
  assert.strictEqual(enableRes.status, 200, 'Valid OTP must activate 2FA with 200 OK');
  assert.strictEqual(enableData.twoFactorEnabled, true, 'Response must confirm twoFactorEnabled = true');

  // Verify 2FA status is now enabled
  const statusAfterEnable = await fetch(`${BASE_URL}/auth/2fa/status`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` },
  });
  const statusAfterEnableData = await statusAfterEnable.json();
  assert.strictEqual(statusAfterEnableData.twoFactorEnabled, true, '2FA status must now be true');
  console.log('   ✓ 2FA successfully verified and permanently enabled! 🔒\n');

  // ─────────────────────────────────────────────────────────────
  // 8. PREVENT OVERWRITING ACTIVE 2FA
  // ─────────────────────────────────────────────────────────────
  console.log('8. Testing that re-requesting setup while 2FA is active is rejected...');
  const repeatSetupRes = await fetch(`${BASE_URL}/auth/2fa/setup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`,
    },
  });
  assert.strictEqual(repeatSetupRes.status, 400, 'Setup request while 2FA active must be rejected');
  console.log('   ✓ Protected: Active 2FA cannot be silently overwritten (HTTP 400)\n');

  // ─────────────────────────────────────────────────────────────
  // 9. OWNER LOGIN WITH 2FA CHALLENGE
  // ─────────────────────────────────────────────────────────────
  console.log('9. Testing Owner login with 2FA enabled...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: ownerEmail, password: ownerPassword }),
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginData.requires2FA, true, 'Owner login must require 2FA challenge');
  assert.ok(loginData.tempToken, 'Must receive temporary pending 2FA token');
  console.log('   ✓ Login successfully returned 2FA challenge with tempToken');

  // ─────────────────────────────────────────────────────────────
  // 10. PENDING 2FA TOKEN CANNOT ACCESS PROTECTED APIS
  // ─────────────────────────────────────────────────────────────
  console.log('10. Verifying pending 2FA token CANNOT access protected CRM endpoints...');
  const protectedRes = await fetch(`${BASE_URL}/leads`, {
    headers: { 'Authorization': `Bearer ${loginData.tempToken}` },
  });
  assert.strictEqual(protectedRes.status, 401, 'Pending 2FA token must receive 401 Unauthorized on protected routes');
  console.log('   ✓ Security check passed: Pending 2FA token is blocked from CRM endpoints\n');

  // ─────────────────────────────────────────────────────────────
  // 11. LOGIN 2FA VERIFICATION (WRONG OTP & CORRECT OTP)
  // ─────────────────────────────────────────────────────────────
  console.log('11. Testing Login 2FA verification with wrong OTP...');
  const wrongLoginVerify = await fetch(`${BASE_URL}/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tempToken: loginData.tempToken, otp: '111222' }),
  });
  assert.strictEqual(wrongLoginVerify.status, 400, 'Wrong login OTP must be rejected');
  console.log('   ✓ Wrong login OTP rejected');

  console.log('12. Testing Login 2FA verification with correct live OTP...');
  const loginOtp = speakeasy.totp({
    secret: setupData.secret,
    encoding: 'base32',
  });
  const correctLoginVerify = await fetch(`${BASE_URL}/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tempToken: loginData.tempToken, otp: loginOtp }),
  });
  const verifyData = await correctLoginVerify.json();
  assert.strictEqual(correctLoginVerify.status, 200, 'Correct OTP must complete login');
  assert.ok(verifyData.token, 'Must receive full authenticated JWT token');
  assert.strictEqual(verifyData.twoFactorEnabled, true);
  console.log('   ✓ Login 2FA verification successful! Received full JWT session\n');

  // ─────────────────────────────────────────────────────────────
  // 13. AGENT LOGIN (NO 2FA CHALLENGE)
  // ─────────────────────────────────────────────────────────────
  console.log('13. Testing Agent login (verifying no 2FA prompt for normal roles)...');
  const agentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: agentEmail, password: agentPassword }),
  });
  const agentLoginData = await agentLoginRes.json();
  assert.strictEqual(agentLoginRes.status, 200);
  assert.strictEqual(agentLoginData.requires2FA, undefined, 'Agent login must not require 2FA');
  assert.ok(agentLoginData.token, 'Agent receives direct session token');
  console.log('   ✓ Agent logged in directly without 2FA prompt\n');

  // ─────────────────────────────────────────────────────────────
  // 14. SUPER ADMIN ROUTE / API ISOLATION
  // ─────────────────────────────────────────────────────────────
  console.log('14. Testing Super Admin API isolation against Owner and Agent...');
  
  // Owner calling /api/super-admin/overview -> 403
  const ownerSuperRes = await fetch(`${BASE_URL}/super-admin/overview`, {
    headers: { 'Authorization': `Bearer ${verifyData.token}` },
  });
  assert.strictEqual(ownerSuperRes.status, 403, 'Owner must receive 403 Forbidden on Super Admin routes');
  console.log('   ✓ Owner blocked from /api/super-admin/* (HTTP 403 Forbidden)');

  // Agent calling /api/super-admin/overview -> 403
  const agentSuperRes = await fetch(`${BASE_URL}/super-admin/overview`, {
    headers: { 'Authorization': `Bearer ${agentLoginData.token}` },
  });
  assert.strictEqual(agentSuperRes.status, 403, 'Agent must receive 403 Forbidden on Super Admin routes');
  console.log('   ✓ Agent blocked from /api/super-admin/* (HTTP 403 Forbidden)\n');

  // ─────────────────────────────────────────────────────────────
  // 15. DISABLE 2FA WITH PASSWORD CONFIRMATION
  // ─────────────────────────────────────────────────────────────
  console.log('15. Testing Disable 2FA with wrong password...');
  const wrongPassDisable = await fetch(`${BASE_URL}/auth/2fa/disable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${verifyData.token}`,
    },
    body: JSON.stringify({ password: 'WrongPassword' }),
  });
  assert.strictEqual(wrongPassDisable.status, 401, 'Wrong password must return 401 Unauthorized');
  console.log('   ✓ Disable 2FA rejected with wrong password');

  console.log('16. Testing Disable 2FA with correct password...');
  const correctPassDisable = await fetch(`${BASE_URL}/auth/2fa/disable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${verifyData.token}`,
    },
    body: JSON.stringify({ password: ownerPassword }),
  });
  const disableData = await correctPassDisable.json();
  assert.strictEqual(correctPassDisable.status, 200);
  assert.strictEqual(disableData.twoFactorEnabled, false);
  console.log('   ✓ 2FA successfully disabled with password confirmation');

  // Subsequent login is now direct password login
  console.log('17. Verifying direct login after 2FA is disabled...');
  const directLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: ownerEmail, password: ownerPassword }),
  });
  const directLoginData = await directLogin.json();
  assert.strictEqual(directLogin.status, 200);
  assert.strictEqual(directLoginData.requires2FA, undefined, 'Must not require 2FA after disabling');
  assert.ok(directLoginData.token, 'Must return direct token');
  console.log('   ✓ Direct login successful without 2FA\n');

  console.log('=================================================================');
  console.log('🎉 ALL 17 OWNER 2FA & SUPER ADMIN ISOLATION TESTS PASSED 100%!');
  console.log('=================================================================\n');
}

runOwner2FATestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
