const express = require('express');

const router = express.Router();

const integrationController = require('../controllers/integrationController');

const metaRoutes = require('./metaRoutes');
const googleRoutes = require('./googleRoutes');

// ============================================================
// PROVIDER ROUTES
// ============================================================

router.use('/meta', metaRoutes);

router.use('/google', googleRoutes);

// ============================================================
// GENERIC INTEGRATION MANAGEMENT
// ============================================================

// GET /api/integrations
router.get(
  '/',
  integrationController.getIntegrations
);

// DELETE /api/integrations/:id
router.delete(
  '/:id',
  integrationController.disconnectIntegration
);

module.exports = router;