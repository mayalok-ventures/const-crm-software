const crypto = require('crypto');
const BaseProvider = require('./BaseProvider');
const { parseLosslessJson } = require('../../../utils/losslessJson');

class CustomWebhookProvider extends BaseProvider {
  constructor() {
    super('custom');
  }

  verify(req, integration) {
    const secretHash =
      integration?.customSecretHash ||
      integration?.sheetsSecretHash ||
      integration?.googleKeyHash;

    if (!secretHash) return false;

    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    const receivedSecret = (
      req.headers['x-crm-secret'] ||
      req.headers['x-custom-secret'] ||
      req.headers['x-webhook-key'] ||
      bearerToken ||
      req.query?.key ||
      req.query?.secret ||
      req.body?.secret ||
      ''
    ).trim();

    if (!receivedSecret) return false;

    const receivedHash = crypto.createHash('sha256').update(receivedSecret).digest('hex');
    const recvBuf = Buffer.from(receivedHash, 'hex');
    const confBuf = Buffer.from(secretHash, 'hex');

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
    const data = typeof payload === 'object' && payload !== null ? payload : {};
    const keys = Object.keys(data);

    // Deep search or flat search for common CRM keys
    const findValue = (synonyms) => {
      for (const syn of synonyms) {
        for (const k of keys) {
          if (k.trim().toLowerCase() === syn.toLowerCase()) {
            return data[k];
          }
        }
      }
      return '';
    };

    const name =
      findValue(['name', 'full_name', 'fullname', 'first_name', 'student_name', 'lead_name']) ||
      (data.first_name && data.last_name ? `${data.first_name} ${data.last_name}` : '');

    const phone = findValue([
      'phone',
      'mobile',
      'contact',
      'phone_number',
      'mobilenumber',
      'whatsapp',
      'tel',
    ]);

    const email = findValue(['email', 'e-mail', 'email_address', 'mail']);
    const city = findValue(['city', 'location', 'town', 'address']);
    const course = findValue(['course', 'program', 'interest', 'stream']);

    // Campaign Resolution
    const rowCampaign = findValue(['campaign', 'campaign_name', 'utm_campaign', 'source']);
    const defaultLabel =
      integration?.metadata?.defaultCampaignLabel ||
      integration?.accountName ||
      'Custom Webhook Inbound';

    const campaignName = String(rowCampaign || defaultLabel).trim();
    const campaignId = `cmp_${campaignName.toLowerCase().replace(/[^\w]+/g, '_')}`;

    const connectionId = String(integration?._id || 'custom_hook');
    const connectionName = integration?.accountName || 'Custom Inbound Webhook';

    const externalLeadId = String(
      data.id ||
      data.lead_id ||
      data.leadId ||
      data._id ||
      `custom_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    );

    return {
      provider: 'custom',
      platform: 'custom',
      connectionId,
      connectionName,
      externalLeadId,
      formId: connectionId,
      formName: connectionName,
      campaignId,
      campaignName,
      name: String(name || ''),
      phone: String(phone || ''),
      email: String(email || ''),
      customData: data,
      isTest: Boolean(data.isTest || data.is_test),
      createdAt: data.timestamp || data.createdAt ? new Date(data.timestamp || data.createdAt) : new Date(),
    };
  }
}

module.exports = new CustomWebhookProvider();
