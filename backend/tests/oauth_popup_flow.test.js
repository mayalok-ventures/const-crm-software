const assert = require('assert');
const { renderOAuthPopupBridge, escapeHtml } = require('../src/utils/oauthPopupBridge');
const metaOAuthController = require('../src/controllers/integrations/metaOAuthController');
const emailController = require('../src/controllers/emailController');
const googleOAuthController = require('../src/controllers/integrations/googleOAuthController');

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.headers['content-type'] = 'application/json';
      return this;
    },
    send(html) {
      this.body = html;
      this.headers['content-type'] = 'text/html';
      return this;
    },
    redirect(url) {
      this.statusCode = 302;
      this.redirectUrl = url;
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING OAUTH POPUP FLOW & BRIDGE AUDIT TEST SUITE');
  console.log('================================================================');

  let passed = 0;

  // 1. renderOAuthPopupBridge - Success HTML structure
  {
    const html = renderOAuthPopupBridge({
      success: true,
      provider: 'meta',
      message: 'Meta Ads account connected successfully! 🔵',
      data: { pageName: 'Test School Page' },
      fallbackUrl: 'https://crm.sahyak.com/integrations?meta=connected',
    });

    assert.ok(html.includes('<!DOCTYPE html>'), 'Contains DOCTYPE');
    assert.ok(html.includes('SAHYAK_OAUTH_SUCCESS'), 'Contains SAHYAK_OAUTH_SUCCESS payload type');
    assert.ok(html.includes('"provider":"meta"'), 'Contains meta provider');
    assert.ok(html.includes('window.opener.postMessage(payload, \'*\')'), 'Contains window.opener postMessage call');
    assert.ok(html.includes('window.close()'), 'Contains window.close() call');
    assert.ok(html.includes('window.location.replace'), 'Contains fallback redirect');
    assert.ok(html.includes('Test School Page'), 'Includes passed data');
    console.log('  ✅ [PASS] renderOAuthPopupBridge generates compliant postMessage success HTML');
    passed++;
  }

  // 2. renderOAuthPopupBridge - Error HTML structure
  {
    const html = renderOAuthPopupBridge({
      success: false,
      provider: 'google_email',
      message: 'User denied mailbox access permission',
      fallbackUrl: 'https://crm.sahyak.com/email?error=google_denied',
    });

    assert.ok(html.includes('SAHYAK_OAUTH_ERROR'), 'Contains SAHYAK_OAUTH_ERROR payload type');
    assert.ok(html.includes('"provider":"google_email"'), 'Contains google_email provider');
    assert.ok(html.includes('User denied mailbox access permission'), 'Includes user-facing error message');
    assert.ok(html.includes('window.opener.postMessage'), 'Communicates error to opener window');
    console.log('  ✅ [PASS] renderOAuthPopupBridge generates compliant postMessage error HTML');
    passed++;
  }

  // 3. XSS Sanitization in Bridge HTML
  {
    const maliciousMsg = '<script>alert("XSS")</script>&"evil"';
    const html = renderOAuthPopupBridge({
      success: false,
      provider: 'meta',
      message: maliciousMsg,
    });

    assert.ok(!html.includes('<script>alert("XSS")</script>'), 'Raw script tags sanitized in rendered body');
    assert.ok(html.includes('&lt;script&gt;'), 'HTML characters escaped properly');
    console.log('  ✅ [PASS] XSS payloads securely neutralized in popup HTML body');
    passed++;
  }

  // 4. Meta OAuth Callback - Error returns Popup Bridge HTML when not JSON
  {
    const req = {
      query: { error: 'access_denied', error_description: 'User clicked cancel on Facebook' },
      headers: { accept: 'text/html' },
    };
    const res = createMockRes();
    await metaOAuthController.callback(req, res);

    assert.strictEqual(res.headers['content-type'], 'text/html', 'Returns text/html content type');
    assert.ok(typeof res.body === 'string' && res.body.includes('SAHYAK_OAUTH_ERROR'), 'Returns popup bridge HTML with SAHYAK_OAUTH_ERROR');
    assert.ok(res.body.includes('User clicked cancel on Facebook'), 'Contains error description');
    console.log('  ✅ [PASS] Meta OAuth error returns postMessage bridge HTML without top-level redirect');
    passed++;
  }

  // 5. Meta OAuth Callback - Missing params returns Popup Bridge HTML
  {
    const req = {
      query: {},
      headers: { accept: 'text/html' },
    };
    const res = createMockRes();
    await metaOAuthController.callback(req, res);

    assert.strictEqual(res.headers['content-type'], 'text/html');
    assert.ok(res.body.includes('SAHYAK_OAUTH_ERROR'));
    assert.ok(res.body.includes('Missing OAuth authorization code or state'));
    console.log('  ✅ [PASS] Meta OAuth missing params returns postMessage bridge HTML');
    passed++;
  }

  // 6. Email Controller Handle Google Callback - Error returns Popup Bridge HTML
  {
    const req = {
      query: { error: 'access_denied' },
      headers: { accept: 'text/html' },
    };
    const res = createMockRes();
    await emailController.handleGoogleCallback(req, res);

    assert.strictEqual(res.headers['content-type'], 'text/html');
    assert.ok(res.body.includes('SAHYAK_OAUTH_ERROR'));
    assert.ok(res.body.includes('"provider":"google_email"'));
    console.log('  ✅ [PASS] Email Google OAuth error returns postMessage bridge HTML without top-level redirect');
    passed++;
  }

  // 7. Google Ads Controller Callback - Error returns Popup Bridge HTML
  {
    const req = {
      query: { error: 'access_denied', error_description: 'Permission denied' },
      headers: { accept: 'text/html' },
    };
    const res = createMockRes();
    await googleOAuthController.callback(req, res);

    assert.strictEqual(res.headers['content-type'], 'text/html');
    assert.ok(res.body.includes('SAHYAK_OAUTH_ERROR'));
    assert.ok(res.body.includes('"provider":"google_ads"'));
    console.log('  ✅ [PASS] Google Ads OAuth error returns postMessage bridge HTML without top-level redirect');
    passed++;
  }

  console.log('================================================================');
  console.log(`🏁 ALL ${passed} OAUTH POPUP TESTS PASSED SUCCESSFULLY! (100%)`);
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
