/**
 * OAuth Popup Bridge Utility
 * Renders an optimized, lightweight HTML response designed for OAuth callback popup windows.
 * Dispatches a postMessage to window.opener, securely passes authorization payload,
 * and automatically closes the popup window without redirecting the main application page.
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render a lightweight, branded HTML bridge page for OAuth popups
 *
 * @param {Object} options
 * @param {boolean} options.success - Whether OAuth succeeded
 * @param {string} options.provider - Provider name ('meta' | 'google_email' | 'google_ads' | etc.)
 * @param {string} [options.message] - User-friendly message or error description
 * @param {Object} [options.data] - Arbitrary data to send to parent window
 * @param {string} [options.fallbackUrl] - URL to redirect to if window.opener is not available
 * @returns {string} HTML string
 */
function renderOAuthPopupBridge({
  success = true,
  provider = 'oauth',
  message = '',
  data = {},
  fallbackUrl = '/',
}) {
  const safeMessage = message || (success ? 'Authorization completed successfully!' : 'Authorization failed or was cancelled.');
  const title = success ? 'Connected Successfully' : 'Authorization Notice';
  const icon = success ? '✓' : '✕';
  const brandColor = success ? '#10b981' : '#ef4444';
  const brandBg = success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';

  const payload = {
    type: success ? 'SAHYAK_OAUTH_SUCCESS' : 'SAHYAK_OAUTH_ERROR',
    provider,
    success,
    message: safeMessage,
    data,
  };

  const serializedPayload = JSON.stringify(payload);
  const serializedFallback = JSON.stringify(fallbackUrl || '/');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - Sahyak CRM</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #090d16;
      color: #f1f5f9;
      padding: 24px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 18px;
      padding: 36px 28px;
      text-align: center;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .icon-badge {
      width: 60px;
      height: 60px;
      margin: 0 auto 20px;
      border-radius: 50%;
      background: ${brandBg};
      border: 2px solid ${brandColor};
      color: ${brandColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 800;
    }
    h2 {
      font-size: 19px;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 8px;
      letter-spacing: -0.01em;
    }
    p {
      font-size: 13.5px;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .footer-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #334155;
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">${icon}</div>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(safeMessage)}</p>
    <div class="footer-status">
      <div class="spinner"></div>
      <span>Returning to Sahyak CRM...</span>
    </div>
  </div>

  <script>
    (function() {
      var payload = ${serializedPayload};
      var fallbackUrl = ${serializedFallback};
      var communicated = false;

      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, '*');
          communicated = true;
          // Cleanly close popup after brief delay to let message propagate
          setTimeout(function() {
            try {
              window.close();
            } catch (err) {}
          }, 450);
        }
      } catch (err) {
        console.warn('OAuth popup opener communication error:', err);
      }

      // If opened outside a popup or without opener, fallback to standard redirect
      if (!communicated) {
        setTimeout(function() {
          window.location.replace(fallbackUrl);
        }, 700);
      }
    })();
  </script>
</body>
</html>`;
}

module.exports = {
  renderOAuthPopupBridge,
  escapeHtml,
};
