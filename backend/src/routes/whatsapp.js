const express = require('express');
const router = express.Router();
const {
  connect,
  getStatus,
  disconnect,
  sendText,
  sendMedia,
  logCampaignSend,
  getChats,
  getChatHistory,
  sendChatMessage,
  getAccounts,
  createAccount,
  updateAccountAssignments,
  deleteAccount,
} = require('../controllers/whatsappController');
const { protect, checkPlanExpiry } = require('../middleware/auth');
const { resolveWorkspace, requirePermission } = require('../middleware/permission');

router.use(protect);
router.use(resolveWorkspace);

// Account Connections & Teammate Assignments (Admin only)
router.get('/accounts', requirePermission('whatsapp.view'), getAccounts);
router.post('/accounts', requirePermission(['whatsapp.manage_account', 'whatsapp.manage_integrations']), createAccount);
router.put('/accounts/:id/assign', requirePermission(['whatsapp.manage_account', 'whatsapp.manage_integrations']), updateAccountAssignments);
router.delete('/accounts/:id', requirePermission(['whatsapp.manage_account', 'whatsapp.manage_integrations']), deleteAccount);

router.post('/connect', requirePermission(['whatsapp.manage_account', 'whatsapp.manage_integrations']), connect);
router.get('/status', requirePermission('whatsapp.view'), getStatus);
router.post('/disconnect', requirePermission(['whatsapp.manage_account', 'whatsapp.manage_integrations']), disconnect);
router.post('/send-text', requirePermission('whatsapp.send_one_to_one'), checkPlanExpiry, sendText);
router.post('/send-media', requirePermission('whatsapp.send_one_to_one'), checkPlanExpiry, sendMedia);
router.post('/campaign-log', requirePermission('campaigns.launch'), checkPlanExpiry, logCampaignSend);

// Chat & Message History routes
router.get('/chats', requirePermission('whatsapp.view'), getChats);
router.get('/chats/:phone', requirePermission('whatsapp.view'), getChatHistory);
router.post('/chats/:phone/send', requirePermission('whatsapp.send_one_to_one'), checkPlanExpiry, sendChatMessage);

module.exports = router;
