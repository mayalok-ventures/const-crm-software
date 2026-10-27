const express = require('express');
const router = express.Router();

const googleOAuthController = require('../controllers/integrations/googleOAuthController');
const googleWebhookController = require('../controllers/integrations/googleWebhookController');
const googleIntegrationController = require('../controllers/integrations/googleIntegrationController');
const { protect } = require('../middleware/auth');

// ============================================================
// GOOGLE OAUTH
// ============================================================

router.get('/oauth', protect, googleOAuthController.startOAuth);
router.get('/oauth/callback', googleOAuthController.callback);

// ============================================================
// GOOGLE WEBHOOK (Public: Key verified via constant-time compare)
// ============================================================

// Supports both query/body key and path-parameter key (/webhook/:key)
router.post('/webhook', googleWebhookController.receive);
router.post('/webhook/:key', googleWebhookController.receive);

// ============================================================
// GOOGLE ACCOUNT MANAGEMENT (Protected)
// ============================================================

router.get('/', protect, googleIntegrationController.getIntegrations);
router.get('/accounts', protect, googleIntegrationController.getAccounts);
router.post('/configure', protect, googleIntegrationController.configure);
router.post('/test', protect, googleIntegrationController.testConnection);
router.delete('/:integrationId', protect, googleIntegrationController.disconnect);

module.exports = router;