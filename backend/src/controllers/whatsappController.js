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

// ── GET CONNECTION STATUS (Dual: Personal, Company & Meta Cloud API) ────────
exports.getStatus = async (req, res) => {
  try {
    const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
    const personalStatus = waSession.getStatus(req.user._id);
    let companyStatus = null;

    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = isOwner ? req.user._id : req.user.companyId;

    if (companyId) {
      if (isOwner || req.user.allowCompanyWhatsApp) {
        companyStatus = waSession.getStatus(companyId);
      }
    }

    // Method B: Meta Cloud API status
    const workspaceId = req.workspace?._id || req.user.workspaceId || companyId || null;
    let metaStatus = { configured: false, status: 'NOT_CONFIGURED' };
    if (workspaceId) {
      const metaAccount = await WhatsAppBusinessAccount.findOne({
        workspaceId,
        status: { $ne: 'DISCONNECTED' },
      }).select('wabaId phoneNumberId displayPhoneNumber verifiedName status qualityRating').lean();

      if (metaAccount) {
        metaStatus = {
          configured: true,
          status: metaAccount.status || 'CONNECTED',
          wabaId: metaAccount.wabaId,
          displayPhoneNumber: metaAccount.displayPhoneNumber,
          verifiedName: metaAccount.verifiedName,
          qualityRating: metaAccount.qualityRating,
        };
      }
    }

    res.json({
      status: personalStatus.status,
      phone: personalStatus.phone,
      pairingCode: personalStatus.pairingCode,
      qrCode: personalStatus.qrCode,
      isSocketLive: personalStatus.isSocketLive ?? (personalStatus.status === 'connected'),
      lastConfirmedAt: personalStatus.lastConfirmedAt || null,
      lastDisconnectAt: personalStatus.lastDisconnectAt || null,
      lastDisconnectReason: personalStatus.lastDisconnectReason || null,
      requiresAction: !!personalStatus.requiresAction,
      nextRetryAt: personalStatus.nextRetryAt || null,
      personal: personalStatus,
      company: companyStatus,
      meta: metaStatus,
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
    const { to, text, sender, accountId, whatsappAccountId } = req.body;
    if (!to || !text) return res.status(400).json({ message: 'Recipient number (to) and text are required' });

    const targetAccountId = accountId || whatsappAccountId;
    if (targetAccountId) {
      const workspaceId = req.workspace?._id || req.user.workspaceId;
      const allowed = await checkAccountAccess(req.user, targetAccountId, workspaceId);
      if (!allowed) {
        return res.status(403).json({
          code: 'ACCESS_DENIED',
          message: 'Access denied: You are not assigned to this WhatsApp account.',
        });
      }
    }

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
    const { to, text, image, video, document, sender, accountId, whatsappAccountId } = req.body;
    if (!to) return res.status(400).json({ message: 'Recipient number (to) is required' });
    if (!image && !video && !document && !text) {
      return res.status(400).json({ message: 'Media (image, video, document) or text is required' });
    }

    const targetAccountId = accountId || whatsappAccountId;
    if (targetAccountId) {
      const workspaceId = req.workspace?._id || req.user.workspaceId;
      const allowed = await checkAccountAccess(req.user, targetAccountId, workspaceId);
      if (!allowed) {
        return res.status(403).json({
          code: 'ACCESS_DENIED',
          message: 'Access denied: You are not assigned to this WhatsApp account.',
        });
      }
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

    const isManagerOrOwner = req.user?.role === 'superadmin' ||
      req.user?.isAdmin ||
      req.membership?.role === 'owner' ||
      req.membership?.role === 'manager' ||
      req.user?.companyRole === 'owner' ||
      req.user?.companyRole === 'manager';

    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);
    let companyObjectId = null;
    if (companyId) {
      try { companyObjectId = new mongoose.Types.ObjectId(companyId); } catch (e) {}
    }

    const matchConditions = [
      { userId: userObjectId || req.user._id },
      { userId: req.user._id.toString() }
    ];

    if (isManagerOrOwner) {
      if (companyObjectId) {
        matchConditions.push({ userId: companyObjectId }, { userId: companyId.toString() });
      }
    } else {
      // For counsellors / restricted roles: only include company messages for leads assigned to them
      if (companyObjectId) {
        const assignedLeads = await Lead.find({
          $or: [
            { assignedTo: req.user._id },
            { userId: req.user._id },
            { currentOwnerId: req.user._id }
          ]
        }).select('_id phone').lean();

        const assignedLeadIds = assignedLeads.map(l => l._id);
        const assignedPhones = [];
        assignedLeads.forEach(l => {
          if (l.phone) {
            const c = String(l.phone).replace(/\D/g, '');
            if (c) {
              assignedPhones.push(c);
              assignedPhones.push(c.slice(-10));
              assignedPhones.push('91' + c.slice(-10));
            }
          }
        });

        if (assignedLeadIds.length > 0 || assignedPhones.length > 0) {
          matchConditions.push({
            userId: { $in: [companyObjectId, companyId.toString()] },
            $or: [
              ...(assignedLeadIds.length > 0 ? [{ leadId: { $in: assignedLeadIds } }] : []),
              ...(assignedPhones.length > 0 ? [{ phone: { $in: assignedPhones } }] : [])
            ]
          });
        }
      }
    }

    const chats = await ChatMessage.aggregate([
      { $match: { $or: matchConditions } },
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
    const mongoose = require('mongoose');
    const { phone } = req.params;
    const { leadId } = req.query;
    const cleanPhone = String(phone).replace(/\D/g, '');
    const tenDigit = cleanPhone.slice(-10);

    const isManagerOrOwner = req.user?.role === 'superadmin' ||
      req.user?.isAdmin ||
      req.membership?.role === 'owner' ||
      req.membership?.role === 'manager' ||
      req.user?.companyRole === 'owner' ||
      req.user?.companyRole === 'manager';

    const companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : null);

    // If counsellor / non-manager: verify the lead belongs to / is assigned to them, or user has personal messages
    if (!isManagerOrOwner) {
      const assignedLead = await Lead.findOne({
        $or: [
          ...(leadId && mongoose.Types.ObjectId.isValid(leadId) ? [{ _id: leadId }] : []),
          { phone: { $in: [cleanPhone, tenDigit, '91' + tenDigit] } }
        ],
        $and: [
          {
            $or: [
              { assignedTo: req.user._id },
              { userId: req.user._id },
              { currentOwnerId: req.user._id }
            ]
          }
        ]
      }).select('_id').lean();

      if (!assignedLead) {
        const hasPersonalMsg = await ChatMessage.exists({
          userId: { $in: [req.user._id, req.user._id.toString()] },
          phone: { $in: [cleanPhone, tenDigit, '91' + tenDigit] }
        });

        if (!hasPersonalMsg) {
          return res.status(403).json({
            code: 'ACCESS_DENIED',
            message: 'Access denied: You can only view chat conversations for leads assigned to you.'
          });
        }
      }
    }

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
      }).select('_id').lean();
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

    const isManagerOrOwner = req.user?.role === 'superadmin' ||
      req.user?.isAdmin ||
      req.membership?.role === 'owner' ||
      req.membership?.role === 'manager' ||
      req.user?.companyRole === 'owner' ||
      req.user?.companyRole === 'manager';

    const cleanPhoneCheck = String(phone).replace(/\D/g, '');
    const tenDigitCheck = cleanPhoneCheck.slice(-10);

    if (!isManagerOrOwner) {
      const otherLead = await Lead.findOne({
        phone: { $in: [cleanPhoneCheck, tenDigitCheck, '91' + tenDigitCheck] },
        assignedTo: { $exists: true, $ne: null, $nin: [req.user._id] }
      }).select('_id assignedTo').lean();

      if (otherLead && otherLead.assignedTo && otherLead.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          code: 'ACCESS_DENIED',
          message: 'Access denied: You cannot send messages to a lead assigned to another counsellor.'
        });
      }
    }

    const targetAccountId = req.body.accountId || req.body.whatsappAccountId;
    if (targetAccountId) {
      const workspaceId = req.workspace?._id || req.user.workspaceId;
      const allowed = await checkAccountAccess(req.user, targetAccountId, workspaceId);
      if (!allowed) {
        return res.status(403).json({
          code: 'ACCESS_DENIED',
          message: 'Access denied: You are not assigned to this WhatsApp account.',
        });
      }
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

// Helper to verify user assignment for WhatsApp accounts
const checkAccountAccess = async (user, accountId, workspaceId) => {
  if (!accountId) return true;
  const isPrivileged = user?.role === 'superadmin' ||
    user?.isAdmin ||
    user?.role === 'owner' ||
    user?.companyRole === 'owner';
  if (isPrivileged) return true;

  const WhatsAppAccount = require('../models/WhatsAppAccount');
  const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');

  const acc = (await WhatsAppAccount.findOne({ _id: accountId, workspaceId })) ||
              (await WhatsAppBusinessAccount.findOne({ _id: accountId, workspaceId }));
  if (!acc) return false;
  if (acc.isGlobal) return true;
  if (acc.assignedUserIds && acc.assignedUserIds.some(uid => uid.toString() === user._id.toString())) {
    return true;
  }
  return false;
};
exports.checkAccountAccess = checkAccountAccess;

// ── MULTI-ACCOUNT MANAGEMENT & ASSIGNMENTS ────────────────────────────────────
exports.getAccounts = async (req, res) => {
  try {
    const WhatsAppAccount = require('../models/WhatsAppAccount');
    const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
    const workspaceId = req.workspace?._id || req.user.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ message: 'Workspace context is required' });
    }

    const isPrivileged = req.user?.role === 'superadmin' ||
      req.user?.isAdmin ||
      req.membership?.role === 'owner' ||
      req.membership?.role === 'manager' ||
      req.user?.companyRole === 'owner';

    // 1. Fetch general/QR WhatsApp Accounts
    const generalQuery = { workspaceId };
    if (!isPrivileged) {
      generalQuery.$or = [
        { isGlobal: true },
        { assignedUserIds: req.user._id }
      ];
    }
    const accounts = await WhatsAppAccount.find(generalQuery)
      .populate('assignedUserIds', 'name email phone avatarIcon')
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch Meta Cloud API Accounts
    const metaQuery = { workspaceId, status: { $ne: 'DISCONNECTED' } };
    if (!isPrivileged) {
      metaQuery.$or = [
        { isGlobal: true },
        { assignedUserIds: req.user._id }
      ];
    }
    const metaAccounts = await WhatsAppBusinessAccount.find(metaQuery)
      .populate('assignedUserIds', 'name email phone avatarIcon')
      .select('wabaId phoneNumberId displayPhoneNumber verifiedName status qualityRating isGlobal assignedUserIds')
      .lean();

    const formattedMeta = metaAccounts.map(m => ({
      _id: m._id,
      name: m.verifiedName || 'Meta Cloud API Line',
      phoneNumber: m.displayPhoneNumber,
      type: 'cloud_api',
      wabaId: m.wabaId,
      phoneNumberId: m.phoneNumberId,
      status: m.status === 'CONNECTED' ? 'connected' : 'disconnected',
      isGlobal: Boolean(m.isGlobal),
      assignedUserIds: m.assignedUserIds || [],
    }));

    res.json({
      success: true,
      accounts: [...accounts, ...formattedMeta],
      isPrivileged,
    });
  } catch (err) {
    console.error('getAccounts error:', err);
    res.status(500).json({ message: 'Failed to retrieve WhatsApp accounts' });
  }
};

