const express = require('express');
const router = express.Router();

const integrationController = require('../controllers/integrationController');
const sheetsWebhookController = require('../controllers/integrations/sheetsWebhookController');
const sheetsIntegrationController = require('../controllers/integrations/sheetsIntegrationController');
const websiteFormController = require('../controllers/integrations/websiteFormController');
const customWebhookController = require('../controllers/integrations/customWebhookController');
const { websiteFormLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');

const metaRoutes = require('./metaRoutes');
const googleRoutes = require('./googleRoute');

// ============================================================
// PROVIDER ROUTES (OAuth & Webhooks & Provider Management)
// ============================================================

router.use('/meta', metaRoutes);
router.use('/google', googleRoutes);

// ============================================================
// GOOGLE SHEETS SETUP & SYNC ENDPOINTS
// ============================================================

// Client Google Cloud config and standard fields
router.get('/sheets/config', protect, resolveWorkspace, requirePermission(['integrations.view', 'integrations.manage']), sheetsIntegrationController.getConfig);

// Inspect sheet via URL/ID (OAuth / Service Account / Public / Mock)
router.post('/sheets/inspect', protect, resolveWorkspace, requirePermission('integrations.manage'), sheetsIntegrationController.inspectSheet);

// Option 2: Create new sheet in user's Google Drive with real CRM fields
router.post('/sheets/create-sheet', protect, resolveWorkspace, requirePermission('integrations.manage'), sheetsIntegrationController.createSheet);

// Apply standard template headers to an empty sheet
router.post('/sheets/apply-template', protect, resolveWorkspace, requirePermission('integrations.manage'), sheetsIntegrationController.applyTemplate);

// Finalize Google Sheet connection
router.post('/sheets/connect', protect, resolveWorkspace, requirePermission('integrations.manage'), sheetsIntegrationController.connectSheet);

// Mode B Polling manual on-demand sync trigger
router.post('/sheets/sync/:id', protect, resolveWorkspace, requirePermission('integrations.manage'), sheetsIntegrationController.syncNow);

// ============================================================
// PUBLIC INBOUND WEBHOOK ENDPOINTS
// ============================================================

// Google Sheets Apps Script Webhook
router.post('/sheets/webhook/:integrationId', sheetsWebhookController.receive);

// Google Sheets Header Auto-Detection & Synonym Matching
router.post('/sheets/detect-headers', sheetsWebhookController.detectHeaders);

// Website Lead Generation Form Submission (IP Rate Limited)
router.post('/forms/:formKey/submit', websiteFormLimiter, websiteFormController.submitForm);

// Custom Webhook (Zapier, Make, JustDial, LinkedIn, etc.)
router.post('/custom/webhook/:integrationId', customWebhookController.receive);

// ============================================================
// LEAD SOURCE SUBSCRIPTIONS (Multi-Form to Campaign-Group Routing)
// ============================================================
const subscriptionRoutingController = require('../controllers/integrations/subscriptionRoutingController');

router.get('/subscriptions', protect, resolveWorkspace, requirePermission('integrations.view'), subscriptionRoutingController.getSubscriptions);
router.post('/subscriptions', protect, resolveWorkspace, requirePermission('integrations.manage'), subscriptionRoutingController.createSubscription);
router.get('/subscriptions/:id', protect, resolveWorkspace, requirePermission('integrations.view'), subscriptionRoutingController.getSubscription);
router.put('/subscriptions/:id', protect, resolveWorkspace, requirePermission('integrations.manage'), subscriptionRoutingController.updateSubscription);
router.patch('/subscriptions/:id/toggle', protect, resolveWorkspace, requirePermission('integrations.manage'), subscriptionRoutingController.toggleSubscription);
router.delete('/subscriptions/:id', protect, resolveWorkspace, requirePermission('integrations.manage'), subscriptionRoutingController.deleteSubscription);

// ============================================================
// REPORTING & AUDIT LOG (Protected)
// ============================================================

// Sources / Campaign Report: counts per platform and campaign
router.get('/reports/campaigns', protect, resolveWorkspace, requirePermission('integrations.view'), integrationController.getSourcesReport);

// Audit Log & Re-Drive
router.get('/events', protect, resolveWorkspace, requirePermission('integrations.view'), integrationController.getWebhookEvents);
router.post('/events/:id/retry', protect, resolveWorkspace, requirePermission('integrations.manage'), integrationController.retryWebhookEvent);

// ============================================================
// INTEGRATION CONFIGURATION & CREDENTIAL MANAGEMENT (Protected)
// ============================================================

// Per-Sheet Real-Time Status Screen
router.get('/:id/sheets-status', protect, resolveWorkspace, requirePermission('integrations.view'), integrationController.getSheetStatus);

// Snippet & Code Generator for Sheets / Website Form / Custom Webhook
router.get('/:id/snippet', protect, resolveWorkspace, requirePermission('integrations.view'), integrationController.getSnippet);

// Secret Key Revoke & Regenerate
router.post('/:id/regenerate-key', protect, resolveWorkspace, requirePermission('integrations.manage'), integrationController.regenerateKey);

// CRUD Endpoints
router.get('/', protect, resolveWorkspace, requirePermission('integrations.view'), integrationController.getIntegrations);
router.get('/:id', protect, resolveWorkspace, requirePermission('integrations.view'), integrationController.getIntegration);
router.post('/', protect, resolveWorkspace, requirePermission('integrations.manage'), integrationController.createIntegration);
router.patch('/:id', protect, resolveWorkspace, requirePermission('integrations.manage'), integrationController.updateIntegration);
router.delete('/:id', protect, resolveWorkspace, requirePermission('integrations.manage'), integrationController.disconnectIntegration);

module.exports = router;