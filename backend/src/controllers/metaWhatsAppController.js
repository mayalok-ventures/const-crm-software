const MetaWhatsAppService = require('../services/whatsapp/metaWhatsAppService');

/**
 * Controller handling Official WhatsApp Business Platform (Meta Cloud API) interactions
 */

// @desc    Get Meta Cloud API system configuration status
// @route   GET /api/whatsapp/meta/config-status
// @access  Private (Authenticated)
exports.getConfigStatus = async (req, res) => {
  try {
    const status = MetaWhatsAppService.getConfigStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    console.error('[MetaWhatsAppController] getConfigStatus error:', err);
    res.status(500).json({ message: err.message || 'Failed to get configuration status' });
  }
};

// @desc    Get connected official WABA account for workspace
// @route   GET /api/whatsapp/meta/account
// @access  Private
exports.getAccount = async (req, res) => {
  try {
    const account = await MetaWhatsAppService.getAccount(req.workspaceId);
    res.json({ success: true, account });
  } catch (err) {
    console.error('[MetaWhatsAppController] getAccount error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch account' });
  }
};

// @desc    Connect or configure official Meta WABA account
// @route   POST /api/whatsapp/meta/connect
// @access  Private (Owner / Admin only)
exports.connectAccount = async (req, res) => {
  try {
    const isOwnerOrAdmin =
      req.user.role === 'owner' ||
      req.user.role === 'admin' ||
      req.user.companyRole === 'owner' ||
      req.membership?.role === 'owner' ||
      req.membership?.role === 'manager';

    if (!isOwnerOrAdmin) {
      return res.status(403).json({
        message: 'Only the Organization Owner or Administrator can connect official WhatsApp accounts',
      });
    }

    const {
      wabaId,
      phoneNumberId,
      displayPhoneNumber,
      verifiedName,
      accessToken,
      appSecret,
      metaAppId,
    } = req.body;

    const account = await MetaWhatsAppService.connectAccount({
      workspaceId: req.workspaceId,
      ownerId: req.user._id,
      wabaId,
      phoneNumberId,
      displayPhoneNumber,
      verifiedName,
      accessToken,
      appSecret,
      metaAppId,
    });

    res.status(201).json({ success: true, account });
  } catch (err) {
    console.error('[MetaWhatsAppController] connectAccount error:', err);
    res.status(400).json({ message: err.message || 'Failed to connect official WhatsApp account' });
  }
};

// @desc    Disconnect official Meta WABA account
// @route   POST /api/whatsapp/meta/disconnect
// @access  Private (Owner only)
exports.disconnectAccount = async (req, res) => {
  try {
    const result = await MetaWhatsAppService.disconnectAccount(req.workspaceId);
    res.json(result);
  } catch (err) {
    console.error('[MetaWhatsAppController] disconnectAccount error:', err);
    res.status(400).json({ message: err.message || 'Failed to disconnect account' });
  }
};

// @desc    Get Meta-approved message templates
// @route   GET /api/whatsapp/meta/templates
// @access  Private
exports.getTemplates = async (req, res) => {
  try {
    const templates = await MetaWhatsAppService.getTemplates(req.workspaceId);
    res.json({ success: true, templates });
  } catch (err) {
    console.error('[MetaWhatsAppController] getTemplates error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch Meta templates' });
  }
};