exports.createAccount = async (req, res) => {
  try {
    const WhatsAppAccount = require('../models/WhatsAppAccount');
    const workspaceId = req.workspace?._id || req.user.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ message: 'Workspace context is required' });
    }

    const { name, phoneNumber, type, sessionId, phoneNumberId, wabaId, isGlobal, assignedUserIds } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const cleanPhone = String(phoneNumber).trim();

    let account = await WhatsAppAccount.findOne({ workspaceId, phoneNumber: cleanPhone });
    if (account) {
      account.name = name || account.name;
      account.type = type || account.type;
      account.isGlobal = isGlobal !== undefined ? Boolean(isGlobal) : account.isGlobal;
      if (Array.isArray(assignedUserIds)) account.assignedUserIds = assignedUserIds;
      await account.save();
    } else {
      account = await WhatsAppAccount.create({
        workspaceId,
        ownerId: req.user._id,
        name: name || 'WhatsApp Line',
        phoneNumber: cleanPhone,
        type: type || 'baileys',
        sessionId: sessionId || null,
        phoneNumberId: phoneNumberId || null,
        wabaId: wabaId || null,
        status: 'connected',
        isGlobal: Boolean(isGlobal),
        assignedUserIds: Array.isArray(assignedUserIds) ? assignedUserIds : [],
      });
    }

    res.status(201).json({
      success: true,
      message: 'WhatsApp account registered successfully',
      account,
    });
  } catch (err) {
    console.error('createAccount error:', err);
    res.status(500).json({ message: err.message || 'Failed to create WhatsApp account' });
  }
};

