/**
 * RC-5 Item 2 Test: CORS Hardening & Non-Browser Origin Verification
 * 
 * Verifies:
 * 1. Non-browser requests without an Origin header (webhooks, curl) do NOT receive Access-Control-Allow-Origin: *
 * 2. Wildcard *.pages.dev and *.onrender.com origins are rejected unless explicitly listed in ALLOWED_ORIGINS
 * 3. Legitimate sahyak.com subdomains (app.sahyak.com, crm.sahyak.com) remain allowed
 * 4. Explicit origins in ALLOWED_ORIGINS are honored
 * 5. Blocked origins receive 403 on OPTIONS preflight and do not receive allow headers
 */

const assert = require('assert');
const http = require('http');
const express = require('express');

function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body: json || data });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(75));
  console.log('🧪 RC-5 ITEM 2: CORS HARDENING & NON-BROWSER REQUEST VERIFICATION');
  console.log('='.repeat(75));

  // Configure test environment origins
  process.env.NODE_ENV = 'production';
  process.env.ALLOWED_ORIGINS = 'https://custom-partner.example.com,https://exact-deployment.pages.dev';

  // 1. Verify server.js source code does not emit wildcard Access-Control-Allow-Origin: *
  const serverCode = require('fs').readFileSync(require('path').resolve(__dirname, '../server.js'), 'utf8');
  const hasWildcardHeader = /res\.setHeader\(\s*['"]Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"]\s*\)/.test(serverCode);
  const hasWildcardPagesDev = /\/\^https:\\\/\\\/.*pages\\\.dev\$\//.test(serverCode);
  const hasWildcardOnrender = /\/\^https:\\\/\\\/.*onrender\\\.com\$\//.test(serverCode);

  console.log(`\n1. Static Code Analysis on backend/server.js:`);
  console.log(`   Has wildcard Access-Control-Allow-Origin: * ? ${hasWildcardHeader ? 'YES (UNSAFE)' : 'NO (SAFE)'}`);
  console.log(`   Has wildcard *.pages.dev regex? ${hasWildcardPagesDev ? 'YES (UNSAFE)' : 'NO (SAFE)'}`);
  console.log(`   Has wildcard *.onrender.com regex? ${hasWildcardOnrender ? 'YES (UNSAFE)' : 'NO (SAFE)'}`);

  assert.strictEqual(
    hasWildcardHeader,
    false,
    'FAIL: server.js must NOT emit res.setHeader("Access-Control-Allow-Origin", "*") for requests without Origin'
  );
  assert.strictEqual(
    hasWildcardPagesDev,
    false,
    'FAIL: server.js must NOT allow arbitrary *.pages.dev wildcards. Use ALLOWED_ORIGINS instead.'
  );
  assert.strictEqual(
    hasWildcardOnrender,
    false,
    'FAIL: server.js must NOT allow arbitrary *.onrender.com wildcards. Use ALLOWED_ORIGINS instead.'
  );

  // 2. Boot up real server instance or test Express app with server.js CORS logic
  // Let's create an app with the exact CORS logic from server.js
  const app = express();
  
  // Re-read server.js functions
  // We can dynamically evaluate the server's getAllowedOrigins and isOriginAllowed by booting a minimal server app
  // or testing live server routes
  const { getAllowedOrigins, isOriginAllowed, corsMiddleware } = require('../src/utils/corsConfig');

  app.use(corsMiddleware);
  app.get('/webhook/test', (req, res) => res.json({ ok: true, source: 'meta_webhook' }));
  app.get('/api/leads', (req, res) => res.json({ ok: true, leads: [] }));

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  try {
    // 2. Non-browser request (webhook) with NO Origin header
    console.log('\n2. Testing webhook request without Origin header...');
    const webhookRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/webhook/test',
      method: 'GET',
    });
    assert.strictEqual(webhookRes.statusCode, 200);
    assert.strictEqual(
      webhookRes.headers['access-control-allow-origin'],
      undefined,
      'Non-browser request without Origin must NOT receive Access-Control-Allow-Origin header'
    );
    console.log('   ✅ Webhook without Origin succeeded with HTTP 200 and NO Access-Control-Allow-Origin header');

    // 3. Legitimate company domain (app.sahyak.com)
    console.log('\n3. Testing legitimate origin https://app.sahyak.com...');
    const sahyakRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/leads',
      method: 'GET',
      headers: { 'Origin': 'https://app.sahyak.com' }
    });
    assert.strictEqual(sahyakRes.statusCode, 200);
    assert.strictEqual(sahyakRes.headers['access-control-allow-origin'], 'https://app.sahyak.com');
    assert.strictEqual(sahyakRes.headers['access-control-allow-credentials'], 'true');
    console.log('   ✅ https://app.sahyak.com allowed with credentials');

    // 4. Subdomain of sahyak.com (crm.sahyak.com)
    console.log('\n4. Testing corporate subdomain https://crm.sahyak.com...');
    const crmRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/leads',
      method: 'GET',
      headers: { 'Origin': 'https://crm.sahyak.com' }
    });
    assert.strictEqual(crmRes.statusCode, 200);
    assert.strictEqual(crmRes.headers['access-control-allow-origin'], 'https://crm.sahyak.com');
    console.log('   ✅ https://crm.sahyak.com allowed with credentials');

    // 5. Arbitrary unlisted *.pages.dev (must be BLOCKED)
    console.log('\n5. Testing unlisted wildcard origin https://malicious-phishing.pages.dev...');
    const maliciousPagesRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/leads',
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://malicious-phishing.pages.dev',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.strictEqual(maliciousPagesRes.statusCode, 403);
    assert.strictEqual(maliciousPagesRes.headers['access-control-allow-origin'], undefined);
    console.log('   ✅ https://malicious-phishing.pages.dev blocked with HTTP 403 on preflight');

    // 6. Arbitrary unlisted *.onrender.com (must be BLOCKED)
    console.log('\n6. Testing unlisted wildcard origin https://evil-attacker.onrender.com...');
    const maliciousRenderRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/leads',
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://evil-attacker.onrender.com',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.strictEqual(maliciousRenderRes.statusCode, 403);
    assert.strictEqual(maliciousRenderRes.headers['access-control-allow-origin'], undefined);
    console.log('   ✅ https://evil-attacker.onrender.com blocked with HTTP 403 on preflight');

    // 7. Explicitly allowed pages.dev origin from ALLOWED_ORIGINS
    console.log('\n7. Testing explicit allowed origin https://exact-deployment.pages.dev...');
    const explicitPagesRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/leads',
      method: 'GET',
      headers: { 'Origin': 'https://exact-deployment.pages.dev' }
    });
    assert.strictEqual(explicitPagesRes.statusCode, 200);
    assert.strictEqual(explicitPagesRes.headers['access-control-allow-origin'], 'https://exact-deployment.pages.dev');
    console.log('   ✅ Explicit https://exact-deployment.pages.dev allowed');

    console.log('\n🎉 ALL RC-5 ITEM 2 TESTS PASSED!');
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n❌ RC-5 ITEM 2 TEST FAILED:');
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { runTests };
