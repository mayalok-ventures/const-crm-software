const Notification = require('../models/Notification');
const { broadcastNotification } = require('../controllers/notificationsController');
const { sendPushNotification } = require('./pushNotificationService');

/**
 * Universal Notification Dispatcher
 * Persists in-app record, broadcasts real-time SSE, and sends device Web Push.
 */
const dispatchNotification = async ({
  userId,
  workspaceId = null,
  companyId = null,
  leadId = null,
  leadName = '',
  title,
  message,
  type = 'system',
  priority = 'normal',
  category = 'system',
  entityType = 'System',
  entityId = null,
  dueAt = null,
  dedupKey = null,
  channels = ['in_app', 'push', 'sse'],
  metadata = {},
  pushPayload = null,
}) => {
  if (!userId || !message) {
    throw new Error('userId and message are mandatory for dispatchNotification');
  }

  // 1. Idempotent In-App Notification Record
  let notifDoc = null;
  try {
    if (dedupKey) {
      notifDoc = await Notification.findOne({ dedupKey });
      if (notifDoc) {
        // Already created, avoid duplicate dispatch
        return { notification: notifDoc, duplicate: true };
      }
    }

    notifDoc = await Notification.create({
      userId,
      workspaceId,
      companyId,
      leadId,
      leadName,
      title: title || 'CRM Alert',
      message,
      type,
      priority,
      category,
      entityType,
      entityId: entityId || leadId || null,
      dueAt,
      dedupKey,
      channels,
      metadata,
      deliveryStatus: {
        inApp: 'delivered',
        push: channels.includes('push') ? 'pending' : 'skipped',
      },
    });
  } catch (err) {
    if (err.code === 11000 && dedupKey) {
      // Duplicate key race condition caught cleanly
      notifDoc = await Notification.findOne({ dedupKey });
      return { notification: notifDoc, duplicate: true };
    }
    console.error('[NotificationService] In-app record creation error:', err.message);
    throw err;
  }

  // 2. Real-Time SSE Broadcast (for active in-browser tabs)
  if (channels.includes('sse')) {
    try {
      broadcastNotification(userId, {
        type,
        notification: notifDoc,
        priority,
        category,
        leadId,
        timestamp: new Date(),
      });
    } catch (sseErr) {
      console.warn('[NotificationService] SSE broadcast warning:', sseErr.message);
    }
  }

  // 3. Web Push Notification (for background mobile/desktop PWA)
  if (channels.includes('push')) {
    try {
      const defaultUrl = leadId ? `/leads/${leadId}` : '/follow-ups';
      const pushBody = {
        title: title || 'CRM Notification',
        body: message,
        url: pushPayload?.url || defaultUrl,
        type,
        priority,
        tag: `notif-${type}-${leadId || 'general'}`,
        timestamp: Date.now(),
      };

      const pushResult = await sendPushNotification(userId, pushBody);
      await Notification.updateOne(
        { _id: notifDoc._id },
        {
          $set: {
            'deliveryStatus.push': pushResult.sentCount > 0 ? 'delivered' : 'failed',
            'deliveryStatus.pushError': pushResult.reason || null,
          },
        }
      ).catch(() => {});
    } catch (pushErr) {
      console.warn('[NotificationService] Web Push dispatch warning:', pushErr.message);
    }
  }

  return { notification: notifDoc, duplicate: false };
};

/**
 * Helper: Follow-up due alert
 */
const notifyFollowUpDue = async (lead, followUp, recipientUserId) => {
  const dedupKey = `followup_due_${lead._id}_${new Date(followUp.scheduled_at || followUp.scheduledAt || Date.now()).getTime()}`;
  const title = `⏰ Follow-Up Due: ${lead.name || 'Candidate'}`;
  const agendaText = followUp.note || lead.followUpNote || 'Follow-up call scheduled';
  const message = `Call due with ${lead.name || 'Student'} (${lead.phone || 'Phone'}). Agenda: ${agendaText}`;

  return dispatchNotification({
    userId: recipientUserId,
    workspaceId: lead.workspaceId || followUp.workspaceId || null,
    companyId: lead.companyId || followUp.companyId || null,
    leadId: lead._id,
    leadName: lead.name,
    title,
    message,
    type: 'follow_up',
    priority: 'urgent',
    category: 'reminder',
    entityType: 'FollowUp',
    entityId: followUp._id || lead._id,
    dueAt: followUp.scheduled_at || followUp.scheduledAt || new Date(),
    dedupKey,
    pushPayload: {
      url: `/leads/${lead._id}`,
    },
  });
};

/**
 * Helper: WhatsApp Connection Lost Alert
 */
const notifyWhatsAppDisconnected = async (userId, phone, reason = 'Connection dropped') => {
  const hourBucket = Math.floor(Date.now() / (1000 * 60 * 30)); // 30-minute deduplication bucket
  const dedupKey = `wa_disconnect_${userId}_${hourBucket}`;
  const title = '⚠️ WhatsApp Disconnected';
  const message = `Your WhatsApp connection (${phone ? '+' + phone : 'Device'}) dropped: ${reason}. Auto-reconnecting in background...`;

  return dispatchNotification({
    userId,
    title,
    message,
    type: 'whatsapp_disconnect',
    priority: 'high',
    category: 'communication',
    entityType: 'WhatsApp',
    dedupKey,
    pushPayload: {
      url: '/whatsapp',
    },
  });
};

/**
 * Helper: WhatsApp Session Restored Alert
 */
const notifyWhatsAppReconnected = async (userId, phone) => {
  const title = '✅ WhatsApp Reconnected';
  const message = `WhatsApp connection (${phone ? '+' + phone : 'Device'}) has been automatically restored and is operational.`;

  return dispatchNotification({
    userId,
    title,
    message,
    type: 'whatsapp_reconnect',
    priority: 'normal',
    category: 'communication',
    entityType: 'WhatsApp',
    pushPayload: {
      url: '/whatsapp',
    },
  });
};

module.exports = {
  dispatchNotification,
  notifyFollowUpDue,
  notifyWhatsAppDisconnected,
  notifyWhatsAppReconnected,
};
