const axios = require('axios');
const crypto = require('crypto');
const WhatsAppBusinessAccount = require('../../models/WhatsAppBusinessAccount');
const ChatMessage = require('../../models/ChatMessage');
const Lead = require('../../models/Lead');
const Template = require('../../models/Template');

const META_GRAPH_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

class MetaWhatsAppService {
  /**
   * Diagnostic check on environment readiness for Meta WhatsApp Business Platform
   */
  static getConfigStatus() {
    const hasToken = Boolean(process.env.WHATSAPP_CLOUD_API_TOKEN);
    const hasPhoneId = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);
    const hasWabaId = Boolean(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID);
    const hasAppId = Boolean(process.env.META_APP_ID);
    const hasAppSecret = Boolean(process.env.META_APP_SECRET);

    return {
      configured: hasToken && hasPhoneId && hasWabaId,
      details: {
        hasCloudApiToken: hasToken,
        hasPhoneNumberId: hasPhoneId,
        hasWabaId: hasWabaId,
        hasAppId: hasAppId,
        hasAppSecret: hasAppSecret,
        graphVersion: META_GRAPH_VERSION,
        webhookCallbackUrl: `${process.env.BACKEND_PUBLIC_URL || 'https://api.sahyakcrm.com'}/api/whatsapp/meta/webhook`,
      },
      requirements: [
        'Meta Developer Account (developers.facebook.com)',
        'WhatsApp Business App with whatsapp_business_management & whatsapp_business_messaging permissions',
        'Registered and verified Business Phone Number',
        'System User with Admin or WhatsApp Manager access and permanent token',
      ],
    };
  }

  /**
   * Get connected WABA account for a workspace
   */
  static async getAccount(workspaceId) {
    const account = await WhatsAppBusinessAccount.findOne({
      workspaceId,
      status: { $ne: 'DISCONNECTED' },
    });
    return account ? account.toSafeJSON() : null;
  }

  /**
   * Connect or update official WABA credentials for workspace
   */
  static async connectAccount({
    workspaceId,
    ownerId,
    wabaId,
    phoneNumberId,
    displayPhoneNumber,
    verifiedName,
    accessToken,
    appSecret,
    metaAppId,
  }) {
    if (!wabaId || !phoneNumberId || !accessToken) {
      throw new Error('WABA ID, Phone Number ID, and System User Access Token are required');
    }

    let account = await WhatsAppBusinessAccount.findOne({ workspaceId, phoneNumberId });
    if (!account) {
      account = new WhatsAppBusinessAccount({
        workspaceId,
        ownerId,
        wabaId: wabaId.trim(),
        phoneNumberId: phoneNumberId.trim(),
      });
    }

    account.displayPhoneNumber = displayPhoneNumber || account.displayPhoneNumber || '';
    account.verifiedName = verifiedName || account.verifiedName || '';
    account.metaAppId = metaAppId || process.env.META_APP_ID || '';
    account.setAccessToken(accessToken.trim());
    if (appSecret) {
      account.setAppSecret(appSecret.trim());
    }

    // Live verification with Meta Graph API
    try {
      const res = await axios.get(`${META_BASE_URL}/${phoneNumberId.trim()}`, {
        params: {
          fields: 'verified_name,code_verification_status,display_phone_number,quality_rating',
        },
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
        },
        timeout: 10000,
      });

      if (res.data) {
        account.verifiedName = res.data.verified_name || account.verifiedName;
        account.displayPhoneNumber = res.data.display_phone_number || account.displayPhoneNumber;
        account.qualityRating = res.data.quality_rating || 'UNKNOWN';
        account.codeVerificationStatus = res.data.code_verification_status || 'VERIFIED';
        account.status = 'CONNECTED';
        account.lastSyncAt = new Date();
        account.lastError = null;
      }
    } catch (graphErr) {
      const errMsg = graphErr.response?.data?.error?.message || graphErr.message;
      console.warn(`[MetaWhatsApp] Graph API verification warning: ${errMsg}`);
      // If server is testing or offline, we save but flag the status
      account.lastError = errMsg;
      account.status = graphErr.response?.status === 401 ? 'RESTRICTED' : 'CONNECTED';
    }

    await account.save();
    return account.toSafeJSON();
  }

  /**
   * Disconnect official WABA account
   */
  static async disconnectAccount(workspaceId) {
    const account = await WhatsAppBusinessAccount.findOne({
      workspaceId,
      status: { $ne: 'DISCONNECTED' },
    });
    if (!account) {
      throw new Error('No active Meta WhatsApp Business Account found to disconnect');
    }

    account.status = 'DISCONNECTED';
    await account.save();
    return { success: true, message: 'Official WhatsApp account disconnected' };
  }

  /**
   * Verify HMAC-SHA256 signature from incoming Meta webhook
   */
  static verifyWebhookSignature(req, appSecret) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      console.warn('[MetaWhatsApp Webhook] Missing x-hub-signature-256 header');
      return false;
    }

    const secret = appSecret || process.env.META_APP_SECRET;
    if (!secret) {
      console.warn('[MetaWhatsApp Webhook] META_APP_SECRET not configured on server');
      if (process.env.NODE_ENV === 'production') {
        console.error('[MetaWhatsApp Webhook] Rejecting webhook in production: META_APP_SECRET is required');
        return false;
      }
      return true; // Bypass in dev if not set
    }

    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  /**
   * Process incoming Meta WhatsApp Webhook events (Messages & Statuses)
   */
  static async processWebhookEvent(payload) {
    if (payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
      return { ignored: true };
    }

    for (const entry of payload.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const val = change.value;
        if (!val) continue;

        const phoneNumberId = val.metadata?.phone_number_id;
        const account = await WhatsAppBusinessAccount.findOne({
          phoneNumberId,
          status: 'CONNECTED',
        });

        const workspaceId = account ? account.workspaceId : null;
        const ownerId = account ? account.ownerId : null;

        // 1. Process Inbound Messages
        if (Array.isArray(val.messages)) {
          for (const msg of val.messages) {
            const senderPhone = msg.from; // e.g. "919876543210"
            const waMessageId = msg.id;
            let text = '';
            let mediaUrl = null;
            let mediaType = null;

            if (msg.type === 'text') {
              text = msg.text?.body || '';
            } else if (msg.type === 'image') {
              mediaType = 'image';
              text = msg.image?.caption || '';
            } else if (msg.type === 'document') {
              mediaType = 'document';
              text = msg.document?.caption || msg.document?.filename || '';
            } else if (msg.type === 'video') {
              mediaType = 'video';
              text = msg.video?.caption || '';
            } else if (msg.type === 'interactive') {
              text = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || msg.interactive?.button_reply?.id || '';
            } else if (msg.type === 'button') {
              text = msg.button?.text || msg.button?.payload || '';
            }

            // Find matching lead in workspace
            let matchedLead = null;
            if (workspaceId) {
              const cleanDigits = senderPhone.replace(/\D/g, '').slice(-10);
              matchedLead = await Lead.findOne({
                workspaceId,
                $or: [{ phone: cleanDigits }, { phoneDigits: cleanDigits }],
              });
            }

            // Deduplicate incoming message
            const existing = await ChatMessage.findOne({ waMessageId });
            if (!existing) {
              await ChatMessage.create({
                userId: ownerId,
                workspaceId,
                leadId: matchedLead?._id || null,
                phone: senderPhone,
                senderName: val.contacts?.[0]?.profile?.name || '+' + senderPhone,
                direction: 'inbound',
                text,
                mediaUrl,
                mediaType,
                status: 'received',
                channel: 'meta_cloud',
                wabaId: entry.id,
                metaPhoneNumberId: phoneNumberId,
                waMessageId,
                timestamp: new Date(Number(msg.timestamp) * 1000),
              });

              if (matchedLead) {
                matchedLead.leadActivities.push({
                  action: 'message_received',
                  details: `Received WhatsApp message via Meta Cloud API: "${text.slice(0, 80)}"`,
                  timestamp: new Date(),
                });
                await matchedLead.save();
              }

              // Trigger Inbound WhatsApp Chatbot & Automation Workflow
              try {
                const AutomationEngine = require('../automationEngine');
                AutomationEngine.handleInboundWhatsAppMessage({
                  userId: ownerId,
                  workspaceId,
                  lead: matchedLead,
                  phone: senderPhone,
                  text,
                  channel: 'meta_cloud',
                  metaPhoneNumberId: phoneNumberId,
                }).catch(err => console.error('[MetaWA] Inbound automation trigger error:', err.message));
              } catch (autoErr) {
                console.error('[MetaWA] AutomationEngine dispatch error:', autoErr.message);
              }
            }
          }
        }

        // 2. Process Status Updates (sent, delivered, read, failed)
        if (Array.isArray(val.statuses)) {
          for (const st of val.statuses) {
            const waMessageId = st.id;
            const status = st.status; // 'sent' | 'delivered' | 'read' | 'failed'
            const errorDetails = st.errors ? JSON.stringify(st.errors) : null;

            await ChatMessage.findOneAndUpdate(
              { waMessageId },
              {
                status,
                ...(errorDetails ? { errorDetails } : {}),
              }
            );
          }
        }
      }
    }

    return { processed: true };
  }

  /**
   * Check if customer service 24-hour window is currently open for a phone number
   */
  static async isMessagingWindowOpen(workspaceId, phone) {
    const cleanDigits = phone.replace(/\D/g, '').slice(-10);
    const lastInbound = await ChatMessage.findOne({
      workspaceId,
      phone: { $regex: cleanDigits },
      direction: 'inbound',
    }).sort({ timestamp: -1 });

    if (!lastInbound) return false;
    const diffHours = (Date.now() - new Date(lastInbound.timestamp).getTime()) / (1000 * 60 * 60);
    return diffHours < 24;
  }

  /**
   * Send 1:1 Text Message via Official Meta Cloud API
   */
  static async sendTextMessage({ workspaceId, userId, userName = 'Agent', to, text, leadId = null }) {
    if (!to || !text) throw new Error('Recipient number and message text are required');

    const account = await WhatsAppBusinessAccount.findOne({
      workspaceId,
      status: 'CONNECTED',
    }).select('+systemUserAccessTokenEncrypted');

    if (!account) {
      throw new Error('No active Official WhatsApp Business Account connected for this workspace');
    }

    const token = account.getDecryptedAccessToken();
    if (!token) throw new Error('Decryption of system user token failed');

    // Verify 24-hour messaging window rule
    const windowOpen = await this.isMessagingWindowOpen(workspaceId, to);
    if (!windowOpen) {
      throw new Error(
        'Meta Policy: Outside the 24-hour customer service window. You must send an approved WhatsApp Template to initiate this conversation.'
      );
    }

    const cleanTo = to.replace(/\D/g, '');

    const res = await axios.post(
      `${META_BASE_URL}/${account.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: { preview_url: false, body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const waMessageId = res.data?.messages?.[0]?.id || `wamid_${Date.now()}`;

    // Persist in ChatMessage collection
    const chatMsg = await ChatMessage.create({
      userId,
      workspaceId,
      leadId,
      phone: cleanTo,
      senderName: `${userName} (Official WhatsApp)`,
      direction: 'outbound',
      text,
      status: 'sent',
      channel: 'meta_cloud',
      metaPhoneNumberId: account.phoneNumberId,
      wabaId: account.wabaId,
      waMessageId,
      timestamp: new Date(),
    });

    // Update Lead timeline if linked
    if (leadId) {
      const lead = await Lead.findOne({ _id: leadId, workspaceId });
      if (lead) {
        lead.leadActivities.push({
          action: 'message_sent',
          performedBy: userId,
          performerName: userName,
          details: `Sent official WhatsApp message: "${text.slice(0, 80)}"`,
          timestamp: new Date(),
        });
        await lead.save();
      }
    }

    return chatMsg;
  }

  /**
   * Send Approved WhatsApp Template Message via Official Meta Cloud API
   */
  static async sendTemplateMessage({
    workspaceId,
    userId,
    userName = 'Agent',
    to,
    templateName,
    languageCode = 'en',
    components = [],
    leadId = null,
  }) {
    if (!to || !templateName) {
      throw new Error('Recipient number and templateName are required');
    }

    const account = await WhatsAppBusinessAccount.findOne({
      workspaceId,
      status: 'CONNECTED',
    }).select('+systemUserAccessTokenEncrypted');

    if (!account) {
      throw new Error('No active Official WhatsApp Business Account connected for this workspace');
    }

    const token = account.getDecryptedAccessToken();
    if (!token) throw new Error('Decryption of system user token failed');

    const cleanTo = to.replace(/\D/g, '');

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && components.length > 0 ? { components } : {}),
      },
    };

    const res = await axios.post(
      `${META_BASE_URL}/${account.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const waMessageId = res.data?.messages?.[0]?.id || `wamid_${Date.now()}`;

    // Persist in ChatMessage collection
    const chatMsg = await ChatMessage.create({
      userId,
      workspaceId,
      leadId,
      phone: cleanTo,
      senderName: `${userName} (Official WhatsApp)`,
      direction: 'outbound',
      text: `[Template: ${templateName}]`,
      templateName,
      status: 'sent',
      channel: 'meta_cloud',
      metaPhoneNumberId: account.phoneNumberId,
      wabaId: account.wabaId,
      waMessageId,
      timestamp: new Date(),
    });

    if (leadId) {
      const lead = await Lead.findOne({ _id: leadId, workspaceId });
      if (lead) {
        lead.leadActivities.push({
          action: 'message_sent',
          performedBy: userId,
          performerName: userName,
          details: `Sent approved WhatsApp template "${templateName}" via Meta Cloud API`,
          timestamp: new Date(),
        });
        await lead.save();
      }
    }

    return chatMsg;
  }

  /**
   * Fetch approved message templates from Meta WABA
   */
  static async getTemplates(workspaceId) {
    const account = await WhatsAppBusinessAccount.findOne({
      workspaceId,
      status: 'CONNECTED',
    }).select('+systemUserAccessTokenEncrypted');

    if (!account) return [];
    const token = account.getDecryptedAccessToken();
    if (!token) return [];

    try {
      const res = await axios.get(`${META_BASE_URL}/${account.wabaId}/message_templates`, {
        params: { limit: 100 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      return res.data?.data || [];
    } catch (err) {
      console.error('[MetaWhatsApp] getTemplates error:', err.response?.data?.error?.message || err.message);
      return [];
    }
  }

  /**
   * Submit a new template to Meta for review
   */
  static async createTemplate({ workspaceId, name, category, language = 'en', components }) {
    const account = await WhatsAppBusinessAccount.findOne({
      workspaceId,
      status: 'CONNECTED',
    }).select('+systemUserAccessTokenEncrypted');

    if (!account) {
      throw new Error('No active Official WhatsApp Business Account connected');
    }

    const token = account.getDecryptedAccessToken();
    if (!token) throw new Error('Decryption of system user token failed');

    const res = await axios.post(
      `${META_BASE_URL}/${account.wabaId}/message_templates`,
      {
        name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        category: category || 'UTILITY',
        language,
        components,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    return res.data;
  }
}

module.exports = MetaWhatsAppService;
