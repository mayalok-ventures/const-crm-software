const express = require('express');
const router = express.Router();

const metaOAuthController = require('../controllers/integrations/metaOAuthController');
const metaWebhookController = require('../controllers/integrations/metaWebhookController');
const metaIntegrationController = require('../controllers/integrations/metaIntegrationController');
const { protect } = require('../middleware/auth');

// ============================================================
// META OAUTH
// ============================================================

router.get('/oauth', protect, metaOAuthController.startOAuth);
router.get('/connect', protect, metaOAuthController.startOAuth);
router.get('/oauth/callback', metaOAuthController.callback);

// ============================================================
// META WEBHOOK (Public endpoints verified via challenge & HMAC)
// ============================================================

router.get('/webhook', metaWebhookController.verify);
router.post('/webhook', metaWebhookController.receive);

// ============================================================
// META APP REVIEW COMPLIANCE CALLBACKS
// ============================================================

router.all('/deauthorize', metaWebhookController.deauthorizeCallback);
router.all('/data-deletion', metaWebhookController.dataDeletionCallback);

// ============================================================
// META RECONCILIATION & ACCOUNT MANAGEMENT (Protected)
// ============================================================

router.post('/sync/:integrationId', protect, metaWebhookController.syncNow);
router.post('/:integrationId/sync', protect, metaWebhookController.syncNow);
router.get('/', protect, metaIntegrationController.getIntegrations);
router.get('/assets', protect, metaIntegrationController.getAssets);
router.post('/configure', protect, metaIntegrationController.configure);
router.post('/test', protect, metaIntegrationController.testConnection);
router.delete('/:integrationId', protect, metaIntegrationController.disconnect);

module.exports = router;