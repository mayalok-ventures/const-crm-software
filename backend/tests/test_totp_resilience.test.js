const assert = require('assert');
const speakeasy = require('speakeasy');
const dotenv = require('dotenv');
dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

const runTOTPTests = async () => {
  console.log('=================================================================');
  console.log('🧪 TOTP AUTHENTICATOR MISMATCH & RESILIENCE TEST SUITE');
  console.log('=================================================================\n');

  // 1. Register a test user
  const email = `totp_user_${Date.now()}@example.com`;
  const phone = `9877${Date.now().toString().slice(-6)}`;
  const password = 'Password@123';

  console.log('1. Registering new test user...');
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Dr. Arjun Verma',
      email,
      phone,
      password,
      industryType: 'Agency',
      workStatus: 'independent_agent'
    })
  });
  const regData = await regRes.json();
  assert.strictEqual(regRes.status, 201, 'User registration must return 201');
  const userToken = regData.token;
  console.log('   ✓ User registered successfully\n');

  // 2. Setup 2FA
  console.log('2. Requesting 2FA Setup & Emergency Recovery Codes...');
  const setupRes = await fetch(`${BASE_URL}/auth/2fa/setup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    }
  });
  const setupData = await setupRes.json();
  assert.strictEqual(setupRes.status, 200, '2FA setup must return 200');
  assert.ok(setupData.secret, 'Secret must be returned');
  assert.ok(setupData.qrCode, 'QR code data URL must be returned');
  assert.ok(Array.isArray(setupData.recoveryCodes), 'Recovery codes array must be returned');
  assert.strictEqual(setupData.recoveryCodes.length, 8, 'Must provide 8 recovery codes');
  console.log('   ✓ 2FA Secret:', setupData.secret);
  console.log('   ✓ 8 Emergency Recovery Codes generated:', setupData.recoveryCodes.slice(0, 2).join(', '), '...\n');

  // 3. Enable 2FA with live OTP
  console.log('3. Enabling 2FA with initial live OTP...');
  const liveOtp = speakeasy.totp({
    secret: setupData.secret,
    encoding: 'base32'
  });
  const enableRes = await fetch(`${BASE_URL}/auth/2fa/enable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      code: liveOtp
    })
  });
  const enableData = await enableRes.json();
  assert.strictEqual(enableRes.status, 200, 'Enable 2FA must return 200');
  assert.strictEqual(enableData.twoFactorEnabled, true);
  console.log('   ✓ 2FA successfully activated and locked\n');

  // 4. Test Login -> requires 2FA
  console.log('4. Testing Login -> Verifying 2FA Intercept Challenge...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginData.requires2FA, true, 'Login must require 2FA');
  assert.ok(loginData.tempToken, 'Temporary 2FA session token must be returned');
  console.log('   ✓ Login successfully returned 2FA challenge with tempToken\n');

  // 5. Test Verification with unformatted OTP (e.g. " 123 456 ")
  console.log('5. Testing OTP with whitespace and unformatted input...');
  const currentOtp = speakeasy.totp({
    secret: setupData.secret,
    encoding: 'base32'
  });
  const formattedOtp = ` ${currentOtp.slice(0, 3)} - ${currentOtp.slice(3)} `;
  const verifyRes1 = await fetch(`${BASE_URL}/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tempToken: loginData.tempToken,
      otp: formattedOtp
    })
  });
  const verifyData1 = await verifyRes1.json();
  assert.strictEqual(verifyRes1.status, 200, 'Unformatted OTP must be sanitized and verified');
  assert.ok(verifyData1.token, 'Authenticated JWT token must be returned');
  console.log('   ✓ Unformatted OTP successfully sanitized & verified\n');

  // 6. Test Clock Drift Tolerance (past step: -60s / future step: +60s)
  console.log('6. Testing Clock-Drifted OTP (+90s simulated mobile clock drift)...');
  const loginRes2 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password })
  });
  const loginData2 = await loginRes2.json();

  const driftedTime = Math.floor((Date.now() + 90000) / 1000); // 90s in future
  const driftedOtp = speakeasy.totp({
    secret: setupData.secret,
    encoding: 'base32',
    time: driftedTime
  });

  const verifyDrift = await fetch(`${BASE_URL}/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tempToken: loginData2.tempToken,
      otp: driftedOtp
    })
  });
  assert.strictEqual(verifyDrift.status, 200, 'Clock-drifted OTP must be accepted by expanded window');
  console.log('   ✓ Clock-drifted OTP (+90s) successfully verified\n');

  // 7. Test Emergency Recovery Code verification
  console.log('7. Testing Emergency Recovery Code login...');
  const loginRes3 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password })
  });
  const loginData3 = await loginRes3.json();

  const recoveryCodeToUse = setupData.recoveryCodes[0];
  const verifyRecovery = await fetch(`${BASE_URL}/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tempToken: loginData3.tempToken,
      recoveryCode: recoveryCodeToUse
    })
  });
  assert.strictEqual(verifyRecovery.status, 200, 'Recovery code must successfully authenticate');
  const verifyRecoveryData = await verifyRecovery.json();
  assert.ok(verifyRecoveryData.token, 'Must return session token');
  console.log('   ✓ Emergency Recovery Code (' + recoveryCodeToUse + ') successfully authenticated\n');

  // 8. Test Disable 2FA with Password confirmation
  console.log('8. Testing Disable 2FA endpoint...');
  const disableRes = await fetch(`${BASE_URL}/auth/2fa/disable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${verifyRecoveryData.token}`
    },
    body: JSON.stringify({ password })
  });
  assert.strictEqual(disableRes.status, 200, 'Disable 2FA must return 200');
  console.log('   ✓ 2FA successfully disabled with password confirmation\n');

  // 9. Verify subsequent login is direct (no 2FA challenge)
  console.log('9. Verifying direct password login after 2FA disabled...');
  const directLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password })
  });
  const directLoginData = await directLoginRes.json();
  assert.strictEqual(directLoginRes.status, 200);
  assert.strictEqual(directLoginData.requires2FA, undefined, 'Must not require 2FA');
  assert.ok(directLoginData.token, 'Must return direct token');
  console.log('   ✓ Direct login successful without 2FA challenge\n');

  console.log('=================================================================');
  console.log('🏆 ALL TOTP RESILIENCE & MISMATCH PREVENTION TESTS PASSED 100%!');
  console.log('=================================================================\n');
  process.exit(0);
};

runTOTPTests().catch(err => {
  console.error('❌ TOTP Test Suite failed:', err);
  process.exit(1);
});
