const crypto = require('crypto');
const BaseProvider = require('./BaseProvider');
const { parseLosslessJson } = require('../../../utils/losslessJson');

class GoogleProvider extends BaseProvider {
  constructor() {
    super('google');
  }

  verify(req, integration) {
    if (!integration?.googleKeyHash) return false;

    const payload = parseLosslessJson(req.rawBody || req.body);
    const receivedKey = (
      req.params?.key ||
      payload.google_key ||
      payload.key ||
      req.query?.key ||
      req.headers['x-google-webhook-key'] ||
      req.headers['x-google-key'] ||
      ''
    ).trim();

    if (!receivedKey) return false;

    const receivedHash = crypto.createHash('sha256').update(receivedKey).digest('hex');
    const recvBuf = Buffer.from(receivedHash, 'hex');
    const confBuf = Buffer.from(integration.googleKeyHash, 'hex');

    if (recvBuf.length !== confBuf.length) return false;
    return crypto.timingSafeEqual(recvBuf, confBuf);
  }

  parse(req) {
    return parseLosslessJson(req.rawBody || req.body);
  }

  async hydrate(parsed) {
    return parsed;
  }

  normalize(payload, integration) {
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

    const connectionId = String(payload.customer_id || integration?.customerId || integration?.accountId || integration?._id || '');
    const connectionName = integration?.adAccountName || integration?.accountName || 'Google Ads Account';
    const campaignName = payload.campaign_name || integration?.metadata?.defaultCampaignLabel || 'Google Ads Campaign';
    const campaignId = payload.campaign_id ? String(payload.campaign_id) : (campaignName ? `cmp_${campaignName.toLowerCase().replace(/\s+/g, '_')}` : 'google_campaign_default');

    return {
      provider: 'google',
      platform: 'google',
      connectionId,
      connectionName,
      externalLeadId: String(payload.lead_id || payload.leadId || `g_lead_${Date.now()}`),
      formId: payload.form_id ? String(payload.form_id) : null,
      formName: payload.form_name || 'Google Lead Extension Form',
      campaignId: String(campaignId),
      campaignName,
      adGroupId: payload.adgroup_id ? String(payload.adgroup_id) : null,
      adGroupName: payload.adgroup_name || '',
      adId: payload.creative_id ? String(payload.creative_id) : null,
      adName: payload.ad_name || '',
      name,
      phone,
      email,
      customData,
      isTest: Boolean(payload.is_test || payload.isTest),
      createdAt: payload.lead_submit_time ? new Date(payload.lead_submit_time) : new Date(),
    };
  }
}

module.exports = new GoogleProvider();
