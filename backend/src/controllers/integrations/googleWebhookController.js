const crypto = require('crypto');
const Integration = require('../../models/Integration');
const webhookQueueService = require('../../services/integrations/webhookQueueService');
const { parseLosslessJson } = require('../../utils/losslessJson');

/**
 * POST /api/integrations/google/webhook/:key?
 *
 * Secure Google Ads Lead Form Webhook Receiver.
 * Resolves integration strictly by constant-time verification of the per-integration key.
 * Never falls back to a random tenant.
 */
exports.receive = async (req, res) => {
  try {
    // 1. Lossless body parsing directly from rawBody
    const payload = parseLosslessJson(req.rawBody || req.body) || {};

    // 2. Extract per-integration secret key with safe optional chaining
    const receivedKey = (
      req.params?.key ||
      payload?.google_key ||
      payload?.key ||
      req.query?.key ||
      req.headers?.['x-google-webhook-key'] ||
      req.headers?.['x-google-key'] ||
      ''
    ).trim();

    if (!receivedKey) {
      console.warn('[Google Webhook] Inbound request rejected: missing google_key');
      return res.status(401).json({ error: 'Missing webhook key' });
    }

    // 3. Strict Per-Integration Key Lookup via SHA-256 Hash
    const receivedHash = crypto.createHash('sha256').update(receivedKey).digest('hex');
    const integration = await Integration.findOne({
      provider: 'google',
      googleKeyHash: receivedHash,
      status: { $ne: 'disconnected' },
    }).select('+googleKeyHash');

    // Requirement A.1: Reject unmatched key immediately. Never fallback to another tenant!
    if (!integration || !integration.googleKeyHash) {
      console.warn('[Google Webhook] Inbound request rejected: invalid or unmatched google_key');
      return res.status(401).json({ error: 'Invalid webhook key' });
    }

    // Constant-time hash verification
    const recvBuf = Buffer.from(receivedHash, 'hex');
    const confBuf = Buffer.from(integration.googleKeyHash, 'hex');
    if (recvBuf.length !== confBuf.length || !crypto.timingSafeEqual(recvBuf, confBuf)) {
      console.warn('[Google Webhook] Constant-time key comparison failed');
      return res.status(401).json({ error: 'Key verification failed' });
    }

    // 4. Requirement E.1: Test lead identification (ONLY when is_test === true or simulator)
    const isTest = payload.is_test === true || payload.isTest === true;
    const externalLeadId = String(payload.lead_id || payload.leadId || (isTest ? `google_test_${Date.now()}` : ''));

    // Extract incoming columns for field mapping detection
    const sampleFields = [];
    if (Array.isArray(payload.user_column_data)) {
      for (const col of payload.user_column_data) {
        const key = col.column_id || col.column_name || '';
        const label = col.column_name || col.column_id || '';
        const sampleValue = col.string_value || '';
        if (key) {
          sampleFields.push({ key, label, sampleValue });
        }
      }
    } else {
      const ignored = new Set(['google_key', 'key', 'is_test', 'isTest', 'api_version', 'gcl_id', 'lead_id', 'leadId', 'form_id', 'campaign_id', 'adgroup_id', 'creative_id']);
      for (const [k, v] of Object.entries(payload)) {
        if (!ignored.has(k) && typeof v !== 'object') {
          sampleFields.push({ key: k, label: k, sampleValue: String(v) });
        }
      }
    }

    // Record sample fields & timestamp in integration metadata
    integration.metadata = {
      ...(integration.metadata || {}),
      lastTestReceivedAt: new Date(),
      sampleFields: sampleFields.length > 0 ? sampleFields : (integration.metadata?.sampleFields || []),
    };

    // If awaiting test lead, immediately activate into needs_mapping state
    if (integration.status === 'awaiting_test_lead' || integration.status === 'pending') {
      integration.status = 'needs_mapping';
    }

    await integration.save();

    // 5. Persist into durable WebhookEvent queue first
    await webhookQueueService.enqueueEvent({
      provider: 'google',
      integrationId: integration._id,
      companyId: integration.companyId,
      userId: integration.userId,
      externalLeadId,
      headers: req.headers,
      rawBody: req.rawBody ? req.rawBody.toString('utf8') : payload,
      isTest,
    });

    // 6. Return fast 200 OK to Google Ads
    return res.status(200).json({
      success: true,
      status: 'RECEIVED',
      is_test: isTest,
    });
  } catch (error) {
    console.error('[Google Webhook Error]:', error.message);
    // Return 500 if DB write failed so Google will retry
    return res.status(500).json({ error: 'Ingestion queue error' });
  }
};