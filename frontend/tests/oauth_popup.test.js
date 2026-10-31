const assert = require('assert');

// Mock browser globals for testing oauthPopup in Node environment
global.window = {
  screenLeft: 100,
  screenTop: 100,
  innerWidth: 1920,
  innerHeight: 1080,
  screen: { width: 1920, height: 1080, availWidth: 1920 },
  addEventListener: null,
  removeEventListener: null,
  open: null,
};
global.document = {
  documentElement: {
    clientWidth: 1920,
    clientHeight: 1080,
  },
};

const { openOAuthPopup } = require('../src/lib/oauthPopup');

async function testOAuthPopup() {
  console.log('======================================================');
  console.log('⚡ TESTING FRONTEND OAUTH POPUP HELPER');
  console.log('======================================================');

  let passed = 0;

  // 1. Module export check
  assert.strictEqual(typeof openOAuthPopup, 'function', 'openOAuthPopup must be a function');
  console.log('  ✅ [PASS] openOAuthPopup function exported properly');
  passed++;

  // 2. Simulated Successful Popup flow
  {
    let messageHandler = null;
    let windowClosed = false;
    let openedUrl = null;
    let openedFeatures = null;

    global.window.addEventListener = (type, handler) => {
      if (type === 'message') messageHandler = handler;
    };
    global.window.removeEventListener = (type, handler) => {
      if (type === 'message' && messageHandler === handler) messageHandler = null;
    };

    const mockPopup = {
      closed: false,
      location: { href: 'about:blank' },
      document: { write: () => {} },
      focus: () => {},
      close() {
        this.closed = true;
      },
    };

    global.window.open = (url, title, features) => {
      openedUrl = url;
      openedFeatures = features;
      return mockPopup;
    };

    const popupPromise = openOAuthPopup({
      title: 'Connect Meta Ads',
      provider: 'meta',
      fetchUrl: async () => 'https://facebook.com/dialog/oauth?test=1',
      width: 600,
      height: 700,
    });

    // Verify popup was opened with centered width and height features
    assert.ok(openedFeatures.includes('width=600'), 'Includes width 600');
    assert.ok(openedFeatures.includes('height=700'), 'Includes height 700');

    // Simulate backend sending success message via postMessage
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(mockPopup.location.href, 'https://facebook.com/dialog/oauth?test=1', 'Popup navigated to auth URL');
    assert.ok(messageHandler, 'Message handler attached to window');

    messageHandler({
      data: {
        type: 'SAHYAK_OAUTH_SUCCESS',
        provider: 'meta',
        data: { pageName: 'My University' },
      },
    });

    const result = await popupPromise;
    assert.strictEqual(result.success, true, 'Result is marked successful');
    assert.strictEqual(result.data.pageName, 'My University', 'Data passed through correctly');
    assert.strictEqual(mockPopup.closed, true, 'Popup was closed automatically');
    assert.strictEqual(messageHandler, null, 'Message listener was cleaned up');
    console.log('  ✅ [PASS] Successful OAuth popup flow with postMessage communication verified');
    passed++;
  }

  // 3. User closes popup before completing
  {
    let messageHandler = null;
    global.window.addEventListener = (type, handler) => {
      if (type === 'message') messageHandler = handler;
    };
    global.window.removeEventListener = () => {
      messageHandler = null;
    };

    const mockPopup = {
      closed: false,
      location: { href: '' },
      document: { write: () => {} },
      focus: () => {},
      close() {
        this.closed = true;
      },
    };

    global.window.open = () => mockPopup;

    const popupPromise = openOAuthPopup({
      url: 'https://accounts.google.com/o/oauth2/auth',
      provider: 'google_email',
    });

    // Simulate user closing the window after 100ms
    setTimeout(() => {
      mockPopup.closed = true;
    }, 100);

    const result = await popupPromise;
    assert.strictEqual(result.success, false, 'Result is false on user cancellation');
    assert.strictEqual(result.cancelled, true, 'Result flagged as cancelled');
    assert.strictEqual(messageHandler, null, 'Message listener cleaned up on cancellation');
    console.log('  ✅ [PASS] User cancellation / manual popup close handled gracefully');
    passed++;
  }

  // 4. Popup Blocker detection
  {
    global.window.open = () => null; // Returns null when blocked
    const result = await openOAuthPopup({
      url: 'https://example.com/oauth',
    });

    assert.strictEqual(result.success, false, 'Failed result when blocked');
    assert.strictEqual(result.blocked, true, 'Blocked flag set');
    assert.ok(result.error.includes('blocked'), 'Error message informs user of popup blocker');
    console.log('  ✅ [PASS] Popup blocker detection and graceful guidance verified');
    passed++;
  }

  console.log('======================================================');
  console.log(`🎉 ALL ${passed} FRONTEND OAUTH POPUP TESTS PASSED!`);
  console.log('======================================================');
}

testOAuthPopup().catch((err) => {
  console.error('❌ Frontend OAuth popup test failed:', err);
  process.exit(1);
});
