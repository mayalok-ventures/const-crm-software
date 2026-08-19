const crypto = require('crypto');
const Integration = require('../../models/Integration');
const leadIngestionService = require('../../services/integrations/leadIngestionService');

/**
 * POST /api/integrations/google/webhook
 */
exports.receive = async (req, res) => {
  try {
    const payload = req.body || {};

    // 1. Secret / Key Verification
    if (!verifyGoogleWebhook(req)) {
      console.warn('Invalid Google webhook key or secret');
      return res.sendStatus(401);
    }

    // 2. Fast 200 OK acknowledgment
    res.status(200).json({ success: true });

    // 3. Asynchronous processing
    setImmediate(async () => {
      try {
        await processGoogleLead(payload);
      } catch (error) {
        console.error('Google lead processing failed:', error.message);
      }
    });
  } catch (error) {
    console.error('Google webhook error:', error.message);
    return res.sendStatus(500);
  }
};

/**
 * Verify Google Webhook secret or google_key
 */
function verifyGoogleWebhook(req) {
  const configuredSecret =
    process.env.GOOGLE_WEBHOOK_SECRET || 'crm_google_webhook_secret_2026';

  const receivedSecret =
    req.headers['x-google-webhook-secret'] ||
    req.body?.google_key ||
    req.body?.key ||
    req.query?.key;

  // If in development/test and no secret sent, allow test simulations
  if (!receivedSecret) {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return true;
  }

  try {
    const recvBuf = Buffer.from(String(receivedSecret));
    const confBuf = Buffer.from(String(configuredSecret));

    if (recvBuf.length !== confBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(recvBuf, confBuf);
  } catch {
    return false;
  }
}

async function processGoogleLead(payload) {
  const externalLeadId =
    payload.leadId ||
    payload.lead_id ||
    payload.id ||
    `google_lead_${Date.now()}`;

  const customerId = normalizeCustomerId(
    payload.customerId ||
    payload.customer_id ||
    payload.googleAdsCustomerId ||
    payload.accountId
  );

  // Look up integration by accountId / customerId
  let integration = null;
  if (customerId) {
    integration = await Integration.findOne({
      provider: 'google',
      $or: [{ accountId: customerId }, { customerId }],
      status: 'connected',
    });
  }

  if (!integration) {
    // Fallback: find any connected Google integration
    integration = await Integration.findOne({
      provider: 'google',
      status: 'connected',
    });
  }

  if (!integration) {
    console.warn(`No active Google integration found for customerId: ${customerId || 'unknown'}`);
    return;
  }

  const lead = normalizeGoogleLead(payload);

  await leadIngestionService.ingest({
    provider: 'google',
    integrationId: integration._id,
    externalLeadId: String(externalLeadId),
    accountId: customerId || integration.accountId,
    campaignId: lead.campaignId,
    campaignName: lead.campaignName,
    adGroupId: lead.adGroupId,
    adGroupName: lead.adGroupName,
    adId: lead.adId,
    adName: lead.adName,
    formId: lead.formId,
    formName: lead.formName,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    customData: lead.customData || {},
  });
}

function normalizeGoogleLead(payload) {
  const columns = payload.user_column_data || payload.columns || [];
  let name = payload.name || payload.full_name || '';
  let phone = payload.phone || payload.phone_number || '';
  let email = payload.email || '';
  const customData = {};

  for (const col of columns) {
    const colId = (col.column_id || col.id || col.name || '').toUpperCase();
    const colVal = col.string_value || col.value || '';

    if (colId.includes('NAME') || colId.includes('FULL_NAME')) {
      if (!name) name = colVal;
    } else if (colId.includes('PHONE')) {
      if (!phone) phone = colVal;
    } else if (colId.includes('EMAIL')) {
      if (!email) email = colVal;
    } else {
      customData[col.column_id || col.name || 'field'] = colVal;
    }
  }

  return {
    name: name || 'Google Ads Lead',
    phone: phone || '919812345678',
    email: email || 'google.lead@ad-response.com',
    campaignId: payload.campaign_id || payload.campaignId || null,
    campaignName: payload.campaign_name || payload.campaignName || 'Google Search Campaign',
    adGroupId: payload.adgroup_id || payload.adGroupId || null,
    adGroupName: payload.adgroup_name || payload.adGroupName || 'Search Keywords Ad Group',
    adId: payload.creative_id || payload.adId || null,
    adName: payload.ad_name || payload.adName || '',
    formId: payload.form_id || payload.formId || null,
    formName: payload.form_name || payload.formName || 'Google Lead Extension Form',
    customData,
  };
}

function normalizeCustomerId(id) {
  if (!id) return null;
  return String(id).replace(/\D/g, '');
}