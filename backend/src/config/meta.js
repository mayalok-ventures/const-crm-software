/**
 * Centralized Meta (Facebook / Instagram) Graph API Configuration
 * Pinning the current stable Graph API version with environment override support.
 */

const META_CONFIG = {
  // Pinned Graph API Version (Stable production release with env override support)
  DEFAULT_GRAPH_API_VERSION: 'v21.0',
  get GRAPH_API_VERSION() {
    return (process.env.META_API_VERSION || this.DEFAULT_GRAPH_API_VERSION).trim();
  },
  GRAPH_BASE_URL: 'https://graph.facebook.com',
  get GRAPH_API_BASE() {
    return `${this.GRAPH_BASE_URL}/${this.GRAPH_API_VERSION}`;
  },
  SCOPES: [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_metadata',
    'leads_retrieval',
    'ads_read',
  ],
  // Token authentication error codes requiring integration reconnection
  AUTH_ERROR_CODE: 190,
  AUTH_ERROR_SUBCODES: [
    463, // Access token expired
    467, // Access token revoked or invalid
    458, // User deauthorized or removed the app
    459, // User account checkpoint triggered
    460, // Password reset triggered session invalidation
    492, // User lost administrative role/permission on the Page
  ],
};

module.exports = META_CONFIG;
