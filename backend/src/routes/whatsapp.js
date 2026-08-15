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
  sendChatMessage
} = require('../controllers/whatsappController');
const { protect, checkPlanExpiry } = require('../middleware/auth');

router.post('/connect', protect, connect);
router.get('/status', protect, getStatus);
router.post('/disconnect', protect, disconnect);
router.post('/send-text', protect, checkPlanExpiry, sendText);
router.post('/send-media', protect, checkPlanExpiry, sendMedia);
router.post('/campaign-log', protect, checkPlanExpiry, logCampaignSend);

// Chat & Message History routes
router.get('/chats', protect, getChats);
router.get('/chats/:phone', protect, getChatHistory);
router.post('/chats/:phone/send', protect, checkPlanExpiry, sendChatMessage);

module.exports = router;
