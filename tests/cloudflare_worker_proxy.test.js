/**
 * Sahyak CRM — Cloudflare Worker API Proxy Comprehensive Test Suite
 *
 * Validates worker.js against:
 * 1. Missing BACKEND_URL handling (500 MISSING_BACKEND_URL)
 * 2. Valid BACKEND_URL handling (200 / 201)
 * 3. Invalid backend URL handling (500 INVALID_BACKEND_URL)
 * 4. HTTPS protocol enforcement (500 HTTPS_REQUIRED)
 * 5. Multi-source runtime resolution (env, globalThis, process.env)
 * 6. GET and POST proxying with JSON body
 * 7. Query string and path preservation
 * 8. Authorization and cookie header forwarding
 * 9. CORS and OPTIONS preflight handling
 * 10. Upstream error handling (502 UPSTREAM_UNAVAILABLE)
 * 11. Proxy loop detection (508 PROXY_LOOP_DETECTED)
 */

const http = require('http');
const assert = require('assert');

let mockServer;
let mockServerPort;
let lastUpstreamRequest = null;

// Spin up a lightweight mock upstream server representing Render Web Service
function startMockUpstream() {
  return new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      let bodyChunks = [];
      req.on('data', chunk => bodyChunks.push(chunk));
      req.on('end', () => {
        const bodyStr = Buffer.concat(bodyChunks).toString();
        lastUpstreamRequest = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: bodyStr
        };

        if (req.url === '/health/live') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'X-Backend-Service': 'render-web-service'
          });
          return res.end(JSON.stringify({ status: 'HEALTHY', uptime: 3600 }));
        }

        if (req.url === '/api/leads?status=new&page=2') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': 'session_probe=active; Path=/; Secure; HttpOnly'
          });
          return res.end(JSON.stringify({ success: true, count: 2, queryReceived: req.url }));
        }

        if (req.method === 'POST' && req.url === '/api/leads') {
          res.writeHead(201, {
            'Content-Type': 'application/json'
          });
          return res.end(JSON.stringify({ success: true, received: JSON.parse(bodyStr || '{}') }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: req.url }));
      });
    });

    mockServer.listen(0, '127.0.0.1', () => {
      mockServerPort = mockServer.address().port;
      resolve(mockServerPort);
    });
  });
}