exports.updateAccountAssignments = async (req, res) => {
  try {
    const WhatsAppAccount = require('../models/WhatsAppAccount');
    const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
    const workspaceId = req.workspace?._id || req.user.workspaceId;
    const { id } = req.params;
    const { isGlobal, assignedUserIds } = req.body;

    let updated = await WhatsAppAccount.findOneAndUpdate(
      { _id: id, workspaceId },
      {
        $set: {
          ...(isGlobal !== undefined ? { isGlobal: Boolean(isGlobal) } : {}),
          ...(Array.isArray(assignedUserIds) ? { assignedUserIds } : {}),
        }
      },
      { new: true }
    ).populate('assignedUserIds', 'name email phone avatarIcon');

    if (!updated) {
      updated = await WhatsAppBusinessAccount.findOneAndUpdate(
        { _id: id, workspaceId },
        {
          $set: {
            ...(isGlobal !== undefined ? { isGlobal: Boolean(isGlobal) } : {}),
            ...(Array.isArray(assignedUserIds) ? { assignedUserIds } : {}),
          }
        },
        { new: true }
      ).populate('assignedUserIds', 'name email phone avatarIcon');
    }

    if (!updated) {
      return res.status(404).json({ message: 'WhatsApp account not found' });
    }

    res.json({
      success: true,
      message: 'WhatsApp account assignments updated successfully',
      account: updated,
    });
  } catch (err) {
    console.error('updateAccountAssignments error:', err);
    res.status(500).json({ message: 'Failed to update WhatsApp account assignments' });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const WhatsAppAccount = require('../models/WhatsAppAccount');
    const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
    const workspaceId = req.workspace?._id || req.user.workspaceId;
    const { id } = req.params;

    let deleted = await WhatsAppAccount.findOneAndDelete({ _id: id, workspaceId });
    if (!deleted) {
      deleted = await WhatsAppBusinessAccount.findOneAndUpdate(
        { _id: id, workspaceId },
        { $set: { status: 'DISCONNECTED' } }
      );
    }

    if (!deleted) {
      return res.status(404).json({ message: 'WhatsApp account not found' });
    }

    res.json({ success: true, message: 'WhatsApp account disconnected and removed' });
  } catch (err) {
    console.error('deleteAccount error:', err);
    res.status(500).json({ message: 'Failed to delete WhatsApp account' });
  }
};
