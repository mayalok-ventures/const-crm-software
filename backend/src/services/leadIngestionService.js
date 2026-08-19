const unifiedService = require('./integrations/leadIngestionService');

async function ingestExternalLead(params) {
  const result = await unifiedService.ingest({
    provider: params.provider,
    integrationId: params.integrationId,
    externalLeadId: params.externalLeadId,
    accountId: params.accountId,
    pageId: params.pageId,
    formId: params.formId,
    formName: params.formName,
    campaignId: params.campaignId,
    campaignName: params.campaignName,
    adSetId: params.adSetId,
    adSetName: params.adSetName,
    adGroupId: params.adGroupId,
    adGroupName: params.adGroupName,
    adId: params.adId,
    adName: params.adName,
    name: params.data?.name || params.name,
    phone: params.data?.phone || params.phone,
    email: params.data?.email || params.email,
    customData: params.data || params.customData,
    createdAt: params.createdAt,
  });

  return result;
}

module.exports = {
  ingestExternalLead,
  ingest: unifiedService.ingest.bind(unifiedService),
};