/**
 * Sahyak CRM — Cloudflare Worker API Proxy Test Suite
 *
 * Validates worker.js against:
 * 1. OPTIONS preflight requests (authorized & unauthorized origins)
 * 2. GET health endpoints (/health/live, /health, /api/health)
 * 3. Authenticated API requests (Authorization headers & cookies preservation)
 * 4. POST requests with JSON payload preservation
 * 5. Query parameters preservation
 * 6. CORS policy enforcement for https://app.sahyak.com and subdomains
 * 7. Invalid upstream URL & upstream connection failure handling
 * 8. Proxy loop detection
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

  const upstreamPort = await startMockUpstream();
  const validBackendUrl = `http://127.0.0.1:${upstreamPort}`;

  let passed = 0;
  let failed = 0;

  function test(description, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${description}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  }

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
    // 1. OPTIONS Preflight Handling
    // ---------------------------------------------------------
    console.log('🔹 1. Testing OPTIONS Preflight & CORS Resolution...');

    await testAsync('OPTIONS returns 204 with CORS headers for https://app.sahyak.com', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://app.sahyak.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      });

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl });
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

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error, 'CORS Forbidden');
    });

    // ---------------------------------------------------------
    // 2. Health Endpoint Forwarding
    // ---------------------------------------------------------
    console.log('🔹 2. Testing Health Endpoint Forwarding...');

    await testAsync('GET /health/live forwards cleanly to upstream and returns 200', async () => {
      const req = new Request('https://api-app.sahyak.com/health/live', {
        method: 'GET',
        headers: {
          'Origin': 'https://app.sahyak.com'
        }
      });

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), 'https://app.sahyak.com');
      assert.strictEqual(res.headers.get('X-Proxied-By'), 'Sahyak-API-Gateway');
      assert.strictEqual(res.headers.get('X-Backend-Service'), 'render-web-service');

      const json = await res.json();
      assert.strictEqual(json.status, 'HEALTHY');
      assert.strictEqual(lastUpstreamRequest.url, '/health/live');
      assert.strictEqual(lastUpstreamRequest.method, 'GET');
    });

    // ---------------------------------------------------------
    // 3. Authenticated Request & Headers Preservation
    // ---------------------------------------------------------
    console.log('🔹 3. Testing Authentication & Headers Preservation...');

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

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl });
      assert.strictEqual(res.status, 200);

      // Verify what upstream received
      assert.strictEqual(lastUpstreamRequest.headers['authorization'], 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy');
      assert.strictEqual(lastUpstreamRequest.headers['cookie'], 'auth_token=super_secret_cookie; workspace=ws_123');
      assert.strictEqual(lastUpstreamRequest.headers['x-workspace-id'], 'ws_mayalok_2026');
      assert.strictEqual(lastUpstreamRequest.headers['x-request-id'], 'req_custom_trace_999');
      assert.strictEqual(lastUpstreamRequest.headers['x-forwarded-host'], 'api-app.sahyak.com');
      assert.strictEqual(lastUpstreamRequest.headers['host'], `127.0.0.1:${upstreamPort}`);
    });

    // ---------------------------------------------------------
    // 4. POST Request with JSON Body Preservation
    // ---------------------------------------------------------
    console.log('🔹 4. Testing POST Request with JSON Body...');

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

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl });
      assert.strictEqual(res.status, 201);

      assert.strictEqual(lastUpstreamRequest.method, 'POST');
      assert.strictEqual(lastUpstreamRequest.headers['content-type'], 'application/json');
      assert.deepStrictEqual(JSON.parse(lastUpstreamRequest.body), payload);
    });

    // ---------------------------------------------------------
    // 5. Query Parameters Preservation
    // ---------------------------------------------------------
    console.log('🔹 5. Testing Query Parameters Preservation...');

    await testAsync('Preserves complex query string parameters (/api/leads?status=new&page=2)', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads?status=new&page=2', {
        method: 'GET',
        headers: {
          'Origin': 'https://app.sahyak.com'
        }
      });

      const res = await worker.fetch(req, { BACKEND_URL: validBackendUrl });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(lastUpstreamRequest.url, '/api/leads?status=new&page=2');

      const json = await res.json();
      assert.strictEqual(json.queryReceived, '/api/leads?status=new&page=2');
      // Verify Set-Cookie forwarded back to client
      assert.ok(res.headers.get('Set-Cookie').includes('session_probe=active'));
    });

    // ---------------------------------------------------------
    // 6. CORS Coverage: Pages.dev and Sahyak Subdomains
    // ---------------------------------------------------------
    console.log('🔹 6. Testing Dynamic CORS Policies...');

    await testAsync('Allows Cloudflare Pages preview (*.pages.dev) and secondary subdomains', async () => {
      const pagesReq = new Request('https://api-app.sahyak.com/health/live', {
        method: 'GET',
        headers: { 'Origin': 'https://const-crm-software.pages.dev' }
      });
      const pagesRes = await worker.fetch(pagesReq, { BACKEND_URL: validBackendUrl });
      assert.strictEqual(pagesRes.headers.get('Access-Control-Allow-Origin'), 'https://const-crm-software.pages.dev');

      const crmReq = new Request('https://api-app.sahyak.com/health/live', {
        method: 'GET',
        headers: { 'Origin': 'https://crm.sahyak.com' }
      });
      const crmRes = await worker.fetch(crmReq, { BACKEND_URL: validBackendUrl });
      assert.strictEqual(crmRes.headers.get('Access-Control-Allow-Origin'), 'https://crm.sahyak.com');
    });

    // ---------------------------------------------------------
    // 7. Error Handling, Loop Prevention & Missing Configurations
    // ---------------------------------------------------------
    console.log('🔹 7. Testing Error Handling & Gateway Safeguards...');

    await testAsync('Fails safely with 500 when BACKEND_URL is missing', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads');
      const res = await worker.fetch(req, {});
      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.code, 'MISSING_BACKEND_URL');
    });

    await testAsync('Fails safely with 500 when BACKEND_URL is malformed', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads');
      const res = await worker.fetch(req, { BACKEND_URL: 'htp://invalid-target' });
      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.code, 'INVALID_BACKEND_URL');
    });

    await testAsync('Detects proxy loop and returns 508 when upstream matches gateway domain', async () => {
      const req = new Request('https://api-app.sahyak.com/api/leads');
      const res = await worker.fetch(req, { BACKEND_URL: 'https://api-app.sahyak.com' });
      assert.strictEqual(res.status, 508);
      const json = await res.json();
      assert.strictEqual(json.code, 'PROXY_LOOP_DETECTED');
    });

    await testAsync('Returns 502 Bad Gateway when upstream server is down / connection refused', async () => {
      // Port 59999 is unassigned and closed
      const req = new Request('https://api-app.sahyak.com/api/leads', {
        method: 'GET',
        headers: { 'Origin': 'https://app.sahyak.com' }
      });
      const res = await worker.fetch(req, { BACKEND_URL: 'http://127.0.0.1:59999' });
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
