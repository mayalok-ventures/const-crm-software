const EventEmitter = require('events');
const crypto = require('crypto');
const WebhookEvent = require('../../models/WebhookEvent');
const Integration = require('../../models/Integration');
const Lead = require('../../models/Lead');
const Notification = require('../../models/Notification');
const leadIngestionService = require('./leadIngestionService');
const { parseLosslessJson } = require('../../utils/losslessJson');

const queueEmitter = new EventEmitter();

// Exponential backoff retry delays (in minutes): 1, 5, 15, 30, 60
const BACKOFF_MINUTES = [1, 5, 15, 30, 60];
const STALE_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

class WebhookQueueService {
  constructor() {
    // Listen for immediate background processing nudges
    queueEmitter.on('nudge', (eventId) => {
      setImmediate(async () => {
        try {
          await this.processEvent(eventId);
        } catch (err) {
          console.error('[Queue Nudge Error]:', err.message);
        }
      });
    });
  }

  /**
   * Enqueue inbound webhook payload with durability guarantee.
   * Never stores sensitive Authorization headers.
   */
  async enqueueEvent({
    provider,
    integrationId = null,
    companyId = null,
    userId = null,
    externalLeadId = '',
    headers = {},
    rawBody,
    isTest = false,
  }) {
    // Whitelist only safe operational headers (never Authorization or Bearer tokens)
    const whitelistedHeaders = {
      'content-type': headers['content-type'],
      'user-agent': headers['user-agent'],
      'x-hub-signature-256': headers['x-hub-signature-256'],
      'x-goog-user-project': headers['x-goog-user-project'],
      'x-crm-secret-prefix': headers['x-crm-secret'] ? headers['x-crm-secret'].substring(0, 6) + '...' : undefined,
    };

    let event;
    try {
      event = await WebhookEvent.create({
        provider,
        integrationId,
        companyId,
        userId,
        externalLeadId: String(externalLeadId || ''),
        isTest: Boolean(isTest),
        headers: whitelistedHeaders,
        rawBody,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
      });
    } catch (err) {
      // Requirement C.4: Unique partial index duplicate-key catch
      if (err.code === 11000) {
        console.log(`[Queue] Deduplicated already-queued event for ${provider} (External ID: ${externalLeadId})`);
        return { duplicate: true, eventId: null };
      }
      // If DB insert failed, throw so HTTP controller returns 5xx and provider retries
      throw err;
    }

    // Nudge worker for immediate processing attempt (< 25ms after response)
    queueEmitter.emit('nudge', event._id);

    return { duplicate: false, eventId: event._id };
  }

  /**
   * Process a single WebhookEvent atomically.
   */
  async processEvent(eventId) {
    if (!eventId) return;

    // Atomic claim with lock
    const event = await WebhookEvent.findOneAndUpdate(
      {
        _id: eventId,
        status: { $in: ['pending', 'failed'] },
        nextAttemptAt: { $lte: new Date() },
      },
      {
        $set: {
          status: 'processing',
          lockedAt: new Date(),
          lockedBy: `pid_${process.pid}`,
        },
      },
      { new: true }
    );

    if (!event) {
      return; // Already claimed by another worker or not due yet
    }

    try {
      await this.executeEventTask(event);

      // Successfully completed
      event.status = 'completed';
      event.lockedAt = null;
      event.lockedBy = null;
      event.completedAt = new Date();
      await event.save();
    } catch (error) {
      await this.handleProcessingFailure(event, error);
    }
  }

  /**
   * Execute the ingestion task based on provider
   */
  async executeEventTask(event) {
    const { provider, integrationId, rawBody, isTest, externalLeadId } = event;

    // Requirement C.3: End-to-end idempotent processing
    // If a Lead already exists with this external lead ID, mark completed immediately
    if (externalLeadId) {
      const existing = await Lead.findOne({
        'leadSource.provider': provider,
        'leadSource.externalLeadId': String(externalLeadId),
      });
      if (existing) {
        event.processedLeadId = existing._id;
        return;
      }
    }

    // Requirement E.2: Google Ads Test Event handling
    // If isTest === true, do NOT create a Lead document.
    // Record on WebhookEvent, update integration.metadata.lastTestReceivedAt, and finish.
    if (provider === 'google' && isTest) {
      if (integrationId) {
        await Integration.findByIdAndUpdate(integrationId, {
          $set: {
            'metadata.lastTestReceivedAt': new Date(),
            lastSyncAt: new Date(),
          },
        });
      }
      return;
    }

    // Parse lossless payload if string or buffer
    const payload = parseLosslessJson(rawBody);

    const providerRegistry = require('./providers');
    const providerInstance = providerRegistry.get(provider);

    const integration = await Integration.findById(integrationId).select('+accessTokenEncrypted');
    if (!integration) throw new Error(`Integration ${integrationId} not found`);

    // 1. Hydrate (optional async fetch, e.g. Meta Graph API)
    const hydrated = await providerInstance.hydrate(
      { ...payload, externalLeadId: event.externalLeadId },
      integration
    );

    // 2. Normalize to standard lead hierarchy
    const normalized = providerInstance.normalize(hydrated, integration);

    // 3. Shared Ingestion Pipeline
    const ingestResult = await leadIngestionService.ingest({
      ...normalized,
      integrationId: integration._id,
      isTest: Boolean(isTest || normalized.isTest),
    });

    if (ingestResult?.lead) {
      event.processedLeadId = ingestResult.lead._id;
    }
  }

