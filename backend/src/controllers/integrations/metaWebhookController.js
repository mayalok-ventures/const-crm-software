const crypto = require('crypto');
const axios = require('axios');
const Integration = require('../../models/Integration');
const leadIngestionService = require('../../services/integrations/leadIngestionService');
const { decrypt } = require('../../utils/encryption');

const META_VERIFY_TOKEN =
  process.env.META_WEBHOOK_VERIFY_TOKEN || 'crm_meta_webhook_secret_2026';
const META_APP_SECRET =
  process.env.META_APP_SECRET || 'dev_meta_app_secret_2026_secure';

/**
 * GET /api/integrations/meta/webhook
 *
 * Meta webhook verification challenge (Supports both META_VERIFY_TOKEN & META_WEBHOOK_VERIFY_TOKEN)
 */
exports.verify = async (req, res) => {
  try {
    const mode = String(req.query['hub.mode'] || '').trim().toLowerCase();
    const token = String(req.query['hub.verify_token'] || '').trim();
    const challenge = req.query['hub.challenge'];

    // Dynamic resolution of verify token from environment (supports both standard naming conventions)
    const expectedToken = (
      process.env.META_VERIFY_TOKEN ||
      process.env.META_WEBHOOK_VERIFY_TOKEN ||
      'crm_meta_webhook_secret_2026'
    ).trim();

    if (mode === 'subscribe' && token === expectedToken) {
      // Must return raw challenge with status 200 to complete Meta verification
      return res.status(200).send(challenge);
    }

    console.warn('[Meta Webhook] Verification rejected: token or mode mismatch', {
      receivedMode: mode,
      receivedToken: token ? `${token.slice(0, 4)}***` : 'EMPTY',
      expectedToken: `${expectedToken.slice(0, 4)}***`,
    });
    return res.sendStatus(403);
  } catch (error) {
    console.error('[Meta Webhook] Verify error:', error.message);
    return res.sendStatus(500);
  }
};

/**
 * POST /api/integrations/meta/webhook
 */
exports.receive = async (req, res) => {
  try {
    // 1. Signature Verification
    if (!verifySignature(req)) {
      console.warn('Invalid Meta webhook signature');
      return res.sendStatus(401);
    }

    const body = req.body;

    // 2. Immediate 200 OK acknowledgment to prevent Meta retry storms
    res.status(200).json({ success: true });

    // 3. Asynchronous processing
    setImmediate(async () => {
      try {
        if (body?.object !== 'page') {
          return;
        }

        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field !== 'leadgen') {
              continue;
            }

            const value = change.value || {};
            await handleLead({
              pageId: value.page_id || entry.id,
              formId: value.form_id,
              leadgenId: value.leadgen_id,
              adId: value.ad_id,
              adsetId: value.adset_id,
              campaignId: value.campaign_id,
              createdTime: value.created_time,
            });
          }
        }
      } catch (error) {
        console.error('Meta async webhook processing error:', error.message);
      }
    });
  } catch (error) {
    console.error('Meta webhook error:', error.message);
    return res.sendStatus(500);
  }
};

function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];

  // If no signature is provided and secret is strictly configured in production, reject
  if (!signature) {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    // Allow local test simulations without signature in development/test
    return true;
  }

  const [algorithm, hash] = signature.split('=');
  if (algorithm !== 'sha256' || !hash) {
    return false;
  }

  const rawPayload =
    typeof req.rawBody === 'string'
      ? req.rawBody
      : JSON.stringify(req.body);

  const expected = crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(rawPayload)
    .digest('hex');

  try {
    const hashBuf = Buffer.from(hash, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    if (hashBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuf, expectedBuf);
  } catch {
    return false;
  }
}

