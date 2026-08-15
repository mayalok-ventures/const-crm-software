const ChatMessage = require('../models/ChatMessage');
const Lead = require('../models/Lead');
const User = require('../models/User');
const waSession = require('../services/waSession');

// Helper to resolve effective WhatsApp session ID & verify permissions
const resolveWhatsAppSender = (user, requestedSender) => {
  const senderType = requestedSender || user.defaultSender || 'personal';

  if (senderType === 'company') {
    const isOwner = user.workStatus === 'company_owner' || user.companyRole === 'owner';
    const companyId = isOwner ? user._id : user.companyId;

    if (!companyId) {
      throw new Error('No company agency is associated with your account.');
    }

    if (!isOwner && !user.allowCompanyWhatsApp) {
      throw new Error('You do not have permission to send messages using Company WhatsApp.');
    }

    return {
      sessionId: companyId,
      senderType: 'company',
      senderName: `${user.name} (via ${user.companyInfo?.companyName || 'Company'})`,
    };
  }

  // Personal
  return {
    sessionId: user._id,
    senderType: 'personal',
    senderName: user.name || 'You',
  };
};

// ── GET CONNECTION STATUS (Dual: Personal & Company) ───────────────────────────
exports.getStatus = async (req, res) => {
  try {
    const personalStatus = waSession.getStatus(req.user._id);
    let companyStatus = null;

    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = isOwner ? req.user._id : req.user.companyId;

    if (companyId) {
      if (isOwner || req.user.allowCompanyWhatsApp) {
        companyStatus = waSession.getStatus(companyId);
      }
    }

    res.json({
      status: personalStatus.status,
      phone: personalStatus.phone,
      pairingCode: personalStatus.pairingCode,
      qrCode: personalStatus.qrCode,
      personal: personalStatus,
      company: companyStatus,
      defaultSender: req.user.defaultSender || 'personal',
      allowCompanyWhatsApp: req.user.allowCompanyWhatsApp || isOwner || false,
      isCompanyOwner: isOwner,
    });
  } catch (err) {
    console.error('getStatus error:', err);
    res.status(500).json({ message: 'Server error checking WhatsApp status' });
  }
};

// ── CONNECT / PAIRING CODE ───────────────────────────────────────────────────
exports.connect = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: 'Phone number is required' });

    const result = await waSession.connect(req.user._id, phoneNumber);
    res.json({
      message: 'Pairing code generated. Enter this 8-digit code in WhatsApp.',
      pairingCode: result.pairingCode,
    });
  } catch (err) {
    console.error('connect error:', err);
    res.status(500).json({ message: err.message || 'Failed to initiate WhatsApp connection' });
  }
};

// ── DISCONNECT ───────────────────────────────────────────────────────────────
exports.disconnect = async (req, res) => {
  try {
    await waSession.disconnect(req.user._id);
    res.json({ message: 'Disconnected from WhatsApp' });
  } catch (err) {
    console.error('disconnect error:', err);
    res.status(500).json({ message: 'Failed to disconnect' });
  }
};

// ── SEND DIRECT TEXT MESSAGE ─────────────────────────────────────────────────
exports.sendText = async (req, res) => {
  try {
    const { to, text, sender } = req.body;
    if (!to || !text) return res.status(400).json({ message: 'Recipient number (to) and text are required' });

    const { sessionId, senderName } = resolveWhatsAppSender(req.user, sender);
    await waSession.sendText(sessionId, to, text, req.user._id, senderName);

    res.json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error('sendText error:', err);
    res.status(500).json({ message: err.message || 'Failed to send WhatsApp message' });
  }
};

// ── SEND MEDIA MESSAGE (Images, Videos, PDFs) ─────────────────────────────────
exports.sendMedia = async (req, res) => {
  try {
    const { to, text, image, video, document, sender } = req.body;
    if (!to) return res.status(400).json({ message: 'Recipient number (to) is required' });
    if (!image && !video && !document && !text) {
      return res.status(400).json({ message: 'Media (image, video, document) or text is required' });
    }

    const { sessionId, senderName } = resolveWhatsAppSender(req.user, sender);
    await waSession.sendMedia(sessionId, to, { text, image, video, document }, req.user._id, senderName);

    res.json({ message: 'Media sent successfully' });
  } catch (err) {
    console.error('sendMedia error:', err);
    res.status(500).json({ message: err.message || 'Failed to send media via WhatsApp' });
  }
};