  async processMetaEvent(event, payload) {
    const { fetchMetaLeadDetails } = require('../../controllers/integrations/metaWebhookController');
    const { integrationId, externalLeadId } = event;

    const integration = await Integration.findById(integrationId).select('+accessTokenEncrypted');
    if (!integration) throw new Error(`Integration ${integrationId} not found`);

    const accessToken = integration.accessToken;
    if (!accessToken && !String(externalLeadId).startsWith('meta_test_')) {
      throw new Error(`Integration ${integrationId} has no decrypted access token`);
    }

    let leadData;
    if (String(externalLeadId).startsWith('meta_test_') || !accessToken) {
      leadData = {
        name: 'Meta Ads Test Lead',
        phone: '+919876543210',
        email: 'meta.test@example.com',
        campaignName: 'Meta Campaign',
        formName: 'Lead Form',
        customData: {},
      };
    } else {
      leadData = await fetchMetaLeadDetails(externalLeadId, accessToken, integration);
    }

    const ingestResult = await leadIngestionService.ingest({
      provider: 'meta',
      integrationId: integration._id,
      externalLeadId: String(externalLeadId),
      accountId: integration.accountId,
      pageId: payload.pageId || integration.pageId,
      formId: payload.formId || leadData.formId,
      formName: leadData.formName,
      campaignId: leadData.campaignId,
      campaignName: leadData.campaignName,
      adSetId: leadData.adSetId,
      adSetName: leadData.adSetName,
      adId: leadData.adId,
      adName: leadData.adName,
      name: leadData.name,
      phone: leadData.phone,
      email: leadData.email,
      customData: leadData.customData || {},
      rawAnswers: leadData.rawAnswers || [],
      createdAt: payload.createdTime ? new Date(payload.createdTime * 1000) : new Date(),
    });

    if (ingestResult?.lead) {
      event.processedLeadId = ingestResult.lead._id;
    }
  }

  async processGoogleEvent(event, payload) {
    const integration = await Integration.findById(event.integrationId);
    if (!integration) throw new Error(`Integration ${event.integrationId} not found`);

    const columns = Array.isArray(payload.user_column_data) ? payload.user_column_data : [];
    let name = '';
    let phone = '';
    let email = '';
    const customData = {};

    for (const col of columns) {
      const colId = String(col.column_id || '').toUpperCase();
      const colVal = col.string_value || '';
      if (colId === 'FULL_NAME' || colId === 'FIRST_NAME') {
        if (!name) name = colVal;
      } else if (colId === 'PHONE_NUMBER') {
        if (!phone) phone = colVal;
      } else if (colId === 'EMAIL') {
        if (!email) email = colVal;
      } else {
        customData[col.column_name || col.column_id || 'field'] = colVal;
      }
    }

    const ingestResult = await leadIngestionService.ingest({
      provider: 'google',
      integrationId: integration._id,
      externalLeadId: String(event.externalLeadId || payload.lead_id),
      accountId: payload.customer_id || integration.accountId,
      campaignId: payload.campaign_id ? String(payload.campaign_id) : null,
      campaignName: payload.campaign_name || '',
      adGroupId: payload.adgroup_id ? String(payload.adgroup_id) : null,
      adGroupName: payload.adgroup_name || '',
      adId: payload.creative_id ? String(payload.creative_id) : null,
      formId: payload.form_id ? String(payload.form_id) : null,
      formName: payload.form_name || 'Google Lead Extension Form',
      name,
      phone,
      email,
      customData,
      isTest: Boolean(event.isTest),
      createdAt: payload.lead_submit_time ? new Date(payload.lead_submit_time) : new Date(),
    });

    if (ingestResult?.lead) {
      event.processedLeadId = ingestResult.lead._id;
    }
  }

  async processSheetsEvent(event, payload) {
    const integration = await Integration.findById(event.integrationId);
    if (!integration) throw new Error(`Integration ${event.integrationId} not found`);

    const rowData = payload.rowData || {};
    const ingestResult = await leadIngestionService.ingest({
      provider: 'sheets',
      integrationId: integration._id,
      externalLeadId: String(event.externalLeadId || payload.leadId),
      formName: payload.sheetName || 'Google Sheet',
      name: rowData.name || rowData.Name || rowData['Full Name'] || '',
      phone: rowData.phone || rowData.Phone || rowData['Phone Number'] || rowData.Mobile || '',
      email: rowData.email || rowData.Email || '',
      customData: rowData,
      createdAt: new Date(),
    });

    if (ingestResult?.lead) {
      event.processedLeadId = ingestResult.lead._id;
    }
  }

