const Lead = require('../models/Lead');
const Integration = require('../models/Integration');

async function ingestExternalLead({
  provider,
  integrationId,
  externalLeadId,

  accountId = null,
  pageId = null,
  formId = null,
  formName = '',
  campaignId = null,
  campaignName = '',
  adSetId = null,
  adSetName = '',
  adId = null,
  adName = '',

  data = {},
}) {
  if (!provider) {
    throw new Error('Lead provider is required');
  }

  if (!externalLeadId) {
    throw new Error('External lead ID is required');
  }

  const integration = await Integration.findById(integrationId);

  if (!integration) {
    throw new Error('Integration not found');
  }

  if (integration.status !== 'connected') {
    throw new Error('Integration is not connected');
  }

  /*
   * IMPORTANT:
   * Check external ID first.
   * This prevents webhook retries from creating duplicate leads.
   */

  const existing = await Lead.findOne({
    'leadSource.provider': provider,
    'leadSource.externalLeadId': String(externalLeadId),
  });

  if (existing) {
    return {
      created: false,
      duplicate: true,
      lead: existing,
    };
  }

  const name =
    data.name ||
    data.full_name ||
    data.fullname ||
    data.first_name ||
    'Unknown Lead';

  const phone =
    data.phone ||
    data.phone_number ||
    data.mobile ||
    data.mobile_number ||
    '';

  const email =
    data.email ||
    data.email_address ||
    '';

  if (!phone) {
    throw new Error(
      `External lead ${externalLeadId} does not contain a phone number`
    );
  }

  const cleanPhone = String(phone).replace(/\D/g, '');

  if (cleanPhone.length < 7) {
    throw new Error('Invalid phone number received from provider');
  }

  /*
   * Company ownership
   */
  const companyId =
    integration.companyId || integration.userId;

  /*
   * Existing CRM duplicate protection
   */
  const phoneDuplicate = await Lead.findOne({
    companyId,
    phone: cleanPhone,
  });

  if (phoneDuplicate) {
    /*
     * IMPORTANT:
     * We don't create another customer.
     *
     * Instead we can attach external source information
     * to the existing lead.
     */

    phoneDuplicate.leadSource = {
      provider,
      externalLeadId: String(externalLeadId),
      integrationId: integration._id,
      accountId,
      pageId,
      formId,
      formName,
      campaignId,
      campaignName,
      adSetId,
      adSetName,
      adId,
      adName,
      importedAt: new Date(),
    };

    phoneDuplicate.source = provider;

    phoneDuplicate.leadActivities.push({
      action: 'lead_updated',
      performedBy: null,
      performerName: 'Integration',
      details: `Existing lead matched with ${provider} lead ${externalLeadId}`,
      timestamp: new Date(),
    });

    await phoneDuplicate.save();

    return {
      created: false,
      duplicate: true,
      matchedExistingLead: true,
      lead: phoneDuplicate,
    };
  }

  const lead = await Lead.create({
    userId: integration.userId,
    companyId,

    name: String(name).trim(),

    phone: cleanPhone,

    email: email
      ? String(email).trim().toLowerCase()
      : undefined,

    status: 'new',

    followUpDate: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ),

    source: provider,

    leadSource: {
      provider,
      externalLeadId: String(externalLeadId),

      integrationId: integration._id,

      accountId,
      pageId,
      formId,
      formName,

      campaignId,
      campaignName,

      adSetId,
      adSetName,

      adId,
      adName,

      importedAt: new Date(),
    },

    customData: data,

    leadActivities: [
      {
        action: 'lead_created',
        performedBy: null,
        performerName: 'Integration',
        details: `Lead imported automatically from ${provider}`,
        timestamp: new Date(),
      },
    ],
  });

  await Integration.findByIdAndUpdate(
    integration._id,
    {
      $set: {
        lastSyncAt: new Date(),
        lastError: '',
      },
    }
  );

  return {
    created: true,
    duplicate: false,
    lead,
  };
}

module.exports = {
  ingestExternalLead,
};