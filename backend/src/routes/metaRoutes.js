const express = require('express');

const router = express.Router();

const metaOAuthController = require('../controllers/integrations/metaOAuthController');
const metaWebhookController = require('../controllers/integrations/metaWebhookController');
const metaIntegrationController = require('../controllers/integrations/metaIntegrationController');

// ============================================================
// META OAUTH
// ============================================================

router.get(
  '/oauth',
  metaOAuthController.startOAuth
);

router.get(
  '/oauth/callback',
  metaOAuthController.callback
);

// ============================================================
// META WEBHOOK
// ============================================================

// Meta verification
// GET /api/integrations/meta/webhook
//
// IMPORTANT:
// Do NOT put JWT middleware here.

router.get(
  '/webhook',
  metaWebhookController.verify
);

// Meta lead events
// POST /api/integrations/meta/webhook
//
// IMPORTANT:
// Do NOT put JWT middleware here.

router.post(
  '/webhook',
  express.json({
    type: 'application/json',
  }),
  metaWebhookController.receive
);

const { protect } = require('../middleware/auth');

// ============================================================
// META ACCOUNT MANAGEMENT
// ============================================================

router.get(
  '/',
  protect,
  metaIntegrationController.getIntegrations
);

router.get(
  '/assets',
  protect,
  metaIntegrationController.getAssets
);

router.post(
  '/configure',
  protect,
  metaIntegrationController.configure
);

router.post(
  '/test',
  protect,
  metaIntegrationController.testConnection
);

router.delete(
  '/:integrationId',
  protect,
  metaIntegrationController.disconnect
);

module.exports = router;