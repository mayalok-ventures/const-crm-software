const assert = require('assert');
const express = require('express');
const http = require('http');
const axios = require('axios');

describe('RC-2 Dedicated Admin Route Rate Limiter', () => {
  let server;
  let baseUrl;
  let prevEnv;

  beforeAll(() => {
    prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = prevEnv;
  });

  afterEach(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
      server = null;
    }
  });

  it('should export adminLimiter from rateLimiter.js and throttle excessive admin requests with 429', async () => {
    const rateLimiterModule = require('../src/middleware/rateLimiter');
    assert.ok(rateLimiterModule.adminLimiter, 'adminLimiter must be exported from rateLimiter.js');

    const app = express();
    app.use(express.json());
    app.use('/api/admin', rateLimiterModule.adminLimiter, (req, res) => {
      res.json({ success: true, message: 'Admin endpoint response' });
    });

    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Request 1 with x-test-rate-limit header
    const res1 = await axios.get(`${baseUrl}/api/admin/overview`, {
      headers: { 'x-test-rate-limit': 'true' }
    });

    assert.strictEqual(res1.status, 200);
    assert.ok(res1.headers['ratelimit-limit'], 'RateLimit-Limit header must be present');
    assert.strictEqual(Number(res1.headers['ratelimit-limit']), 120, 'Admin rate limit must be 120 requests per window');

    // Fire 119 requests
    const promises = [];
    for (let i = 0; i < 119; i++) {
      promises.push(axios.get(`${baseUrl}/api/admin/overview`, {
        headers: { 'x-test-rate-limit': 'true' }
      }));
    }
    await Promise.all(promises);

    // Request 121 must be rejected with HTTP 429
    let error429 = null;
    try {
      await axios.get(`${baseUrl}/api/admin/overview`, {
        headers: { 'x-test-rate-limit': 'true' }
      });
    } catch (err) {
      error429 = err;
    }

    assert.ok(error429, '121st request must fail');
    assert.strictEqual(error429.response?.status, 429, 'Expected HTTP 429 Too Many Requests');
    assert.strictEqual(error429.response?.data?.code, 'ADMIN_RATE_LIMITED');
  });

  it('should skip rate limiting in test environment when x-test-rate-limit is not set', async () => {
    const rateLimiterModule = require('../src/middleware/rateLimiter');
    const app = express();
    app.use('/api/admin', rateLimiterModule.adminLimiter, (req, res) => {
      res.json({ success: true });
    });

    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    const res = await axios.get(`http://127.0.0.1:${port}/api/admin/overview`);
    assert.strictEqual(res.status, 200);
  });
});
