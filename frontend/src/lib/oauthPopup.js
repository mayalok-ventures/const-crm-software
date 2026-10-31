/**
 * OAuth Popup Helper for Sahyak CRM
 * Opens an authorization flow in a centered popup window, communicates credentials / status
 * back to the opener via postMessage, and cleanly returns to the previous screen without
 * triggering any full-page reload or top-level window redirection.
 */

/**
 * Open an OAuth authorization popup and await completion or cancellation
 *
 * @param {Object} options
 * @param {string} [options.url] - The authorization URL to navigate to
 * @param {Function} [options.fetchUrl] - Async function that resolves to the authorization URL
 * @param {string} [options.title='OAuth Authorization'] - Title for the popup window
 * @param {string} [options.provider] - Optional provider filter ('meta' | 'google_email' | 'google_ads')
 * @param {number} [options.width=600] - Window width
 * @param {number} [options.height=700] - Window height
 * @param {number} [options.timeoutMs=300000] - Timeout in milliseconds (default 5 min)
 * @returns {Promise<{ success: boolean, cancelled?: boolean, error?: string, data?: any }>}
 */
export async function openOAuthPopup({
  url = '',
  fetchUrl = null,
  title = 'OAuth Authorization',
  provider = '',
  width = 600,
  height = 700,
  timeoutMs = 300000,
}) {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Cannot open popup outside browser window' };
  }

  // Calculate centered coordinates on current screen (handles multi-monitor setups)
  const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
  const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;

  const screenWidth = window.innerWidth
    ? window.innerWidth
    : document.documentElement.clientWidth
    ? document.documentElement.clientWidth
    : screen.width;

  const screenHeight = window.innerHeight
    ? window.innerHeight
    : document.documentElement.clientHeight
    ? document.documentElement.clientHeight
    : screen.height;

  const systemZoom = screenWidth / window.screen.availWidth;
  const left = (screenWidth - width) / 2 / systemZoom + dualScreenLeft;
  const top = (screenHeight - height) / 2 / systemZoom + dualScreenTop;

  const windowFeatures = [
    `width=${width}`,
    `height=${height}`,
    `top=${top}`,
    `left=${left}`,
    'status=no',
    'toolbar=no',
    'menubar=no',
    'location=no',
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');

  // Open window immediately on user gesture to prevent popup-blockers
  const initialUrl = url || 'about:blank';
  let popup = null;

  try {
    popup = window.open(initialUrl, title, windowFeatures);
  } catch (err) {
    console.error('[OAuthPopup] Failed to open popup window:', err);
  }

  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    return {
      success: false,
      error: 'Pop-up was blocked by your browser. Please allow pop-ups for Sahyak CRM to continue.',
      blocked: true,
    };
  }

  // If opening blank first while fetching URL asynchronously, show a polished loader
  if (!url && fetchUrl) {
    try {
      popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Connecting... - Sahyak CRM</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0f172a;
      color: #f8fafc;
    }
    .box {
      text-align: center;
      padding: 24px;
    }
    .spinner {
      width: 28px;
      height: 28px;
      margin: 0 auto 16px;
      border: 3px solid #334155;
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h3 { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
    p { font-size: 13px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <h3>Connecting to authorization provider...</h3>
    <p>Please wait a moment while we initialize your secure session.</p>
  </div>
</body>
</html>`);
    } catch {
      // document.write might fail in rare sandbox environments; ignore safely
    }

    try {
      const resolvedUrl = await fetchUrl();
      if (!resolvedUrl) {
        throw new Error('Authorization URL was empty');
      }
      popup.location.href = resolvedUrl;
    } catch (err) {
      try {
        popup.close();
      } catch (closeErr) {}
      return {
        success: false,
        error: err.response?.data?.message || err.message || 'Failed to initialize authorization session',
      };
    }
  }

  // Focus the popup window
  if (popup.focus) {
    popup.focus();
  }

  // Await postMessage or popup close
  return new Promise((resolve) => {
    let resolved = false;
    let pollInterval = null;
    let timeoutTimer = null;

    const cleanup = () => {
      resolved = true;
      if (pollInterval) clearInterval(pollInterval);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      window.removeEventListener('message', handleMessage);
    };

    const handleMessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'SAHYAK_OAUTH_SUCCESS') {
        if (provider && data.provider && data.provider !== provider) {
          // Different provider message received, ignore
          return;
        }
        cleanup();
        try {
          if (popup && !popup.closed) popup.close();
        } catch {}
        resolve({
          success: true,
          data: data.data || data,
          message: data.message,
          provider: data.provider,
        });
      } else if (data.type === 'SAHYAK_OAUTH_ERROR') {
        if (provider && data.provider && data.provider !== provider) {
          return;
        }
        cleanup();
        try {
          if (popup && !popup.closed) popup.close();
        } catch {}
        resolve({
          success: false,
          error: data.message || data.error || 'Authorization failed',
          provider: data.provider,
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Poll to detect if user manually closes popup without completing
    pollInterval = setInterval(() => {
      if (!popup || popup.closed) {
        cleanup();
        resolve({
          success: false,
          cancelled: true,
          message: 'Authorization window was closed',
        });
      }
    }, 450);

    // Timeout safety
    timeoutTimer = setTimeout(() => {
      cleanup();
      try {
        if (popup && !popup.closed) popup.close();
      } catch {}
      resolve({
        success: false,
        error: 'Authorization session timed out',
      });
    }, timeoutMs);
  });
}
