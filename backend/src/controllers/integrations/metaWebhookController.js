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

    console.log('\n[Meta Webhook Verification Request Received]');
    console.log('Query Params:', JSON.stringify(req.query, null, 2));

    // Dynamic resolution of verify token from environment (supports both standard naming conventions)
    const expectedToken = (
      process.env.META_WEBHOOK_VERIFY_TOKEN ||
      process.env.META_VERIFY_TOKEN ||
      'crm_meta_webhook_secret_2026'
    ).trim();

    if (mode === 'subscribe' && token === expectedToken && challenge) {
      console.log('✅ Webhook Verification PASSED! Returning challenge:', challenge);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(String(challenge));
    }

    console.warn('❌ [Meta Webhook Verification FAILED] Mismatch detected:', {
      receivedMode: mode,
      receivedToken: token ? `${token.slice(0, 4)}***` : 'EMPTY',
      expectedToken: `${expectedToken.slice(0, 4)}***`,
      hasChallenge: !!challenge,
    });
    return res.status(403).send('Verification token mismatch');
  } catch (error) {
    console.error('❌ [Meta Webhook Verify Error]:', error.message);
    return res.status(500).send('Internal Server Error');
  }
};

/**
 * POST /api/integrations/meta/webhook
 * Immediate 200 OK + Asynchronous Lead Ingestion Pattern
 */
