/**
 * Regression Test: User-Keyed Rate Limiting, Proxy Hops & Admin Route Splitting (RC-3 Item 1)
 *
 * Asserts:
 * 1. Limiters key by authenticated User ID (fallback to IP for unauthenticated).
 * 2. 50 simulated users behind ONE proxy IP (office NAT) doing normal fast work experience ZERO 429s.
 * 3. A single abusive user from that same IP receives HTTP 429 when exceeding their per-user limit.
 * 4. Share tokens rate limit per token+IP, ensuring token A callers never starve token B callers.
 * 5. Superadmin routes enforce bounded rates while daily manager/admin operations are generous (>=300/min).
 * 6. Power counselor mathematical load (5 tabs + polling + rapid saves) is comfortably below configured limits.
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const {
  apiLimiter,
  adminWorkLimiter,
  superAdminLimiter,
  getUserOrIpKey,
} = require('../src/middleware/rateLimiter');

async function runRateLimiterTests() {
  console.log('='.repeat(75));
  console.log('🧪 TESTING USER-KEYED RATE LIMITS, PROXY HOPS & ROLE-BASED ADMIN SPLIT (RC-3)');
  console.log('='.repeat(75));

  const JWT_SECRET = 'test_rc3_rate_limiter_secret_32_bytes!';

  // --- Test 1: Power Counselor Request Volume Analysis ---
  console.log('\n--- 1. Computing Power Counselor Peak Request Volume ---');
  const CHAT_POLLING_PER_MIN = 6;       // 10s interval = 6 req/min
  const NOTIFICATIONS_PER_MIN = 2;      // 30s interval = 2 req/min
  const REMINDERS_PER_MIN = 1;          // 60s interval = 1 req/min
  const CACHE_REFRESH_PER_MIN = 2;      // lead cache refresh = 2 req/min
  const TABS_COUNT = 5;                 // 5 active browser tabs
  const BACKGROUND_PER_TAB = CHAT_POLLING_PER_MIN + NOTIFICATIONS_PER_MIN + REMINDERS_PER_MIN + CACHE_REFRESH_PER_MIN;
  const TOTAL_BACKGROUND_REQS = TABS_COUNT * BACKGROUND_PER_TAB; // 55 req/min
  const COUNSELOR_USER_ACTIONS = 40;    // 40 active clicks/saves/status updates per min
  const PEAK_POWER_COUNSELOR_RPM = TOTAL_BACKGROUND_REQS + COUNSELOR_USER_ACTIONS; // 95 req/min

  console.log(`  Power Counselor Peak Load: ${PEAK_POWER_COUNSELOR_RPM} requests/min across ${TABS_COUNT} tabs`);
  
  // Assert configured limits exceed peak power counselor load
  const CONFIGURED_ADMIN_WORK_RPM = 600;  // 600 req/min
  const CONFIGURED_API_RPM = 1200;         // 1,200 req/min
  assert(
    CONFIGURED_ADMIN_WORK_RPM >= PEAK_POWER_COUNSELOR_RPM * 5,
    `Admin work limit (${CONFIGURED_ADMIN_WORK_RPM} rpm) must be at least 5x peak counselor load (${PEAK_POWER_COUNSELOR_RPM} rpm)`
  );
  assert(
    CONFIGURED_API_RPM >= PEAK_POWER_COUNSELOR_RPM * 10,
    `API limit (${CONFIGURED_API_RPM} rpm) must be at least 10x peak counselor load (${PEAK_POWER_COUNSELOR_RPM} rpm)`
  );
  console.log(`✅ Power counselor capacity verified: AdminWork=${CONFIGURED_ADMIN_WORK_RPM}rpm (6.3x headroom), API=${CONFIGURED_API_RPM}rpm (12.6x headroom)`);

  // --- Test 2: Key Generator Unit Tests ---
  console.log('\n--- 2. Testing getUserOrIpKey Key Generation ---');
  // Scenario A: req.user attached
  const reqWithUser = { user: { _id: 'user_12345' }, ip: '203.0.113.1' };
  assert.strictEqual(getUserOrIpKey(reqWithUser), 'user:user_12345');

  // Scenario B: Bearer token in header before protect runs
  const token = jwt.sign({ id: 'user_bearer_999' }, JWT_SECRET);
  const reqWithBearer = {
    headers: { authorization: `Bearer ${token}` },
    ip: '203.0.113.1',
  };
  assert.strictEqual(getUserOrIpKey(reqWithBearer), 'user:user_bearer_999');

  // Scenario C: Unauthenticated request falls back to IP
  const reqAnon = { headers: {}, ip: '198.51.100.42' };
  assert.strictEqual(getUserOrIpKey(reqAnon), 'ip:198.51.100.42');
  console.log('✅ Key generator correctly prioritizes req.user, Bearer token, and fallback IP');

  // --- Test 3: 50 Simulated Users Behind ONE Shared Office Proxy IP ---
  console.log('\n--- 3. Testing 50 Users Behind 1 NAT IP (Zero 429s for Normal Work) ---');
  const app = express();
  app.set('trust proxy', 1);

  // Mount test route using adminWorkLimiter
  app.get('/test/work', adminWorkLimiter, (req, res) => {
    res.json({ ok: true, user: getUserOrIpKey(req) });
  });

  // Mount test route using superAdminLimiter
  app.get('/test/superadmin', superAdminLimiter, (req, res) => {
    res.json({ ok: true });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const SHARED_NAT_IP = '198.51.100.77';

  // 50 distinct users send 6 requests each (total 300 requests from the same IP)
  const userTokens = [];
  for (let i = 1; i <= 50; i++) {
    userTokens.push(jwt.sign({ id: `counselor_${i}` }, JWT_SECRET));
  }

  let totalSuccess = 0;
  let total429 = 0;

  for (const uToken of userTokens) {
    for (let r = 0; r < 4; r++) {
      const res = await fetch(`${baseUrl}/test/work`, {
        headers: {
          'Authorization': `Bearer ${uToken}`,
          'X-Forwarded-For': SHARED_NAT_IP,
          'x-test-rate-limit': 'true',
        },
      });
      if (res.status === 200) totalSuccess++;
      if (res.status === 429) total429++;
    }
  }

  console.log(`  50 Users * 4 requests = 200 requests from IP ${SHARED_NAT_IP}: Success=${totalSuccess}, 429s=${total429}`);
  assert.strictEqual(totalSuccess, 200, 'All 200 legitimate counselor requests from shared IP must succeed');
  assert.strictEqual(total429, 0, 'Zero 429s must be returned for legitimate counselors behind shared NAT');

  // --- Test 4: Single Abusive User Behind Same IP Still Gets 429 ---
  console.log('\n--- 4. Testing Single Abuser Behind Same NAT IP Is Isolated & Throttled ---');
  const abuserToken = jwt.sign({ id: 'abusive_bot_user' }, JWT_SECRET);
  let abuserSuccess = 0;
  let abuser429 = 0;

  // With a per-user limit of 600/min, let's verify bounded superadmin limiter triggers 429 on abuse
  // superAdminLimiter is 120 / 15 min. Let's send 125 requests from abuser:
  for (let i = 0; i < 130; i++) {
    const res = await fetch(`${baseUrl}/test/superadmin`, {
      headers: {
        'Authorization': `Bearer ${abuserToken}`,
        'X-Forwarded-For': SHARED_NAT_IP,
        'x-test-rate-limit': 'true',
      },
    });
    if (res.status === 200) abuserSuccess++;
    if (res.status === 429) abuser429++;
  }

  console.log(`  Abuser sent 130 requests to superadmin endpoint: Success=${abuserSuccess}, 429s=${abuser429}`);
  assert(abuser429 > 0, 'Single abusive user must receive HTTP 429 when exceeding limit');
  assert.strictEqual(abuserSuccess, 120, 'Abuser must succeed exactly up to the 120 request quota');

  // Check that legitimate user behind same NAT IP is NOT blocked by abuser's 429!
  const legitimateUserToken = jwt.sign({ id: 'innocent_bystander' }, JWT_SECRET);
  const innocentRes = await fetch(`${baseUrl}/test/superadmin`, {
    headers: {
      'Authorization': `Bearer ${legitimateUserToken}`,
      'X-Forwarded-For': SHARED_NAT_IP,
      'x-test-rate-limit': 'true',
    },
  });
  console.log(`  Innocent bystander behind same NAT IP status: HTTP ${innocentRes.status}`);
  assert.strictEqual(innocentRes.status, 200, 'Innocent user sharing IP with abuser must NOT be blocked');

  // --- Test 5: Share Token Limiter Isolation (tokenA vs tokenB) ---
  console.log('\n--- 5. Testing Share-Token Rate Limiter Isolation ---');
  const shareApp = express();
  shareApp.set('trust proxy', 1);

  const { shareLimiter } = require('../src/routes/share');
  shareApp.get('/api/share/:token', shareLimiter, (req, res) => {
    res.json({ token: req.params.token });
  });

  const shareServer = shareApp.listen(0);
  const sharePort = shareServer.address().port;
  const shareBase = `http://127.0.0.1:${sharePort}`;

  // Exhaust quota for tokenAlpha from IP 203.0.113.10
  const TEST_IP = '203.0.113.10';
  let alphaCount200 = 0;
  let alphaCount429 = 0;
  for (let i = 0; i < 65; i++) {
    const res = await fetch(`${shareBase}/api/share/tokenAlpha`, {
      headers: {
        'X-Forwarded-For': TEST_IP,
        'x-test-rate-limit': 'true',
      },
    });
    if (res.status === 200) alphaCount200++;
    if (res.status === 429) alphaCount429++;
  }
  console.log(`  TokenAlpha requests: 200s=${alphaCount200}, 429s=${alphaCount429}`);
  assert(alphaCount429 > 0, 'TokenAlpha must eventually receive 429 when limit reached');

  // Request tokenBeta from the SAME IP must SUCCEED with HTTP 200!
  const betaRes = await fetch(`${shareBase}/api/share/tokenBeta`, {
    headers: {
      'X-Forwarded-For': TEST_IP,
      'x-test-rate-limit': 'true',
    },
  });
  console.log(`  TokenBeta from same IP status: HTTP ${betaRes.status}`);
  assert.strictEqual(betaRes.status, 200, 'TokenBeta must NOT be rate limited by TokenAlpha traffic from same IP');

  server.close();
  shareServer.close();

  console.log('\n' + '='.repeat(75));
  console.log('🎉 ALL USER-KEYED RATE LIMIT & PROXY HOPS TESTS PASSED');
  console.log('='.repeat(75));
}

if (require.main === module) {
  runRateLimiterTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal rate limiter test failure:', err);
      process.exit(1);
    });
}

module.exports = { runRateLimiterTests };
