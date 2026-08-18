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

// ============================================================
// META ACCOUNT MANAGEMENT
// ============================================================

router.get(
  '/',
  metaIntegrationController.getIntegrations
);

router.get(
  '/assets',
  metaIntegrationController.getAssets
);

router.post(
  '/configure',
  metaIntegrationController.configure
);

router.post(
  '/test',
  metaIntegrationController.testConnection
);

router.delete(
  '/:integrationId',
  metaIntegrationController.disconnect
);

module.exports = router;