function stopMockUpstream() {
  return new Promise((resolve) => {
    if (mockServer) {
      mockServer.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function runWorkerTests() {
  console.log('\n========================================================');
  console.log('   CLOUDFLARE WORKER API PROXY TEST SUITE               ');
  console.log('========================================================\n');

  // Dynamic import of worker.js (ES Module)
  const workerModule = await import('../worker.js');
  const worker = workerModule.default;
  const { resolveBackendUrl, resolveAllowedOrigin } = workerModule;

  const upstreamPort = await startMockUpstream();
  const validBackendUrl = `http://127.0.0.1:${upstreamPort}`;

  let passed = 0;
  let failed = 0;

  async function testAsync(description, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${description}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  }

  try {
    // ---------------------------------------------------------
    // 1. Missing BACKEND_URL handling
    // ---------------------------------------------------------
    console.log('🔹 1. Testing Missing BACKEND_URL Handling...');

    await testAsync('Fails safely with 500 when BACKEND_URL is completely missing', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads');
      const res = await worker.fetch(req, {});
      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.code, 'MISSING_BACKEND_URL');
      assert.ok(json.message.includes('not configured'));
    });

    await testAsync('Fails safely with 500 when BACKEND_URL is whitespace or empty', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads');
      const res = await worker.fetch(req, { BACKEND_URL: '   ' });
      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.code, 'MISSING_BACKEND_URL');
    });

    // ---------------------------------------------------------
    // 2. Invalid Backend URL Handling
    // ---------------------------------------------------------
    console.log('🔹 2. Testing Invalid Backend URL Handling...');

    await testAsync('Fails safely with 500 when BACKEND_URL is malformed', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads');
      const res = await worker.fetch(req, { BACKEND_URL: 'not-a-valid-url:::' });
      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.code, 'INVALID_BACKEND_URL');
    });

    // ---------------------------------------------------------
    // 3. HTTPS Protocol Enforcement
    // ---------------------------------------------------------
    console.log('🔹 3. Testing HTTPS Protocol Enforcement...');

    await testAsync('Rejects plain HTTP URLs with HTTPS_REQUIRED when running in production', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads');
      const res = await worker.fetch(req, {
        BACKEND_URL: 'http://sahyak-api.onrender.com',
        ENVIRONMENT: 'production'
      });
      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.code, 'HTTPS_REQUIRED');
      assert.ok(json.message.includes('HTTPS'));
    });

    await testAsync('Accepts valid HTTPS URL in production', async () => {
      // Validates URL parsing logic for https target
      const resolved = resolveBackendUrl({ BACKEND_URL: 'https://sahyak-api.onrender.com' });
      assert.strictEqual(resolved, 'https://sahyak-api.onrender.com');
      const parsed = new URL(resolved);
      assert.strictEqual(parsed.protocol, 'https:');
    });

    // ---------------------------------------------------------
    // 4. Multi-Source Runtime Environment Resolution
    // ---------------------------------------------------------
    console.log('🔹 4. Testing Multi-Source Runtime Environment Resolution...');

    await testAsync('Resolves BACKEND_URL when passed in ES module env object', async () => {
      const resolved = resolveBackendUrl({ BACKEND_URL: 'https://sahyak-api.onrender.com' });
      assert.strictEqual(resolved, 'https://sahyak-api.onrender.com');
    });

    await testAsync('Resolves BACKEND_URL when bound globally on globalThis (Service Worker mode)', async () => {
      globalThis.BACKEND_URL = 'https://sahyak-api.onrender.com';
      try {
        const resolved = resolveBackendUrl({});
        assert.strictEqual(resolved, 'https://sahyak-api.onrender.com');
      } finally {
        delete globalThis.BACKEND_URL;
      }
    });

    // ---------------------------------------------------------
    // 5. GET & POST Proxying
    // ---------------------------------------------------------
    console.log('🔹 5. Testing GET & POST Proxying...');

    await testAsync('GET /health/live forwards cleanly and returns upstream body and status 200', async () => {
      const req = new Request('https://api-app.sahyak.com/health/live', {
        method: 'GET',
        headers: { Origin: 'https://app.sahyak.com' }
      });

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl, ENVIRONMENT: 'test' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), 'https://app.sahyak.com');
      assert.strictEqual(res.headers.get('X-Proxied-By'), 'Sahyak-API-Gateway');
      assert.strictEqual(res.headers.get('X-Backend-Service'), 'render-web-service');

      const json = await res.json();
      assert.strictEqual(json.status, 'HEALTHY');
      assert.strictEqual(lastUpstreamRequest.url, '/health/live');
      assert.strictEqual(lastUpstreamRequest.method, 'GET');
    });

    await testAsync('POST /api/leads forwards exact JSON payload without corruption', async () => {
      const payload = {
        name: 'Aarav Sharma',
        phone: '9876543210',
        course: 'B.Tech CSE',
        source: 'Website Form'
      };

      const req = new Request('https://api-app.sahyak.com/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://app.sahyak.com'
        },
        body: JSON.stringify(payload)
      });

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl, ENVIRONMENT: 'test' });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(lastUpstreamRequest.method, 'POST');
      assert.strictEqual(lastUpstreamRequest.headers['content-type'], 'application/json');
      assert.deepStrictEqual(JSON.parse(lastUpstreamRequest.body), payload);
    });

    // ---------------------------------------------------------
    // 6. Query String & Path Preservation
    // ---------------------------------------------------------
    console.log('🔹 6. Testing Query String & Path Preservation...');

    await testAsync('Preserves complex query string parameters (/api/leads?status=new&page=2)', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads?status=new&page=2', {
        method: 'GET',
        headers: { Origin: 'https://app.sahyak.com' }
      });

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl, ENVIRONMENT: 'test' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(lastUpstreamRequest.url, '/api/leads?status=new&page=2');

      const json = await res.json();
      assert.strictEqual(json.queryReceived, '/api/leads?status=new&page=2');
      assert.ok(res.headers.get('Set-Cookie').includes('session_probe=active'));
    });

    // ---------------------------------------------------------
    // 7. Authorization & Custom Header Forwarding
    // ---------------------------------------------------------
    console.log('🔹 7. Testing Authorization & Header Forwarding...');

    await testAsync('Preserves Authorization bearer token, Cookies, and custom workspace headers', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads', {
        method: 'GET',
        headers: {
          'Origin': 'https://app.sahyak.com',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
          'Cookie': 'auth_token=super_secret_cookie; workspace=ws_123',
          'X-Workspace-Id': 'ws_mayalok_2026',
          'X-Request-Id': 'req_custom_trace_999'
        }
      });

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl, ENVIRONMENT: 'test' });
      assert.strictEqual(res.status, 200);

      assert.strictEqual(lastUpstreamRequest.headers['authorization'], 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy');
      assert.strictEqual(lastUpstreamRequest.headers['cookie'], 'auth_token=super_secret_cookie; workspace=ws_123');
      assert.strictEqual(lastUpstreamRequest.headers['x-workspace-id'], 'ws_mayalok_2026');
      assert.strictEqual(lastUpstreamRequest.headers['x-request-id'], 'req_custom_trace_999');
      assert.strictEqual(lastUpstreamRequest.headers['x-forwarded-host'], 'api-app.sahyak.com');
      assert.strictEqual(lastUpstreamRequest.headers['host'], `127.0.0.1:${upstreamPort}`);
    });

    // ---------------------------------------------------------
    // 8. CORS & OPTIONS Preflight
    // ---------------------------------------------------------
    console.log('🔹 8. Testing CORS & OPTIONS Preflight...');

    await testAsync('OPTIONS returns 204 with CORS headers for https://app.sahyak.com', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://app.sahyak.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      });

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl, ENVIRONMENT: 'test' });
      assert.strictEqual(res.status, 204);
      assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), 'https://app.sahyak.com');
      assert.strictEqual(res.headers.get('Access-Control-Allow-Credentials'), 'true');
      assert.ok(res.headers.get('Access-Control-Allow-Methods').includes('POST'));
    });

    await testAsync('OPTIONS returns 403 Forbidden for unauthorized external origin', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://malicious-phishing-site.com',
          'Access-Control-Request-Method': 'GET'
        }
      });

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl, ENVIRONMENT: 'test' });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error, 'CORS Forbidden');
    });

    await testAsync('Allows Cloudflare Pages preview (*.pages.dev) and crm.sahyak.com subdomains', async () => {
      const pagesOrigin = resolveAllowedOrigin('https://const-crm-software.pages.dev', { ENVIRONMENT: 'test' });
      assert.strictEqual(pagesOrigin, 'https://const-crm-software.pages.dev');

      const crmOrigin = resolveAllowedOrigin('https://crm.sahyak.com', { ENVIRONMENT: 'test' });
      assert.strictEqual(crmOrigin, 'https://crm.sahyak.com');
    });

    // ---------------------------------------------------------
    // 9. Upstream Error Handling & Loop Detection
    // ---------------------------------------------------------
    console.log('🔹 9. Testing Upstream Error Handling & Loop Detection...');

    await testAsync('Detects proxy loop and returns 508 when upstream matches gateway domain', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads');
      const res = await worker.fetch(req, { BACKEND_URL: 'https://api-app.sahyak.com', ENVIRONMENT: 'test' });
      assert.strictEqual(res.status, 508);
      const json = await res.json();
      assert.strictEqual(json.code, 'PROXY_LOOP_DETECTED');
    });

    await testAsync('Returns 502 Bad Gateway with CORS headers when upstream server is down', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads', {
        method: 'GET',
        headers: { 'Origin': 'https://app.sahyak.com' }
      });
      const res = await worker.fetch(req, { BACKEND_URL: 'http://127.0.0.1:59999', ENVIRONMENT: 'test' });
      assert.strictEqual(res.status, 502);
      assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), 'https://app.sahyak.com');
      const json = await res.json();
      assert.strictEqual(json.code, 'UPSTREAM_UNAVAILABLE');
    });

  } finally {
    await stopMockUpstream();
  }

  console.log('\n========================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkerTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
