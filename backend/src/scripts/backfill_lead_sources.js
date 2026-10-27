const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Integration = require('../models/Integration');
const Campaign = require('../models/Campaign');

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^-+|-+$/g, '');
}

async function runBackfill() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mobile-crm';
  console.log(`Connecting to MongoDB at ${mongoUri}...`);
  await mongoose.connect(mongoUri);

  const leads = await Lead.find({});
  console.log(`Found ${leads.length} leads to backfill.`);

  let updatedCount = 0;
  let campaignsCreated = 0;

  for (const lead of leads) {
    let integration = null;
    if (lead.leadSource?.integrationId) {
      integration = await Integration.findById(lead.leadSource.integrationId).lean();
    }

    const currentSource = String(lead.source || '').toLowerCase();
    const currentProvider = String(lead.leadSource?.provider || '').toLowerCase();

    // Determine platform
    let platform = currentProvider || currentSource;
    if (['meta', 'facebook', 'instagram', 'meta_ads'].includes(platform)) {
      platform = 'meta';
    } else if (['google', 'google_ads', 'adwords'].includes(platform)) {
      platform = 'google';
    } else if (['sheets', 'spreadsheet', 'import'].includes(platform)) {
      platform = 'sheets';
    } else if (['website', 'web', 'organic'].includes(platform)) {
      platform = 'website';
    } else if (['signup', 'agent_manual', 'manual'].includes(platform)) {
      platform = 'manual';
    } else if (!platform) {
      platform = 'manual';
    }

    // Determine connectionId & connectionName
    let connectionId = lead.leadSource?.connectionId || null;
    let connectionName = lead.leadSource?.connectionName || '';

    if (!connectionId) {
      if (integration) {
        connectionId =
          integration.pageId ||
          integration.customerId ||
          integration.accountId ||
          integration.sheetsConfig?.sheetId ||
          integration.websiteFormConfig?.formKey ||
          String(integration._id);
        connectionName =
          integration.pageName ||
          integration.accountName ||
          integration.sheetsConfig?.sheetName ||
          integration.name ||
          'Integration Connection';
      } else if (lead.leadSource?.pageId) {
        connectionId = lead.leadSource.pageId;
        connectionName = 'Meta Page';
      } else if (lead.leadSource?.accountId) {
        connectionId = lead.leadSource.accountId;
        connectionName = 'Google Account';
      } else if (lead.leadSource?.formName) {
        connectionId = slugify(lead.leadSource.formName) || 'form_default';
        connectionName = lead.leadSource.formName;
      } else {
        connectionId = 'direct';
        connectionName = 'Direct Inbound / Manual';
      }
    }

    // Determine campaignId & campaignName
    let campaignName =
      lead.leadSource?.campaignName ||
      lead.utmCampaign ||
      integration?.metadata?.defaultCampaignLabel ||
      (platform === 'manual' ? 'Direct / Organic' : 'General Inbound Campaign');

    let campaignId =
      lead.leadSource?.campaignId ||
      (campaignName ? `cmp_${slugify(campaignName)}` : 'default_campaign');

    // Update lead document
    if (!lead.leadSource) lead.leadSource = {};
    lead.leadSource.platform = platform;
    lead.leadSource.provider = platform;
    lead.leadSource.connectionId = String(connectionId);
    lead.leadSource.connectionName = connectionName;
    lead.leadSource.campaignId = String(campaignId);
    lead.leadSource.campaignName = campaignName;
    if (!lead.leadSource.importedAt) {
      lead.leadSource.importedAt = lead.createdAt || new Date();
    }

    await lead.save();
    updatedCount++;

    // Ensure Campaign record exists in Registry
    const tenantFilter = lead.companyId
      ? { companyId: lead.companyId }
      : { userId: lead.userId };

    const existingCampaign = await Campaign.findOne({
      ...tenantFilter,
      platform,
      connectionId: String(connectionId),
      externalCampaignId: String(campaignId),
    });

    if (!existingCampaign) {
      await Campaign.create({
        companyId: lead.companyId || null,
        userId: lead.userId,
        platform,
        connectionId: String(connectionId),
        connectionName,
        integrationId: integration?._id || null,
        externalCampaignId: String(campaignId),
        campaignName,
        name: campaignName,
        displayName: campaignName,
        assignmentRule: integration?.assignmentRule || { type: 'round_robin' },
        fieldMapping: integration?.fieldMapping || [],
        leadCount: 1,
        leadsGenerated: 1,
        status: 'ACTIVE',
        lastLeadAt: lead.createdAt || new Date(),
      });
      campaignsCreated++;
    } else {
      await Campaign.updateOne(
        { _id: existingCampaign._id },
        {
          $inc: { leadCount: 1, leadsGenerated: 1 },
          $set: { lastLeadAt: lead.createdAt || new Date() },
        }
      );
    }
  }

  console.log(`Successfully backfilled ${updatedCount} leads.`);
  console.log(`Created ${campaignsCreated} campaign registry records.`);
  await mongoose.disconnect();
  process.exit(0);
}

runBackfill().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
