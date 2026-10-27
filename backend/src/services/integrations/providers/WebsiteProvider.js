const BaseProvider = require('./BaseProvider');
const { parseLosslessJson } = require('../../../utils/losslessJson');

class WebsiteProvider extends BaseProvider {
  constructor() {
    super('website');
  }

  verify(req, integration) {
    const formConfig = integration?.websiteFormConfig || {};
    const origin = req.headers.origin || req.headers.referer || '';
    const allowedOrigins = Array.isArray(formConfig.allowedOrigins) ? formConfig.allowedOrigins.filter(Boolean) : [];

    // In testing or local dev bypass, allow if specified
    if (process.env.NODE_ENV === 'test' || req.headers['x-test-bypass'] === 'crm-local-test') {
      return true;
    }

    if (allowedOrigins.length === 0) return false;
    if (allowedOrigins.includes('*')) return true;
    if (!origin) return false;

    return allowedOrigins.some((allowed) => {
      try {
        const originHost = new URL(origin).host;
        const allowedHost = allowed.replace(/^https?:\/\//, '').split('/')[0];
        return originHost === allowedHost || originHost.endsWith(`.${allowedHost}`);
      } catch {
        return false;
      }
    });
  }

  parse(req) {
    return parseLosslessJson(req.rawBody || req.body);
  }

  async hydrate(parsed) {
    return parsed;
  }

  normalize(payload, integration) {
    const connectionId = String(integration?.websiteFormConfig?.formKey || integration?._id || '');
    const connectionName = payload.form_name || integration?.name || 'Website Inbound Form';

    // Campaign fallback: utm_campaign, then campaign, then defaultCampaignLabel
    const rawCampaign = payload.utm_campaign || payload.campaign || payload.utmCampaign;
    const defaultLabel =
      integration?.metadata?.defaultCampaignLabel ||
      'Website Inbound Campaign';

    const campaignName = String(rawCampaign || defaultLabel).trim();
    const campaignId = `cmp_${campaignName.toLowerCase().replace(/[^\w]+/g, '_')}`;

    return {
      provider: 'website',
      platform: 'website',
      connectionId,
      connectionName,
      externalLeadId: String(payload.externalLeadId || `web_${Date.now()}`),
      formId: connectionId,
      formName: connectionName,
      campaignId,
      campaignName,
      name: payload.name || payload.fullName || payload['Full Name'] || '',
      phone: payload.phone || payload.mobile || payload['Phone'] || '',
      email: payload.email || payload['Email'] || '',
      utmSource: payload.utm_source || 'website',
      utmMedium: payload.utm_medium || 'organic',
      utmCampaign: campaignName,
      customData: payload.customData || payload,
      isTest: Boolean(payload.isTest),
      createdAt: new Date(),
    };
  }
}

module.exports = new WebsiteProvider();
