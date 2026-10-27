const crypto = require('crypto');
const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const META_CONFIG = require('../../../config/meta');
const { parseLosslessJson } = require('../../../utils/losslessJson');

const metaNameCache = new Map();

class MetaProvider extends BaseProvider {
  constructor() {
    super('meta');
  }

  verify(req) {
    const shouldVerify = process.env.META_VERIFY_SIGNATURE !== 'false';
    if (!shouldVerify) return true;

    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      if (process.env.NODE_ENV === 'test') return true;
      return false;
    }

    const appSecret = (process.env.META_APP_SECRET || '').trim();
    if (!appSecret) return true;

    const payload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(payload).digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');

    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  parse(req) {
    const body = parseLosslessJson(req.rawBody || req.body);
    return body;
  }

  async hydrate(parsed, integration) {
    const { externalLeadId, pageId, formId, createdTime } = parsed;
    const isTest = String(externalLeadId).startsWith('meta_test_');

    if (isTest || !integration?.accessToken) {
      return {
        ...parsed,
        name: 'Meta Ads Test Lead',
        phone: '+919876543210',
        email: 'meta.test@example.com',
        campaignName: 'Meta Campaign',
        campaignId: 'meta_cmp_test_101',
        formName: 'Lead Form',
        adSetName: 'Target Students 18-24',
        adName: 'Ad Creative 1',
        customData: {},
        rawAnswers: [],
      };
    }

    const leadUrl = `${META_CONFIG.GRAPH_API_BASE}/${externalLeadId}`;
    try {
      const response = await axios.get(leadUrl, {
        params: {
          access_token: integration.accessToken,
          fields: 'id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data',
        },
        timeout: 10000,
      });

      const data = response.data;
      const fieldData = Array.isArray(data.field_data) ? data.field_data : [];

      let name = '';
      let phone = '';
      let email = '';
      const customData = {};
      const rawAnswers = [];

      for (const field of fieldData) {
        const key = String(field.name || '').toLowerCase();
        const value = Array.isArray(field.values) ? field.values[0] : field.values;
        rawAnswers.push({ name: field.name, value });

        if (key.includes('full_name') || key === 'name' || key.includes('first_name')) {
          if (!name) name = value;
        } else if (key.includes('phone') || key.includes('mobile')) {
          if (!phone) phone = value;
        } else if (key.includes('email')) {
          if (!email) email = value;
        } else {
          customData[field.name] = value;
        }
      }

      return {
        ...parsed,
        externalLeadId: data.id || externalLeadId,
        formId: data.form_id || formId,
        campaignId: data.campaign_id || null,
        campaignName: data.campaign_name || '',
        adSetId: data.adset_id || null,
        adSetName: data.adset_name || '',
        adId: data.ad_id || null,
        adName: data.ad_name || '',
        name,
        phone,
        email,
        customData,
        rawAnswers,
        createdTime: data.created_time || createdTime,
      };
    } catch (err) {
      console.error('[MetaProvider] hydrate error:', err.message);
      throw err;
    }
  }

  normalize(hydrated, integration) {
    const connectionId = String(hydrated.pageId || integration?.pageId || integration?._id || '');
    const connectionName = integration?.pageName || 'Meta Page';
    const campaignName = hydrated.campaignName || integration?.metadata?.defaultCampaignLabel || 'Meta Lead Gen Campaign';
    const campaignId = hydrated.campaignId || (campaignName ? `cmp_${campaignName.toLowerCase().replace(/\s+/g, '_')}` : 'meta_campaign_default');

    return {
      provider: 'meta',
      platform: 'meta',
      connectionId,
      connectionName,
      externalLeadId: String(hydrated.externalLeadId || ''),
      formId: hydrated.formId ? String(hydrated.formId) : null,
      formName: hydrated.formName || 'Meta Instant Form',
      campaignId: String(campaignId),
      campaignName,
      adSetId: hydrated.adSetId ? String(hydrated.adSetId) : null,
      adSetName: hydrated.adSetName || '',
      adId: hydrated.adId ? String(hydrated.adId) : null,
      adName: hydrated.adName || '',
      name: hydrated.name || '',
      phone: hydrated.phone || '',
      email: hydrated.email || '',
      customData: hydrated.customData || {},
      rawAnswers: hydrated.rawAnswers || [],
      isTest: Boolean(String(hydrated.externalLeadId).startsWith('meta_test_')),
      createdAt: hydrated.createdTime ? new Date(hydrated.createdTime) : new Date(),
    };
  }
}

module.exports = new MetaProvider();
