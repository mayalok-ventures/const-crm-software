const crypto = require('crypto');
const BaseProvider = require('./BaseProvider');
const { parseLosslessJson } = require('../../../utils/losslessJson');

class SheetsProvider extends BaseProvider {
  constructor() {
    super('sheets');
  }

  verify(req, integration) {
    if (!integration?.sheetsSecretHash) return false;

    const receivedSecret = (
      req.headers['x-crm-secret'] ||
      req.headers['x-sheets-secret'] ||
      req.query?.secret ||
      req.body?.secret ||
      ''
    ).trim();

    if (!receivedSecret) return false;

    const receivedHash = crypto.createHash('sha256').update(receivedSecret).digest('hex');
    const recvBuf = Buffer.from(receivedHash, 'hex');
    const confBuf = Buffer.from(integration.sheetsSecretHash, 'hex');

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
    const rowData = payload.rowData || payload.data || {};
    const keys = Object.keys(rowData);

    // Synonym resolver helper
    const findValue = (synonyms) => {
      for (const syn of synonyms) {
        for (const k of keys) {
          if (k.trim().toLowerCase() === syn.toLowerCase()) {
            return rowData[k];
          }
        }
      }
      return '';
    };

    const name = findValue(['full name', 'name', 'student name', 'candidate name', 'first name']);
    const phone = findValue(['phone', 'mobile', 'contact', 'whatsapp', 'phone number', 'mobile number', 'tel']);
    const email = findValue(['email', 'e-mail', 'email address', 'mail']);
    const city = findValue(['city', 'location', 'town', 'address', 'target city']);
    const course = findValue(['course', 'program', 'interest', 'course / interest', 'stream', 'degree']);

    // Campaign resolution according to Part 1, Item 3:
    // (a) "Campaign" column / utm_campaign if present, else
    // (b) connection's default campaign label set in wizard
    const rowCampaign = findValue(['campaign', 'utm_campaign', 'source', 'ad campaign']);
    const defaultLabel =
      integration?.metadata?.defaultCampaignLabel ||
      integration?.accountName ||
      'Admissions Sheet Inbound';

    const campaignName = String(rowCampaign || defaultLabel).trim();
    const campaignId = `cmp_${campaignName.toLowerCase().replace(/[^\w]+/g, '_')}`;

    const connectionId = String(payload.sheetId || integration?.sheetsConfig?.sheetId || integration?._id || '');
    const connectionName = payload.sheetName || integration?.sheetsConfig?.sheetName || integration?.accountName || 'Google Sheet';

    // Everything else stays in customData
    const customData = { ...rowData };
    if (city) customData['City'] = city;
    if (course) customData['Course / Interest'] = course;

    return {
      provider: 'sheets',
      platform: 'sheets',
      connectionId,
      connectionName,
      externalLeadId: String(payload.leadId || payload.lead_id || `sheet_${Date.now()}`),
      formId: connectionId,
      formName: connectionName,
      campaignId,
      campaignName,
      name: String(name || ''),
      phone: String(phone || ''),
      email: String(email || ''),
      customData,
      isTest: Boolean(payload.isTest),
      createdAt: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    };
  }
}

module.exports = new SheetsProvider();