  async processWebsiteEvent(event, payload) {
    const integration = await Integration.findById(event.integrationId);
    if (!integration) throw new Error(`Integration ${event.integrationId} not found`);

    const ingestResult = await leadIngestionService.ingest({
      provider: 'website',
      integrationId: integration._id,
      externalLeadId: String(event.externalLeadId),
      formId: integration.websiteFormConfig?.formKey,
      formName: payload.form_name || 'Website Inbound Form',
      name: payload.name || payload.fullName || '',
      phone: payload.phone || payload.mobile || '',
      email: payload.email || '',
      utmSource: payload.utm_source || '',
      utmMedium: payload.utm_medium || '',
      utmCampaign: payload.utm_campaign || '',
      customData: payload.customData || payload,
      createdAt: new Date(),
    });

    if (ingestResult?.lead) {
      event.processedLeadId = ingestResult.lead._id;
    }
  }

  /**
   * Handle processing failures with exponential backoff and dead-letter state.
   */
  async handleProcessingFailure(event, error) {
    event.attempts += 1;
    event.lockedAt = null;
    event.lockedBy = null;
    event.lastError = {
      message: error.message || 'Unknown processing error',
      stack: error.stack || '',
      code: error.code || error.response?.status || '',
      timestamp: new Date(),
    };

    if (event.attempts >= event.maxAttempts) {
      // Transition to dead-letter
      event.status = 'dead_letter';

      // Requirement C.8: Dead-letter marks integration "degraded" with count and notifies admin
      if (event.integrationId) {
        await Integration.findByIdAndUpdate(event.integrationId, {
          $inc: { degradedLeadCount: 1 },
          $set: { status: 'degraded', lastError: error.message },
        });

        // Notify tenant admin
        if (event.userId || event.companyId) {
          await Notification.create({
            userId: event.userId || event.companyId,
            title: `⚠️ Integration Degraded (${event.provider.toUpperCase()})`,
            message: `Lead event failed after 5 retries: ${error.message}. You can review and retry it from the Integrations Audit page.`,
            type: 'system_alert',
            isRead: false,
          }).catch(() => {});
        }
      }
    } else {
      // Schedule exponential backoff retry
      const backoffMin = BACKOFF_MINUTES[event.attempts - 1] || 60;
      event.status = 'failed';
      event.nextAttemptAt = new Date(Date.now() + backoffMin * 60 * 1000);
      console.log(`[Queue] Rescheduled event ${event._id} for retry ${event.attempts}/${event.maxAttempts} in ${backoffMin}m`);
    }

    await event.save();
  }

  /**
   * Periodic sweep: claims due retry jobs and reclaims stale locks
   * Executed every minute via node-cron
   */
  async processQueueSweep() {
    try {
      // 1. Reclaim stale locks (stuck in 'processing' past STALE_LOCK_TIMEOUT_MS)
      const staleThreshold = new Date(Date.now() - STALE_LOCK_TIMEOUT_MS);
      const staleReclaimed = await WebhookEvent.updateMany(
        {
          status: 'processing',
          lockedAt: { $lt: staleThreshold },
        },
        {
          $set: {
            status: 'failed',
            lockedAt: null,
            lockedBy: null,
            nextAttemptAt: new Date(), // Re-run immediately
          },
        }
      );

      if (staleReclaimed.modifiedCount > 0) {
        console.log(`[Queue] Reclaimed ${staleReclaimed.modifiedCount} stale locked webhook events`);
      }

      // 2. Poll due pending or failed events
      const dueEvents = await WebhookEvent.find({
        status: { $in: ['pending', 'failed'] },
        nextAttemptAt: { $lte: new Date() },
        attempts: { $lt: 5 },
      })
        .limit(25)
        .select('_id');

      for (const ev of dueEvents) {
        await this.processEvent(ev._id);
      }
    } catch (sweepErr) {
      console.error('[Queue Sweep Error]:', sweepErr.message);
    }
  }

  /**
   * Manual admin re-drive for failed or dead-letter events
   */
  async retryEvent(eventId) {
    const event = await WebhookEvent.findById(eventId);
    if (!event) throw new Error('Webhook event not found');

    event.status = 'pending';
    event.attempts = 0;
    event.nextAttemptAt = new Date();
    event.lockedAt = null;
    event.lockedBy = null;
    await event.save();

    // Trigger immediate execution
    queueEmitter.emit('nudge', event._id);
    return event;
  }
}

module.exports = new WebhookQueueService();