const handleWebhookPost = async (req, res) => {
  const body = req.body;

  // Verify this is an event from a Page or WhatsApp subscription
  if (body?.object === 'page' || body?.object === 'whatsapp_business_account') {
    // 1. CRITICAL: IMMEDIATELY RESPOND 200 OK TO META
    res.status(200).send('EVENT_RECEIVED');

    // 2. PROCESS THE LEAD ASYNCHRONOUSLY IN THE BACKGROUND
    setImmediate(async () => {
      try {
        console.log('\n================== [META WEBHOOK RECEIVED] ==================');
        console.log('[META INBOUND PAYLOAD]:', JSON.stringify(body, null, 2));

        if (Array.isArray(body.entry)) {
          for (const entry of body.entry) {
            if (Array.isArray(entry.changes)) {
              for (const change of entry.changes) {
                if (change.field === 'leadgen') {
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
            }
          }
        }
        console.log('================== [META WEBHOOK PROCESSING COMPLETE] ==================\n');
      } catch (error) {
        console.error('Async Webhook Processing Error:', error);
      }
    });
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
};

exports.handleWebhookPost = handleWebhookPost;
exports.receive = handleWebhookPost;

function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];

  // If no signature is provided and secret is strictly configured in production, reject
  if (!signature) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[DEBUG SIGNATURE] No signature provided in production environment');
      return false;
    }
    // Allow local test simulations without signature in development/test
    console.log('[DEBUG SIGNATURE] No signature provided, allowed in non-production mode');
    return true;
  }

  const [algorithm, hash] = signature.split('=');
  if (algorithm !== 'sha256' || !hash) {
    console.warn('[DEBUG SIGNATURE] Algorithm mismatch or malformed signature:', signature);
    return false;
  }

  const rawPayload = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : (typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body));

  const expected = crypto
    .createHmac('sha256', META_APP_SECRET)
    .update(rawPayload)
    .digest('hex');

  try {
    const hashBuf = Buffer.from(hash, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    if (hashBuf.length !== expectedBuf.length) {
      console.warn('[DEBUG SIGNATURE] Signature buffer length mismatch');
      return false;
    }

    const isValid = crypto.timingSafeEqual(hashBuf, expectedBuf);
    console.log('[DEBUG SIGNATURE] Signature verification result:', isValid ? 'VALID ✅' : 'INVALID ❌');
    return isValid;
  } catch (e) {
    console.error('[DEBUG SIGNATURE ERROR]:', e.message);
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
    console.warn('[DEBUG HANDLE_LEAD] Received change event without leadgen_id, skipping.');
    return;
  }

  console.log(`\n---> [DEBUG HANDLE_LEAD START] leadgenId: "${leadgenId}", pageId: "${pageId}", formId: "${formId}"`);

  // Strict Tenant Scoping: Lookup integration strictly by matching Page ID or Form ID
  const searchQueries = [];
  if (pageId) {
    searchQueries.push({ pageId: String(pageId) });
    searchQueries.push({ accountId: String(pageId) });
  }
  if (formId) {
    searchQueries.push({ formIds: String(formId) });
  }

  let integration = null;
  if (searchQueries.length > 0) {
    integration = await Integration.findOne({
      provider: 'meta',
      $or: searchQueries,
      status: 'connected',
    }).select('+accessTokenEncrypted');
  }

  if (!integration) {
    console.warn(`⚠️ [UNMAPPED WEBHOOK EVENT] No registered Integration found matching Page ID: "${pageId}" or Form ID: "${formId}". Inbound webhook event dropped safely to prevent cross-account data leakage.`);
    return;
  }

  console.log('[DEBUG HANDLE_LEAD] Found Integration document in DB:', {
    _id: integration._id,
    provider: integration.provider,
    pageId: integration.pageId,
    accountId: integration.accountId,
    accountName: integration.accountName,
    companyId: integration.companyId,
    userId: integration.userId,
    status: integration.status,
    hasAccessToken: !!integration.accessTokenEncrypted,
  });

  let accessToken = null;
  if (integration.accessTokenEncrypted) {
    try {
      accessToken = decrypt(integration.accessTokenEncrypted);
      console.log('[DEBUG HANDLE_LEAD] Successfully decrypted access token:', `${accessToken.slice(0, 15)}...`);
    } catch (e) {
      console.error(`❌ [DEBUG HANDLE_LEAD ERROR] Failed to decrypt access token for integration ${integration._id}:`, e.message);
    }
  }

  if (!accessToken && !String(leadgenId).startsWith('meta_test_')) {
    console.error(`❌ [DEBUG HANDLE_LEAD ERROR] Integration ${integration._id} has no valid decrypted access token for leadgenId ${leadgenId}`);
    return;
  }

  // Fetch lead details from Meta Graph API (or parse simulated payload)
  let leadData;
  if (String(leadgenId).startsWith('meta_test_') || !accessToken) {
    console.log('[DEBUG HANDLE_LEAD] Using simulated test payload for meta_test leadgen ID');
    leadData = {
      name: 'Meta Ads Test Lead',
      phone: '919876543210',
      email: 'meta.lead@ad-response.com',
      campaignName: 'Meta Test Campaign',
      formName: 'Instant Lead Form',
      customData: {},
    };
  } else {
    try {
      console.log(`[DEBUG HANDLE_LEAD] Fetching lead details from Meta Graph API for leadgenId: ${leadgenId}...`);
      leadData = await fetchMetaLead(leadgenId, accessToken);
      console.log('[DEBUG HANDLE_LEAD] Successfully fetched and parsed lead data from Meta:', JSON.stringify(leadData, null, 2));
    } catch (error) {
      console.error(`\n❌❌❌ [DEBUG HANDLE_LEAD GRAPH API ERROR] ❌❌❌`);
      console.error('Leadgen ID:', leadgenId);
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      console.error('Response Data:', JSON.stringify(error.response?.data || {}, null, 2));
      console.error('Error Message:', error.message);
      console.error('Stack Trace:\n', error.stack);
      console.error('=====================================================\n');
      return;
    }
  }

  try {
    const ingestPayload = {
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
    };

    console.log('[DEBUG HANDLE_LEAD] Calling leadIngestionService.ingest() with payload:', JSON.stringify(ingestPayload, null, 2));

    const ingestResult = await leadIngestionService.ingest(ingestPayload);

    console.log(`\n✅✅✅ [DEBUG HANDLE_LEAD INGESTION SUCCESS] ✅✅✅`);
    console.log('Ingestion Result:', JSON.stringify(ingestResult, null, 2));
    console.log('===================================================\n');
  } catch (ingestError) {
    console.error(`\n❌❌❌ [DEBUG HANDLE_LEAD INGESTION ERROR] ❌❌❌`);
    console.error('Failed to ingest lead into CRM database:', ingestError.message);
    console.error('Ingest Error Stack:\n', ingestError.stack);
    console.error('===================================================\n');
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
  console.log(`[DEBUG fetchMetaLead] GET Request URL: ${url}`);
  const response = await axios.get(url, {
    params: {
      fields,
      access_token: accessToken,
    },
    timeout: 10000,
  });

  const data = response.data;
  console.log('[DEBUG fetchMetaLead] Raw Graph API Response:', JSON.stringify(data, null, 2));

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