async function handleLead({
  pageId,
  formId,
  leadgenId,
  adId,
  adsetId,
  campaignId,
  createdTime,
}) {
  if (!leadgenId) {
    console.warn('[Meta Webhook] Received leadgen change event without leadgen_id, skipping.');
    return;
  }

  console.log(`[Meta Webhook] Processing leadgen event:`, { leadgenId, pageId, formId, adId, campaignId });

  // Find active integration for this Meta page, form, or connected account
  const integration = await Integration.findOne({
    provider: 'meta',
    $or: [
      { pageId: String(pageId) },
      { formIds: String(formId) },
      { accountId: { $exists: true, $ne: null } },
    ],
    status: 'connected',
  }).select('+accessTokenEncrypted');

  if (!integration) {
    console.warn(`[Meta Webhook] No active connected integration found in MongoDB for Meta pageId: "${pageId}", formId: "${formId}", leadgenId: "${leadgenId}"`);
    return;
  }

  let accessToken = null;
  if (integration.accessTokenEncrypted) {
    try {
      accessToken = decrypt(integration.accessTokenEncrypted);
    } catch (e) {
      console.error(`[Meta Webhook] Failed to decrypt Meta access token for integration ${integration._id}:`, e.message);
    }
  }

  if (!accessToken && !String(leadgenId).startsWith('meta_test_')) {
    console.error(`[Meta Webhook] Integration ${integration._id} has no valid decrypted access token for leadgenId ${leadgenId}`);
    return;
  }

  // Fetch lead details from Meta Graph API (or parse simulated payload)
  let leadData;
  if (String(leadgenId).startsWith('meta_test_') || !accessToken) {
    leadData = {
      name: 'Meta Ads Lead',
      phone: '919876543210',
      email: 'meta.lead@ad-response.com',
      campaignName: 'Meta Campaign',
      formName: 'Instant Lead Form',
      customData: {},
    };
  } else {
    try {
      leadData = await fetchMetaLead(leadgenId, accessToken);
    } catch (error) {
      console.error(`[Meta Webhook] Error fetching Meta leadgen ${leadgenId} from Graph API:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data,
        message: error.message,
      });
      return;
    }
  }

  try {
    const ingestResult = await leadIngestionService.ingest({
      provider: 'meta',
      integrationId: integration._id,
      externalLeadId: String(leadgenId),
      accountId: integration.accountId,
      pageId: pageId || integration.pageId,
      formId: formId || null,
      formName: leadData.formName || '',
      adId: adId || leadData.adId || null,
      adName: leadData.adName || '',
      adSetId: adsetId || leadData.adSetId || null,
      adSetName: leadData.adSetName || '',
      campaignId: campaignId || leadData.campaignId || null,
      campaignName: leadData.campaignName || '',
      name: leadData.name,
      phone: leadData.phone,
      email: leadData.email,
      customData: leadData.customData || {},
      createdAt: createdTime ? new Date(createdTime * 1000) : new Date(),
    });

    console.log(`[Meta Webhook] Successfully processed leadgen ${leadgenId}:`, {
      created: ingestResult.created,
      duplicate: ingestResult.duplicate,
      leadId: ingestResult.lead?._id,
      name: ingestResult.lead?.name,
      phone: ingestResult.lead?.phone,
    });
  } catch (ingestError) {
    console.error(`[Meta Webhook] Failed to ingest lead into CRM database:`, ingestError.message);
  }
}

async function fetchMetaLead(leadgenId, accessToken) {
  const version = process.env.META_GRAPH_VERSION || 'v23.0';
  const fields = [
    'id',
    'created_time',
    'field_data',
    'ad_id',
    'form_id',
    'campaign_id',
    'adset_id',
    'campaign_name',
    'adset_name',
    'ad_name',
    'form_name',
  ].join(',');

  const url = `https://graph.facebook.com/${version}/${leadgenId}`;
  console.log(`[Meta Webhook] Fetching lead details from Graph API: ${url}`);
  const response = await axios.get(url, {
    params: {
      fields,
      access_token: accessToken,
    },
    timeout: 10000,
  });

  const data = response.data;
  const fieldsMap = {};

  // Case-insensitive normalization: Convert all field names to lowercased trimmed strings
  for (const field of data.field_data || []) {
    const rawKey = String(field.name || '').trim().toLowerCase();
    const val = field.values?.[0] || '';
    fieldsMap[rawKey] = val;
  }

  // Extract Name with multi-field fallback (supporting full_name, name, first_name + last_name)
  let extractedName =
    fieldsMap.full_name ||
    fieldsMap.name ||
    (fieldsMap.first_name ? `${fieldsMap.first_name} ${fieldsMap.last_name || ''}`.trim() : '') ||
    fieldsMap.firstname ||
    fieldsMap['your name'] ||
    fieldsMap['contact name'] ||
    '';

  // Extract Phone with multi-field fallback
  const extractedPhone =
    fieldsMap.phone_number ||
    fieldsMap.phone ||
    fieldsMap.mobile ||
    fieldsMap.mobile_number ||
    fieldsMap['phone number'] ||
    fieldsMap['contact number'] ||
    '';

  // Extract Email with multi-field fallback
  const extractedEmail =
    fieldsMap.email ||
    fieldsMap['e-mail'] ||
    fieldsMap['email address'] ||
    '';

  // Fallback Name if missing but phone or email is available
  if (!extractedName && (extractedPhone || extractedEmail)) {
    extractedName = 'Meta Lead (No Name Provided)';
  }

  return {
    name: extractedName,
    phone: extractedPhone,
    email: extractedEmail,
    campaignId: data.campaign_id || null,
    campaignName: data.campaign_name || '',
    adSetId: data.adset_id || null,
    adSetName: data.adset_name || '',
    adId: data.ad_id || null,
    adName: data.ad_name || '',
    formName: data.form_name || '',
    customData: fieldsMap,
  };
}