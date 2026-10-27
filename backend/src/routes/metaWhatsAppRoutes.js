const express = require('express');
const router = express.Router();
const {
  getConfigStatus,
  getAccount,
  connectAccount,
  disconnectAccount,
  getTemplates,
  createTemplate,
  checkWindow,
  sendTextMessage,
  sendTemplateMessage,
  verifyWebhook,
  handleWebhook,
} = require('../controllers/metaWhatsAppController');
const { protect, checkPlanExpiry } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');

// Public Webhook Endpoints (Challenge Verification & Event Handling)
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

// Protected Workspace APIs
router.get('/config-status', protect, resolveWorkspace, getConfigStatus);
router.get('/account', protect, resolveWorkspace, requirePermission('whatsapp.view'), getAccount);
router.post('/connect', protect, resolveWorkspace, requirePermission('whatsapp.manage_integrations'), connectAccount);
router.post('/disconnect', protect, resolveWorkspace, requirePermission('whatsapp.manage_integrations'), disconnectAccount);
router.get('/templates', protect, resolveWorkspace, requirePermission('whatsapp.view'), getTemplates);
router.post('/templates', protect, resolveWorkspace, requirePermission('whatsapp.manage_templates'), createTemplate);
router.get('/check-window/:phone', protect, resolveWorkspace, requirePermission('whatsapp.view'), checkWindow);
router.post('/send-text', protect, resolveWorkspace, requirePermission('whatsapp.send_one_to_one'), checkPlanExpiry, sendTextMessage);
router.post('/send-template', protect, resolveWorkspace, requirePermission('whatsapp.send_one_to_one'), checkPlanExpiry, sendTemplateMessage);

module.exports = router;