// ── GET ALL CONVERSATIONS / CHATS ─────────────────────────────────────────────
exports.getChats = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    let userObjectId = null;
    try { userObjectId = new mongoose.Types.ObjectId(req.user._id); } catch (e) {}

    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);
    let companyObjectId = null;
    if (companyId) {
      try { companyObjectId = new mongoose.Types.ObjectId(companyId); } catch (e) {}
    }

    const userScope = [
      { userId: userObjectId || req.user._id },
      { userId: req.user._id.toString() },
      ...(companyObjectId ? [{ userId: companyObjectId }, { userId: companyId.toString() }] : [])
    ];

    const chats = await ChatMessage.aggregate([
      { $match: { $or: userScope } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$phone',
          lastMessage: { $first: '$text' },
          lastTimestamp: { $first: '$timestamp' },
          direction: { $first: '$direction' },
          senderName: { $first: '$senderName' },
          leadId: { $first: '$leadId' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$direction', 'inbound'] }, { $eq: ['$status', 'received'] }] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { lastTimestamp: -1 } }
    ]);

    const leadIds = chats.map(c => c.leadId).filter(Boolean);
    const leads = await Lead.find({ _id: { $in: leadIds } }).select('name phone company tags project').lean();
    const leadMap = {};
    leads.forEach(l => { leadMap[l._id.toString()] = l; });

    const formatted = chats.map(c => ({
      phone: c._id,
      lastMessage: c.lastMessage,
      lastTimestamp: c.lastTimestamp,
      direction: c.direction,
      unreadCount: c.unreadCount,
      lead: c.leadId ? leadMap[c.leadId.toString()] : null,
      displayName: (c.leadId && leadMap[c.leadId.toString()]?.name) || c.senderName || '+' + c._id
    }));

    res.json(formatted);
  } catch (err) {
    console.error('getChats error:', err);
    res.status(500).json({ message: 'Server error fetching chats' });
  }
};

// ── GET MESSAGE HISTORY FOR A PHONE ──────────────────────────────────────────
exports.getChatHistory = async (req, res) => {
  try {
    const { phone } = req.params;
    const { leadId } = req.query;
    const cleanPhone = String(phone).replace(/\D/g, '');
    const tenDigit = cleanPhone.slice(-10);

    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);

    const conditions = [
      { phone: { $in: [cleanPhone, tenDigit, '91' + tenDigit] } }
    ];

    if (leadId) {
      conditions.push({ leadId });
    } else {
      const lead = await Lead.findOne({
        $or: [
          { userId: req.user._id, phone: { $in: [cleanPhone, tenDigit, '91' + tenDigit] } },
          ...(companyId ? [{ companyId, phone: { $in: [cleanPhone, tenDigit, '91' + tenDigit] } }] : [])
        ]
      });
      if (lead) {
        conditions.push({ leadId: lead._id });
      }
    }

    const userScope = [
      req.user._id,
      req.user._id.toString(),
      ...(companyId ? [companyId, companyId.toString()] : [])
    ];

    const messages = await ChatMessage.find({
      userId: { $in: userScope },
      $or: conditions
    })
    .sort({ timestamp: 1 })
    .limit(300)
    .lean();

    // Mark unread inbound messages as read
    await ChatMessage.updateMany(
      {
        userId: { $in: userScope },
        $or: conditions,
        direction: 'inbound',
        status: 'received'
      },
      { $set: { status: 'read' } }
    );

    res.json(messages);
  } catch (err) {
    console.error('getChatHistory error:', err);
    res.status(500).json({ message: 'Server error fetching chat history' });
  }
};

// ── SEND DIRECT MESSAGE FROM CHAT ─────────────────────────────────────────────
exports.sendChatMessage = async (req, res) => {
  try {
    const { phone } = req.params;
    const { text, image, video, document, sender } = req.body;
    if (!text && !image && !video && !document) {
      return res.status(400).json({ message: 'Message text or media is required' });
    }

    const { sessionId, senderName } = resolveWhatsAppSender(req.user, sender);

    if (image || video || document) {
      await waSession.sendMedia(sessionId, phone, { text, image, video, document }, req.user._id, senderName);
    } else {
      await waSession.sendText(sessionId, phone, text, req.user._id, senderName);
    }

    // Log to Lead activity audit trail
    const cleanPhone = String(phone).replace(/\D/g, '');
    const lead = await Lead.findOne({
      $or: [
        { userId: req.user._id, phone: { $in: [cleanPhone, cleanPhone.slice(-10), '91' + cleanPhone.slice(-10)] } },
        ...(req.user.companyId ? [{ companyId: req.user.companyId, phone: { $in: [cleanPhone, cleanPhone.slice(-10), '91' + cleanPhone.slice(-10)] } }] : [])
      ]
    });

    if (lead) {
      lead.lastContactedAt = new Date();
      lead.messageSentCount = (lead.messageSentCount || 0) + 1;
      lead.leadActivities.push({
        action: 'message_sent',
        performedBy: req.user._id,
        performerName: req.user.name,
        details: `Sent message: "${text ? text.slice(0, 50) : 'Media file'}"`,
        timestamp: new Date(),
      });
      await lead.save();
    }

    res.json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error('sendChatMessage error:', err);
    res.status(500).json({ message: err.message || 'Failed to send message' });
  }
};

// ── LOG CAMPAIGN DISPATCH ────────────────────────────────────────────────────
exports.logCampaignSend = async (req, res) => {
  try {
    const CampaignLog = require('../models/CampaignLog');
    const { campaignId, leadId, phone, status, errorMessage } = req.body;

    await CampaignLog.create({
      campaignId,
      userId: req.user._id,
      leadId,
      phone,
      status: status || 'sent',
      errorMessage,
      sentAt: new Date()
    });

    res.json({ message: 'Campaign log recorded' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to log campaign send' });
  }
};