// @desc    Submit new template to Meta for review
// @route   POST /api/whatsapp/meta/templates
// @access  Private
exports.createTemplate = async (req, res) => {
  try {
    const { name, category, language, components } = req.body;
    const result = await MetaWhatsAppService.createTemplate({
      workspaceId: req.workspaceId,
      name,
      category,
      language,
      components,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error('[MetaWhatsAppController] createTemplate error:', err);
    res.status(400).json({ message: err.response?.data?.error?.message || err.message || 'Failed to submit template' });
  }
};

// @desc    Check if 24-hour customer service window is open
// @route   GET /api/whatsapp/meta/check-window/:phone
// @access  Private
exports.checkWindow = async (req, res) => {
  try {
    const isOpen = await MetaWhatsAppService.isMessagingWindowOpen(req.workspaceId, req.params.phone);
    res.json({ success: true, isOpen });
  } catch (err) {
    console.error('[MetaWhatsAppController] checkWindow error:', err);
    res.status(500).json({ message: err.message || 'Failed to check window status' });
  }
};

// @desc    Send 1:1 Text Message via Official Meta Cloud API (requires open 24h window)
// @route   POST /api/whatsapp/meta/send-text
// @access  Private
exports.sendTextMessage = async (req, res) => {
  try {
    const { to, text, leadId } = req.body;

    const isPrivileged = req.user?.role === 'superadmin' ||
      req.user?.isAdmin ||
      req.membership?.role === 'owner' ||
      req.membership?.role === 'manager' ||
      req.user?.companyRole === 'owner';

    if (!isPrivileged) {
      const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
      const waba = await WhatsAppBusinessAccount.findOne({ workspaceId: req.workspaceId });
      if (waba && !waba.isGlobal && (!waba.assignedUserIds || !waba.assignedUserIds.some(uid => uid.toString() === req.user._id.toString()))) {
        return res.status(403).json({
          code: 'ACCESS_DENIED',
          message: 'Access denied: You are not assigned to this Meta WhatsApp account.',
        });
      }
    }

    const message = await MetaWhatsAppService.sendTextMessage({
      workspaceId: req.workspaceId,
      userId: req.user._id,
      userName: req.user.name || 'Advisor',
      to,
      text,
      leadId,
    });
    res.status(201).json({ success: true, message });
  } catch (err) {
    console.error('[MetaWhatsAppController] sendTextMessage error:', err);
    res.status(400).json({ message: err.response?.data?.error?.message || err.message || 'Failed to send message' });
  }
};

// @desc    Send Approved Template Message via Official Meta Cloud API (allowed anytime)
// @route   POST /api/whatsapp/meta/send-template
// @access  Private
exports.sendTemplateMessage = async (req, res) => {
  try {
    const { to, templateName, languageCode, components, leadId } = req.body;

    const isPrivileged = req.user?.role === 'superadmin' ||
      req.user?.isAdmin ||
      req.membership?.role === 'owner' ||
      req.membership?.role === 'manager' ||
      req.user?.companyRole === 'owner';

    if (!isPrivileged) {
      const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
      const waba = await WhatsAppBusinessAccount.findOne({ workspaceId: req.workspaceId });
      if (waba && !waba.isGlobal && (!waba.assignedUserIds || !waba.assignedUserIds.some(uid => uid.toString() === req.user._id.toString()))) {
        return res.status(403).json({
          code: 'ACCESS_DENIED',
          message: 'Access denied: You are not assigned to this Meta WhatsApp account.',
        });
      }
    }

    const message = await MetaWhatsAppService.sendTemplateMessage({
      workspaceId: req.workspaceId,
      userId: req.user._id,
      userName: req.user.name || 'Advisor',
      to,
      templateName,
      languageCode,
      components,
      leadId,
    });
    res.status(201).json({ success: true, message });
  } catch (err) {
    console.error('[MetaWhatsAppController] sendTemplateMessage error:', err);
    res.status(400).json({ message: err.response?.data?.error?.message || err.message || 'Failed to send template' });
  }
};

// @desc    Meta Webhook Verification Challenge
// @route   GET /api/whatsapp/meta/webhook
// @access  Public (Meta Verification)
exports.verifyWebhook = async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || 'sahyak_crm_meta_wa_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('✅ [MetaWhatsApp Webhook] Challenge verified successfully');
      return res.status(200).send(challenge);
    }

    console.warn('⚠️ [MetaWhatsApp Webhook] Verification token mismatch');
    return res.status(403).json({ message: 'Forbidden: Verification token mismatch' });
  } catch (err) {
    console.error('[MetaWhatsApp Webhook Verification Error]', err);
    res.status(500).send('Server Error');
  }
};

// @desc    Receive and process Meta WhatsApp Webhook events
// @route   POST /api/whatsapp/meta/webhook
// @access  Public (Signature Verified)
exports.handleWebhook = async (req, res) => {
  try {
    // Verify HMAC-SHA256 signature
    const isValid = MetaWhatsAppService.verifyWebhookSignature(req);
    if (!isValid) {
      console.warn('⚠️ [MetaWhatsApp Webhook] Invalid signature rejected');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    // Acknowledge receipt to Meta immediately (prevents timeouts/retries)
    res.status(200).send('EVENT_RECEIVED');

    // Process event asynchronously
    await MetaWhatsAppService.processWebhookEvent(req.body);
  } catch (err) {
    console.error('[MetaWhatsApp Webhook Process Error]', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Webhook processing error' });
    }
  }
};
