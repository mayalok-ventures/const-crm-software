const express = require('express');
const router = express.Router();

const integrationController = require('../controllers/integrationController');
const { protect } = require('../middleware/auth');

const metaRoutes = require('./metaRoutes');
const googleRoutes = require('./googleRoute');

// ============================================================
// PROVIDER ROUTES (OAuth & Webhooks & Provider Management)
// ============================================================

router.use('/meta', metaRoutes);
router.use('/google', googleRoutes);

// ============================================================
// GENERIC INTEGRATION MANAGEMENT (Multi-tenant Protected)
// ============================================================

// GET /api/integrations
router.get('/', protect, integrationController.getIntegrations);

// GET /api/integrations/:id
router.get('/:id', protect, integrationController.getIntegration);

// POST /api/integrations
router.post('/', protect, integrationController.createIntegration);

// PATCH /api/integrations/:id
router.patch('/:id', protect, integrationController.updateIntegration);

// DELETE /api/integrations/:id
router.delete('/:id', protect, integrationController.disconnectIntegration);

module.exports = router;